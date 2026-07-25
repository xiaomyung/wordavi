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
 * Hard cap on the outgoing body. Mail clients and OS share sheets silently
 * truncate (or drop) over-long `mailto:` URLs, so the whole diagnostics blob -
 * not just the log excerpt - has to fit.
 */
const BODY_MAX_CHARS = 1800;
/** Floor for the log excerpt, so a bloated settings/error snapshot can't squeeze it to nothing. */
const MIN_LOG_EXCERPT_CHARS = 200;
const TRUNCATION_MARKER = '…(truncated)';

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

export interface SendReportResult {
  ok: boolean;
  channel: ReportChannel;
  manualAttachHint: boolean;
  /**
   * Screenshots the chosen channel could not carry. `mailto:` can't attach
   * files at all, so a degraded send drops every one of them — the caller has
   * to say so instead of letting them vanish silently.
   */
  droppedScreenshots: number;
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
  // text lands under BODY_MAX_CHARS without the final truncate eating the log.
  const overhead = formatDiagnosticsText({ ...base, logExcerpt: '' }).length;
  const logBudget = Math.max(MIN_LOG_EXCERPT_CHARS, BODY_MAX_CHARS - overhead);
  const logExcerpt = serializeLog(logBudget);
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
    `settings: ${JSON.stringify(payload.settings)}`,
    `errors: ${JSON.stringify(payload.errors)}`,
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
  if (text.length <= BODY_MAX_CHARS) return text;
  log.warn(NS, 'report body truncated to fit the channel cap', {
    length: text.length,
    max: BODY_MAX_CHARS,
  });
  return `${text.slice(0, BODY_MAX_CHARS - TRUNCATION_MARKER.length)}${TRUNCATION_MARKER}`;
}

function canShareFiles(nav: Navigator, files: File[]): boolean {
  if (typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({ files });
  } catch {
    return false;
  }
}

/**
 * The navigator that can share this payload, or null. Web Share is only worth
 * using when there are screenshots to attach — a text-only report reads better
 * in a mail draft the learner can edit.
 */
function shareableWith(payload: ReportPayload): Navigator | null {
  if (typeof navigator === 'undefined') return null;
  if (typeof navigator.share !== 'function') return null;
  if (payload.screenshots.length === 0) return null;
  return canShareFiles(navigator, payload.screenshots) ? navigator : null;
}

function sendMailto(payload: ReportPayload): SendReportResult {
  const subject = encodeURIComponent(`Wordavi report v${payload.version}`);
  const body = encodeURIComponent(formatReportBody(payload));
  const href = `mailto:${MAILTO_TARGET}?subject=${subject}&body=${body}`;
  // mailto can't carry attachments, so every pending screenshot is lost here.
  const droppedScreenshots = payload.screenshots.length;
  const manualAttachHint = droppedScreenshots > 0;

  if (droppedScreenshots > 0) {
    log.warn(NS, 'screenshots dropped', { count: droppedScreenshots });
  }

  try {
    if (typeof window !== 'undefined') {
      window.location.href = href;
    }
  } catch (err) {
    log.error(NS, 'mailto navigation failed', { error: String(err) });
    return {
      ok: false,
      channel: 'mailto',
      manualAttachHint,
      droppedScreenshots,
      error: String(err),
    };
  }

  log.info(NS, 'report sent', { channel: 'mailto', manualAttachHint, droppedScreenshots });
  return { ok: true, channel: 'mailto', manualAttachHint, droppedScreenshots };
}

/** Tries Web Share (with screenshots) first, falls back to mailto. Never throws. */
export async function sendReport(payload: ReportPayload): Promise<SendReportResult> {
  const nav = shareableWith(payload);

  if (nav !== null) {
    try {
      await nav.share({
        title: `Wordavi report v${payload.version}`,
        text: formatReportBody(payload),
        files: payload.screenshots,
      });
      log.info(NS, 'report sent', { channel: 'share', fileCount: payload.screenshots.length });
      return { ok: true, channel: 'share', manualAttachHint: false, droppedScreenshots: 0 };
    } catch (err) {
      log.warn(NS, 'share failed, falling back to mailto', { error: String(err) });
      return sendMailto(payload);
    }
  }

  const globalNav = typeof navigator === 'undefined' ? undefined : navigator;
  log.warn(NS, 'share unsupported, falling back to mailto', {
    shareAvailable: typeof globalNav?.share === 'function',
    canShareAvailable: typeof globalNav?.canShare === 'function',
    screenshotCount: payload.screenshots.length,
  });
  return sendMailto(payload);
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
