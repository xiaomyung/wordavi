/**
 * SpeechRecognition wrapper (webkit-prefixed on most browsers) for the voice
 * answer mode. Pre-checks connectivity - recognition services are
 * network-backed and fail confusingly offline - and normalizes vendor error
 * codes down to the small set screens need to react to.
 */
import { log } from '@/services/log';

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

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
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
    log.error(NS, 'recognition error', { code: event.error, kind });
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
