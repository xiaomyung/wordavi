/**
 * Problem-report composer. Gathers a diagnostics snapshot (version, UA,
 * settings, error ring, recent log) and sends it via the best available
 * channel: Web Share (with screenshots) first, mailto fallback otherwise.
 * Never throws - every entry point returns a structured result so a broken
 * share/clipboard API can't crash the report sheet itself.
 */
import { log, serializeLog } from '@/services/log';
import type { ErrorEntry, Settings } from '@/storage';
import { getErrors, getSettings } from '@/storage';

const NS = 'report';
const MAILTO_TARGET = 'xiaomyung.dev@gmail.com';
/**
 * Hard cap on the outgoing body, counted percent-encoded. Mail clients and OS
 * share sheets silently truncate (or drop) over-long `mailto:` URLs, and what
 * travels in such a URL is the encoded form: a Cyrillic note - the one the
 * primary learner writes - costs six characters per letter there. Measuring the
 * raw string would wave through a body that lands as a five-figure URL.
 */
const BODY_MAX_ENCODED_CHARS = 1800;
/** Floor for the log excerpt, so a bloated settings/error snapshot can't squeeze it to nothing. */
const MIN_LOG_EXCERPT_ENCODED_CHARS = 200;
const TRUNCATION_MARKER = '…(truncated)';
/** Passes allowed when narrowing the log's raw budget onto the encoded one. */
const LOG_BUDGET_PASSES = 4;

export interface ComposeReportInput {
  userText: string;
  screenshots: File[];
}

export interface ReportPayload {
  version: string;
  userAgent: string;
  language: string;
  screen: { width: number; height: number };
  settings: Settings;
  errors: ErrorEntry[];
  logExcerpt: string;
  userText: string;
  screenshots: File[];
  composedAt: string;
}

export type ReportChannel = 'share' | 'mailto';

export interface ReportPlan {
  channel: ReportChannel;
  /**
   * Screenshots the channel cannot carry. A `mailto:` URL has nowhere to put a
   * file, so a report leaving that way drops every one of them — the caller has
   * to say so instead of letting them vanish silently.
   */
  droppedScreenshots: number;
}

export interface SendReportResult extends ReportPlan {
  ok: boolean;
  error?: string;
}

export interface CopyReportResult {
  ok: boolean;
  error?: string;
}

function screenSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  return { width: window.innerWidth, height: window.innerHeight };
}

/** The ASCII characters `encodeURIComponent` passes through untouched. */
const UNRESERVED_ASCII = /[A-Za-z0-9\-_.!~*'()]/;
/** Marks (accents, variation selectors) bind to the character in front of them. */
const COMBINING_MARK = /^\p{M}$/u;
/** Two of these in a row are one flag. */
const REGIONAL_INDICATOR = /^[\u{1F1E6}-\u{1F1FF}]$/u;
/** Surrogate pairs first, so only the unpaired ones fall through to the second branch. */
const SURROGATE_RUN = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g;
const ZWJ = '\u200D';
const REPLACEMENT_CHAR = '\uFFFD';

/** Size of one code point in `encodeURIComponent` output. */
function encodedCodePointLength(codePoint: number): number {
  if (codePoint < 0x80) return UNRESERVED_ASCII.test(String.fromCharCode(codePoint)) ? 1 : 3;
  if (codePoint < 0x800) return 6;
  // Unpaired surrogates land here and cost exactly what the U+FFFD they encode as costs.
  if (codePoint < 0x10000) return 9;
  return 12;
}

/**
 * Length `text` takes once percent-encoded, measured without building the
 * encoded string - and without `encodeURIComponent`'s habit of throwing
 * `URIError` on an unpaired surrogate.
 */
function encodedLength(text: string): number {
  let total = 0;
  for (const char of text) {
    total += encodedCodePointLength(char.codePointAt(0) ?? 0);
  }
  return total;
}

function continuesRun(run: string, char: string): boolean {
  if (run.endsWith(ZWJ)) return true;
  if (COMBINING_MARK.test(char)) return true;
  return REGIONAL_INDICATOR.test(run) && REGIONAL_INDICATOR.test(char);
}

/**
 * The stretches of `text` that must survive or vanish whole: a base code point
 * plus the accents, joined emoji parts and flag halves that hang off it.
 * Iterating code points alone keeps surrogate pairs together but still strands
 * an accent from its letter.
 */
function* unbreakableRuns(text: string): Generator<string> {
  let run = '';
  for (const char of text) {
    if (run === '' || continuesRun(run, char)) {
      run += char;
      continue;
    }
    yield run;
    run = char;
  }
  if (run !== '') yield run;
}

/** The longest prefix of `text` that fits `maxEncoded` percent-encoded characters. */
function fitEncoded(text: string, maxEncoded: number): string {
  let used = 0;
  let end = 0;
  for (const run of unbreakableRuns(text)) {
    const cost = encodedLength(run);
    if (used + cost > maxEncoded) return text.slice(0, end);
    used += cost;
    end += run.length;
  }
  return text;
}

/**
 * Percent-encodes one `mailto:` field. An unpaired surrogate - a note pasted
 * from a source that already halved an emoji - makes `encodeURIComponent` throw
 * `URIError`, so those are folded to U+FFFD first, the substitution any UTF-8
 * encoder would make anyway.
 */
function encodeMailField(text: string): string {
  const wellFormed = text.replace(SURROGATE_RUN, (run) =>
    run.length === 2 ? run : REPLACEMENT_CHAR,
  );
  return encodeURIComponent(wellFormed);
}

/** Diagnostics still have to go out when one snapshot value is beyond JSON. */
function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? 'null';
  } catch {
    return '"<unserializable>"';
  }
}

/**
 * The newest log that fits `maxEncoded` percent-encoded characters.
 * {@link serializeLog} budgets in raw characters and JSON inflates unevenly on
 * encoding - a quote costs three characters, a Cyrillic letter six - so the raw
 * budget is narrowed by measurement instead of a guessed ratio. Each pass scales
 * the excerpt it actually got (not the budget it asked for, which the whole-entry
 * granularity leaves slack in) and drops below it, so a pass always sheds an
 * entry. It bottoms out at the newest entry, which `serializeLog` keeps whatever
 * the budget says.
 */
function serializeLogWithinEncoded(maxEncoded: number): string {
  let excerpt = serializeLog(maxEncoded);
  for (let pass = 0; pass < LOG_BUDGET_PASSES; pass += 1) {
    const encoded = encodedLength(excerpt);
    if (encoded <= maxEncoded) break;
    const scaled = Math.floor((excerpt.length * maxEncoded) / encoded);
    const narrowed = Math.min(scaled, excerpt.length - 1);
    if (narrowed < 1) break;
    excerpt = serializeLog(narrowed);
  }
  return excerpt;
}

/** Builds the diagnostics payload. Pure/sync - safe to call from a report sheet's mount. */
export function composeReport(input: ComposeReportInput): ReportPayload {
  const errors = getErrors();
  const base: Omit<ReportPayload, 'logExcerpt'> = {
    version: __APP_VERSION__,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    language: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
    screen: screenSize(),
    settings: getSettings(),
    errors,
    userText: input.userText,
    screenshots: input.screenshots,
    composedAt: new Date().toISOString(),
  };

  // Budget the log excerpt against everything else in the body, so the sent
  // text lands under the cap without the final truncate eating the log.
  const overhead = encodedLength(formatDiagnosticsText({ ...base, logExcerpt: '' }));
  const logBudget = Math.max(MIN_LOG_EXCERPT_ENCODED_CHARS, BODY_MAX_ENCODED_CHARS - overhead);
  const logExcerpt = serializeLogWithinEncoded(logBudget);
  const payload: ReportPayload = { ...base, logExcerpt };

  log.info(NS, 'report composed', {
    userTextLength: input.userText.length,
    screenshotCount: input.screenshots.length,
    errorCount: errors.length,
    logBudget,
    logExcerptLength: logExcerpt.length,
  });

  return payload;
}

function formatDiagnosticsText(payload: ReportPayload): string {
  return [
    `wordavi report v${payload.version}`,
    `composed: ${payload.composedAt}`,
    `ua: ${payload.userAgent}`,
    `lang: ${payload.language}`,
    `screen: ${payload.screen.width}x${payload.screen.height}`,
    `screenshots: ${payload.screenshots.length}`,
    `settings: ${safeJson(payload.settings)}`,
    `errors: ${safeJson(payload.errors)}`,
    '',
    'user note:',
    payload.userText,
    '',
    'recent log:',
    payload.logExcerpt,
  ].join('\n');
}

/**
 * The body actually handed to share/mailto. `composeReport` already sized the
 * log excerpt to fit; this is the belt-and-braces guarantee for the cases it
 * can't budget away (a huge error ring, a very long user note).
 */
function formatReportBody(payload: ReportPayload): string {
  const text = formatDiagnosticsText(payload);
  const encoded = encodedLength(text);
  if (encoded <= BODY_MAX_ENCODED_CHARS) return text;
  log.warn(NS, 'report body truncated to fit the channel cap', {
    encodedLength: encoded,
    max: BODY_MAX_ENCODED_CHARS,
  });
  const room = BODY_MAX_ENCODED_CHARS - encodedLength(TRUNCATION_MARKER);
  return `${fitEncoded(text, room)}${TRUNCATION_MARKER}`;
}

/**
 * Whether this browser can hand `files` to a share target. A `navigator.share`
 * that exists proves nothing about attachments: desktop browsers and several
 * mobile ones take text and refuse file payloads, and `canShare` is the only
 * way to ask before the sheet is already open.
 */
function canShareFiles(files: File[]): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files });
  } catch {
    // A file list it cannot describe makes Chromium throw rather than say no.
    return false;
  }
}

/**
 * The channel a report carrying these screenshots would leave through, and what
 * it would cost. Decided without sending anything, so the report sheet can warn
 * that a screenshot has to be attached by hand BEFORE the hand-off — afterwards
 * the mail draft is already open and the missing image reads as a bug.
 * Never throws: this runs while the sheet renders.
 */
export function planReport(screenshots: File[]): ReportPlan {
  // Web Share is only worth using when there are screenshots to attach — a
  // text-only report reads better in a mail draft the learner can still edit.
  if (screenshots.length === 0) return { channel: 'mailto', droppedScreenshots: 0 };
  if (canShareFiles(screenshots)) return { channel: 'share', droppedScreenshots: 0 };
  return { channel: 'mailto', droppedScreenshots: screenshots.length };
}

function sendMailto(payload: ReportPayload): SendReportResult {
  // mailto can't carry attachments, so every pending screenshot is lost here.
  const droppedScreenshots = payload.screenshots.length;

  if (droppedScreenshots > 0) {
    log.warn(NS, 'screenshots dropped', { count: droppedScreenshots });
  }

  try {
    const subject = encodeMailField(`Wordavi report v${payload.version}`);
    const body = encodeMailField(formatReportBody(payload));
    if (typeof window !== 'undefined') {
      window.location.href = `mailto:${MAILTO_TARGET}?subject=${subject}&body=${body}`;
    }
  } catch (err) {
    log.error(NS, 'mailto navigation failed', { error: String(err) });
    return { ok: false, channel: 'mailto', droppedScreenshots, error: String(err) };
  }

  log.info(NS, 'report sent', { channel: 'mailto', droppedScreenshots });
  return { ok: true, channel: 'mailto', droppedScreenshots };
}

async function shareOrMailto(payload: ReportPayload): Promise<SendReportResult> {
  const plan = planReport(payload.screenshots);

  if (plan.channel === 'share') {
    try {
      await navigator.share({
        title: `Wordavi report v${payload.version}`,
        text: formatReportBody(payload),
        files: payload.screenshots,
      });
      log.info(NS, 'report sent', { channel: 'share', fileCount: payload.screenshots.length });
      return { ok: true, channel: 'share', droppedScreenshots: 0 };
    } catch (err) {
      // A share sheet the learner dismissed, or a target that refused the files,
      // must not take the note down with it: the mail draft still carries the
      // whole body, and the screenshots are then reported as dropped.
      log.warn(NS, 'share failed, falling back to mailto', { error: String(err) });
      return sendMailto(payload);
    }
  }

  if (payload.screenshots.length > 0) {
    // Which half of the capability is missing decides whether the screenshot
    // could ever have travelled — worth knowing from a report that arrived
    // without one.
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    log.warn(NS, 'share cannot carry files, falling back to mailto', {
      shareAvailable: typeof nav?.share === 'function',
      canShareAvailable: typeof nav?.canShare === 'function',
      screenshotCount: payload.screenshots.length,
    });
  }
  return sendMailto(payload);
}

/** Tries Web Share (with screenshots) first, falls back to mailto. Never throws. */
export async function sendReport(payload: ReportPayload): Promise<SendReportResult> {
  try {
    return await shareOrMailto(payload);
  } catch (err) {
    // The report sheet's only way out of its sending state is this result, so
    // even a payload the composer would never build has to come back as one.
    log.error(NS, 'report send failed', { error: String(err) });
    return { ok: false, channel: 'mailto', droppedScreenshots: 0, error: String(err) };
  }
}

/**
 * Pre-Clipboard-API copy path: a throwaway textarea plus the deprecated
 * `document.execCommand('copy')`. Insecure origins (the LAN-http dev server,
 * for one) expose no `navigator.clipboard` at all, so without this the copy
 * button in the report sheet would be dead exactly where reports get tested.
 * Returns whether the text landed on the clipboard; never throws.
 */
function copyViaExecCommand(text: string): boolean {
  if (typeof document === 'undefined') return false;
  let textarea: HTMLTextAreaElement | null = null;
  try {
    textarea = document.createElement('textarea');
    textarea.value = text;
    // Off-screen rather than hidden: `display: none` makes select() a no-op.
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    return document.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    textarea?.remove();
  }
}

/**
 * Copies the full diagnostics text (no char cap) to the clipboard. Prefers the
 * async Clipboard API and falls back to `execCommand` when it is missing or
 * refuses. Never throws.
 */
export async function copyReport(payload: ReportPayload): Promise<CopyReportResult> {
  const text = formatDiagnosticsText(payload);
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
  let clipboardError = 'clipboard API unavailable';

  if (typeof clipboard?.writeText === 'function') {
    try {
      await clipboard.writeText(text);
      log.info(NS, 'report copied to clipboard', { length: text.length });
      return { ok: true };
    } catch (err) {
      clipboardError = String(err);
    }
  }

  log.warn(NS, 'clipboard write unavailable, trying legacy copy', { error: clipboardError });

  if (copyViaExecCommand(text)) {
    log.info(NS, 'copied via legacy fallback', { length: text.length });
    return { ok: true };
  }

  const error = `${clipboardError}; legacy copy failed`;
  log.warn(NS, 'report copy failed', { error });
  return { ok: false, error };
}
