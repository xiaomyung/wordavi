import { useEffect } from 'react';
import { log } from '@/services/log';
import { warmup as warmupSounds } from '@/services/sounds';
import { warmup as warmupTts } from '@/services/tts';

const NS = 'app';

/** Anything that counts as "the learner touched the page" - tap, click or key. */
const GESTURE_EVENTS = ['pointerdown', 'keydown'] as const;

let warmed = false;

/**
 * Two audio unlocks that both need a user gesture and neither of which the
 * drill can ask for on its own:
 *
 * - iOS/Safari drops the first `speechSynthesis.speak()` of a session unless it
 *   is tied to a gesture, so the first prompt would be silent.
 * - the AudioContext is otherwise created during a verdict, which is not a
 *   gesture, so it starts suspended and the first chime is lost.
 *
 * The very first touch anywhere in the app pays for both, whatever it was
 * aimed at.
 */
function runWarmups(): void {
  if (warmed) return;
  warmed = true;
  log.info(NS, 'audio unlocked by first gesture');
  warmupTts();
  warmupSounds();
}

/** Listens for the first gesture, then removes itself. Returns an uninstall fn. */
function installGestureWarmup(): () => void {
  if (warmed || typeof window === 'undefined') return () => {};

  function onGesture(): void {
    uninstall();
    runWarmups();
  }

  function uninstall(): void {
    for (const type of GESTURE_EVENTS) window.removeEventListener(type, onGesture);
  }

  for (const type of GESTURE_EVENTS) window.addEventListener(type, onGesture, { passive: true });
  return uninstall;
}

/**
 * Arms the audio unlock for the session. Idempotent across mounts: once a
 * gesture has paid for it, remounting arms nothing.
 *
 * Test runs stay silent - unlocking is a browser concern, and no suite should
 * have speech or an AudioContext started under it by a stray click.
 */
export function useGestureWarmup(): void {
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return undefined;
    return installGestureWarmup();
  }, []);
}
