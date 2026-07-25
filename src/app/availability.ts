/**
 * Which modes the browser can actually serve right now.
 *
 * Modes declare the capabilities they need; only the app layer may ask the
 * services whether those capabilities are really there. Two screens need that
 * answer — home dashes out the rows it cannot start, and the drill tells the
 * mixed mode which modes it may draw from — so the rule lives here once rather
 * than in each of them.
 */
import type { Capability, LearningMode, ModeId } from '@/modes';
import { allModes } from '@/modes';
import type { HomeModeStatus } from '@/screens/HomeScreen';
import { isRecognitionSupported } from '@/services/speech';
import type { VoiceStatus } from '@/services/tts';
import { getVoiceStatus } from '@/services/tts';

/** Speech recognition is network-backed, and so is a voice the browser streams. */
function needsNetwork(requires: readonly Capability[]): boolean {
  return requires.includes('tts') || requires.includes('speech');
}

/**
 * Why a row is dashed out, most general reason first: offline explains itself
 * best, and a missing voice is worth saying before a missing microphone.
 */
export function modeStatus(
  mode: LearningMode,
  online: boolean,
  voice: VoiceStatus,
  micSupported: boolean,
): HomeModeStatus {
  if (!online && needsNetwork(mode.requires)) return 'paused-offline';
  if (voice === 'none' && mode.requires.includes('tts')) return 'paused-voice';
  if (!micSupported && mode.requires.includes('speech')) return 'paused-mic';
  return 'ok';
}

/** The modes that are startable under the given capabilities. */
export function availableModeIds(
  online: boolean,
  voice: VoiceStatus,
  micSupported: boolean,
): ModeId[] {
  return allModes()
    .filter((mode) => modeStatus(mode, online, voice, micSupported) === 'ok')
    .map((mode) => mode.id);
}

/**
 * The same list, sampled from the live services. A one-shot read (unlike the
 * home rows, which stay subscribed): a round picks its mix when it starts.
 */
export function currentAvailableModeIds(): ModeId[] {
  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  return availableModeIds(online, getVoiceStatus(), isRecognitionSupported());
}
