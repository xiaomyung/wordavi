/**
 * navigator.vibrate wrapper per motion.md. Silently no-ops on unsupported
 * devices (most desktops, iOS Safari) - warns once so it shows up in
 * diagnostics without spamming the log on every drill answer.
 */
import { log } from '@/services/log';

const NS = 'haptics';

const TICK_MS = 15;
const DAY_STAMP_MS = 20;
const WRONG_REVEAL_PATTERN = [15, 60, 15];

let warnedUnsupported = false;

export function isHapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function fire(pattern: number | number[], label: string): void {
  if (!isHapticsSupported()) {
    if (!warnedUnsupported) {
      warnedUnsupported = true;
      log.warn(NS, 'vibrate unsupported', { label });
    }
    return;
  }
  log.info(NS, 'haptic fired', { label, pattern });
  navigator.vibrate(pattern);
}

/** Short tick on a correct answer. */
export function tick(): void {
  fire(TICK_MS, 'tick-correct');
}

/** Double pulse when revealing the correct answer after a wrong one. */
export function wrongReveal(): void {
  fire(WRONG_REVEAL_PATTERN, 'wrong-reveal');
}

/** Medium pulse for the daily-goal stamp. */
export function dayStamp(): void {
  fire(DAY_STAMP_MS, 'day-stamp');
}
