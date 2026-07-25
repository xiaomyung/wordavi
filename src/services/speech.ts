/**
 * SpeechRecognition wrapper (webkit-prefixed on most browsers) for the voice
 * answer mode. Pre-checks connectivity - recognition services are
 * network-backed and fail confusingly offline - and normalizes vendor error
 * codes down to the small set screens need to react to.
 */
import { log } from '@/services/log';
import { isOnline } from '@/services/online';

const NS = 'speech';
const MAX_ALTERNATIVES = 5;
const DEFAULT_LANG = 'es-ES';

export type RecognitionErrorKind = 'no-speech' | 'denied' | 'network' | 'aborted' | 'other';

export interface StartRecognitionOptions {
  lang?: string;
  interim?: (text: string) => void;
  onFinal: (alternatives: string[]) => void;
  onError: (kind: RecognitionErrorKind) => void;
}

export interface RecognitionHandle {
  stop: () => void;
}

const NOOP_HANDLE: RecognitionHandle = { stop: () => undefined };

function getRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function isRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

function mapErrorCode(code: SpeechRecognitionErrorCode): RecognitionErrorKind {
  switch (code) {
    case 'no-speech':
      return 'no-speech';
    case 'not-allowed':
    case 'service-not-allowed':
      return 'denied';
    case 'network':
      return 'network';
    case 'aborted':
      return 'aborted';
    default:
      return 'other';
  }
}

function collectAlternatives(result: SpeechRecognitionResult): string[] {
  const alternatives: string[] = [];
  for (let i = 0; i < result.length; i += 1) {
    const alt = result[i];
    if (alt) alternatives.push(alt.transcript);
  }
  return alternatives;
}

/** Starts recognition; returns a handle whose stop() ends it early. */
export function startRecognition(options: StartRecognitionOptions): RecognitionHandle {
  const lang = options.lang ?? DEFAULT_LANG;

  if (!isOnline()) {
    log.warn(NS, 'recognition blocked: offline', { lang });
    options.onError('network');
    return NOOP_HANDLE;
  }

  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    log.warn(NS, 'recognition unsupported in this browser', { lang });
    options.onError('other');
    return NOOP_HANDLE;
  }

  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = MAX_ALTERNATIVES;

  let stopped = false;

  recognition.onresult = (event) => {
    const result = event.results[event.resultIndex];
    if (!result) return;
    if (result.isFinal) {
      const alternatives = collectAlternatives(result);
      log.debug(NS, 'recognition alternatives received', { alternatives });
      options.onFinal(alternatives);
    } else {
      const alt = result[0];
      if (alt) options.interim?.(alt.transcript);
    }
  };

  recognition.onerror = (event) => {
    const kind = mapErrorCode(event.error);
    // Saying nothing, or the screen stopping recognition, is ordinary drill
    // traffic — only a genuinely broken recogniser is an error.
    if (kind === 'no-speech' || kind === 'aborted') {
      log.warn(NS, 'recognition error', { code: event.error, kind });
    } else {
      log.error(NS, 'recognition error', { code: event.error, kind });
    }
    // A 'network' error while the tab is online is not a connectivity problem:
    // the browser ships the API but its cloud recogniser is unreachable (Brave
    // and other Chromium forks). The kind stays honest - callers tell the two
    // apart by asking `navigator.onLine` themselves - but the distinction is
    // worth a breadcrumb in a report from a learner who "had internet".
    if (kind === 'network' && isOnline()) {
      log.warn(NS, 'recognition backend unreachable', { online: true });
    }
    options.onError(kind);
  };

  recognition.onend = () => {
    log.info(NS, 'recognition ended', { lang, explicitStop: stopped });
  };

  log.info(NS, 'recognition start requested', { lang, maxAlternatives: MAX_ALTERNATIVES });
  try {
    recognition.start();
  } catch (err) {
    log.error(NS, 'recognition start threw', { error: String(err) });
    options.onError('other');
    return NOOP_HANDLE;
  }

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      log.info(NS, 'recognition stop requested', { lang });
      recognition.stop();
    },
  };
}
