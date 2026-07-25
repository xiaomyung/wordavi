/**
 * WebAudio-synthesized verdict chimes - no asset files. The AudioContext is
 * created lazily on first use (creating one before a user gesture throws or
 * starts suspended on most browsers) and reused for the app's lifetime.
 */
import { log } from '@/services/log';

const NS = 'sounds';

const MASTER_GAIN = 0.15;
const NOTE_E5 = 659.25;
const NOTE_G5 = 783.99;
const NOTE_ALMOST = 440; // A4
const NOTE_WRONG = 220; // A3
const CHIRP_NOTE_SEC = 0.06; // two notes = 120ms total
const TONE_SEC = 0.16;
const ATTACK_SEC = 0.01;

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext | undefined;
  }
}

export type VerdictKind = 'correct' | 'almost' | 'wrong';

let enabled = false;
let audioCtx: AudioContext | null = null;

function getContextCtor(): typeof AudioContext | null {
  if (typeof AudioContext !== 'undefined') return AudioContext;
  const prefixed = typeof window !== 'undefined' ? window.webkitAudioContext : undefined;
  if (prefixed) {
    log.warn(NS, 'falling back to webkitAudioContext', {});
    return prefixed;
  }
  return null;
}

function ensureContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  const Ctor = getContextCtor();
  if (!Ctor) {
    log.warn(NS, 'AudioContext unavailable', {});
    return null;
  }
  audioCtx = new Ctor();
  log.debug(NS, 'AudioContext created', { state: audioCtx.state });
  return audioCtx;
}

/** Gate sounds on/off; stays off until boot applies the stored setting (default on). */
export function setEnabled(value: boolean): void {
  enabled = value;
  log.info(NS, 'sounds setEnabled', { enabled: value });
}

export function isEnabled(): boolean {
  return enabled;
}

/** Creates/resumes the AudioContext from a user gesture, alongside tts's warmup. */
export function warmup(): void {
  const ctx = ensureContext();
  if (!ctx) return;
  log.info(NS, 'sounds warmup requested', { state: ctx.state });
  if (ctx.state === 'suspended') {
    ctx.resume().catch((err: unknown) => {
      log.error(NS, 'AudioContext resume failed', { error: String(err) });
    });
  }
}

function playTone(ctx: AudioContext, freq: number, startTime: number, durationSec: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;

  const release = Math.min(0.05, durationSec / 3);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(MASTER_GAIN, startTime + ATTACK_SEC);
  gain.gain.setValueAtTime(MASTER_GAIN, startTime + durationSec - release);
  gain.gain.linearRampToValueAtTime(0, startTime + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + durationSec);
}

/** Plays a soft verdict chime. No-ops (with a debug log) when disabled. */
export function playVerdict(kind: VerdictKind): void {
  if (!enabled) {
    log.debug(NS, 'playVerdict skipped: disabled', { kind });
    return;
  }
  const ctx = ensureContext();
  if (!ctx) {
    log.warn(NS, 'playVerdict skipped: no AudioContext', { kind });
    return;
  }

  log.info(NS, 'sound played', { kind });
  const now = ctx.currentTime;
  switch (kind) {
    case 'correct':
      playTone(ctx, NOTE_E5, now, CHIRP_NOTE_SEC);
      playTone(ctx, NOTE_G5, now + CHIRP_NOTE_SEC, CHIRP_NOTE_SEC);
      break;
    case 'almost':
      playTone(ctx, NOTE_ALMOST, now, TONE_SEC);
      break;
    case 'wrong':
      playTone(ctx, NOTE_WRONG, now, TONE_SEC);
      break;
  }
}
