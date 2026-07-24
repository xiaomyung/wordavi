/**
 * SpeechSynthesis wrapper for es-ES drill prompts. Resolves the best available
 * voice asynchronously (Chrome/Android often report zero voices until the
 * `voiceschanged` event fires), tracks voice availability for the UI, and
 * exposes a small speak/warmup surface. No persistence here - rate presets
 * come from `Settings['speechRate']`; the sticky "slower" toggle lives in the
 * drill screen and is passed in per call.
 */
import { log } from '@/services/log';
import type { SpeechRate } from '@/storage';

const NS = 'tts';

const RATE_MAP: Record<SpeechRate, number> = {
  slow: 0.75,
  normal: 1,
  fast: 1.25,
};

const SLOWER_MULTIPLIER = 0.75;
const VOICES_CHANGED_TIMEOUT_MS = 1000;

export type VoiceStatus = 'es-ES' | 'es-other' | 'none';

export interface SpeakOptions {
  rate?: SpeechRate;
  slower?: boolean;
}

type VoicesChangedListener = (status: VoiceStatus) => void;

interface VoicePick {
  voice: SpeechSynthesisVoice | null;
  status: VoiceStatus;
  reason: string;
}

let cachedVoice: SpeechSynthesisVoice | null = null;
let cachedStatus: VoiceStatus = 'none';
let listenerAttached = false;
let resolvedPromise: Promise<VoiceStatus> | null = null;
let speaking = false;
/** Bumped per speak() so a cancelled utterance's late end/error can't clear a newer one's flag. */
let speakGeneration = 0;
const listeners = new Set<VoicesChangedListener>();

function synthAvailable(): boolean {
  return typeof speechSynthesis !== 'undefined';
}

function isEsEs(lang: string): boolean {
  return lang.toLowerCase() === 'es-es';
}

function isEsAny(lang: string): boolean {
  return lang.toLowerCase().startsWith('es');
}

function pickVoice(voices: SpeechSynthesisVoice[]): VoicePick {
  if (voices.length === 0) {
    return { voice: null, status: 'none', reason: 'no voices available' };
  }

  const esEsLocal = voices.find((voice) => isEsEs(voice.lang) && voice.localService);
  if (esEsLocal) {
    return { voice: esEsLocal, status: 'es-ES', reason: 'es-ES local voice' };
  }

  const esEsAny = voices.find((voice) => isEsEs(voice.lang));
  if (esEsAny) {
    return { voice: esEsAny, status: 'es-ES', reason: 'es-ES voice (non-local)' };
  }

  const esAnyLocal = voices.find((voice) => isEsAny(voice.lang) && voice.localService);
  if (esAnyLocal) {
    return {
      voice: esAnyLocal,
      status: 'es-other',
      reason: `es-* local voice (${esAnyLocal.lang})`,
    };
  }

  const esAny = voices.find((voice) => isEsAny(voice.lang));
  if (esAny) {
    return { voice: esAny, status: 'es-other', reason: `es-* voice (${esAny.lang})` };
  }

  return { voice: null, status: 'none', reason: 'no es-* voice available' };
}

function refreshVoice(trigger: string): VoiceStatus {
  const voices = speechSynthesis.getVoices();
  log.debug(NS, 'voice inventory', {
    trigger,
    count: voices.length,
    langs: voices.map((voice) => voice.lang),
  });

  const pick = pickVoice(voices);
  log.debug(NS, 'voice pick', { status: pick.status, reason: pick.reason });

  const changed = pick.status !== cachedStatus;
  cachedVoice = pick.voice;
  cachedStatus = pick.status;
  if (changed) {
    for (const listener of listeners) listener(cachedStatus);
  }
  return cachedStatus;
}

function attachPersistentListener(): void {
  if (listenerAttached || !synthAvailable()) return;
  listenerAttached = true;
  speechSynthesis.addEventListener('voiceschanged', () => {
    refreshVoice('voiceschanged');
  });
}

/**
 * Resolves the best available voice, memoized. Handles the well-known race
 * where `getVoices()` returns an empty array on first call: waits for the
 * `voiceschanged` event, bounded by a timeout so the app never hangs on
 * browsers that never fire it.
 */
export function ensureVoiceResolved(): Promise<VoiceStatus> {
  if (resolvedPromise) return resolvedPromise;

  if (!synthAvailable()) {
    cachedStatus = 'none';
    resolvedPromise = Promise.resolve(cachedStatus);
    return resolvedPromise;
  }

  attachPersistentListener();
  const voices = speechSynthesis.getVoices();
  if (voices.length > 0) {
    resolvedPromise = Promise.resolve(refreshVoice('initial sync getVoices'));
    return resolvedPromise;
  }

  log.debug(NS, 'getVoices empty on first call, waiting for voiceschanged', {
    timeoutMs: VOICES_CHANGED_TIMEOUT_MS,
  });

  resolvedPromise = new Promise((resolve) => {
    let settled = false;
    const onChanged = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(refreshVoice('voiceschanged (initial)'));
    };
    speechSynthesis.addEventListener('voiceschanged', onChanged, { once: true });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      speechSynthesis.removeEventListener('voiceschanged', onChanged);
      log.warn(NS, 'voiceschanged timed out, proceeding with whatever is available', {
        timeoutMs: VOICES_CHANGED_TIMEOUT_MS,
      });
      resolve(refreshVoice('timeout fallback'));
    }, VOICES_CHANGED_TIMEOUT_MS);
  });
  return resolvedPromise;
}

export function getVoiceStatus(): VoiceStatus {
  return cachedStatus;
}

/** Subscribe to live voice availability changes; returns an unsubscribe fn. */
export function onVoicesChanged(cb: VoicesChangedListener): () => void {
  attachPersistentListener();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isSpeaking(): boolean {
  return speaking;
}

/** Unlocks speech synthesis on iOS/Safari; call from the first user gesture. */
export function warmup(): void {
  if (!synthAvailable()) {
    log.warn(NS, 'warmup skipped: speechSynthesis unavailable', {});
    return;
  }
  log.info(NS, 'tts warmup requested', {});
  const utterance = new SpeechSynthesisUtterance('');
  utterance.volume = 0;
  speechSynthesis.speak(utterance);
}

/** Cancels any in-flight utterance, then speaks `text`. Resolves on end or error. */
export async function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  const rate = options.rate ?? 'normal';
  const slower = options.slower ?? false;

  if (!synthAvailable()) {
    log.warn(NS, 'speak skipped: speechSynthesis unavailable', { text });
    return;
  }

  log.info(NS, 'speak requested', { text, rate, slower });
  await ensureVoiceResolved();

  speakGeneration += 1;
  const generation = speakGeneration;
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  if (cachedVoice) utterance.voice = cachedVoice;
  utterance.lang = cachedVoice?.lang ?? 'es-ES';

  const baseRate = RATE_MAP[rate];
  const finalRate = slower ? baseRate * SLOWER_MULTIPLIER : baseRate;
  utterance.rate = finalRate;
  log.debug(NS, 'rate applied', { base: baseRate, slower, final: finalRate });

  return new Promise((resolve) => {
    speaking = true;
    // Only the newest utterance owns the flag: cancel() makes the previous one
    // fire onerror('canceled') *after* this one has already started.
    const settle = (): void => {
      if (generation === speakGeneration) speaking = false;
      resolve();
    };
    utterance.onend = () => {
      log.info(NS, 'speak finished', { text });
      settle();
    };
    utterance.onerror = (event) => {
      log.error(NS, 'speech synthesis error', { error: event.error, text });
      settle();
    };
    speechSynthesis.speak(utterance);
  });
}
