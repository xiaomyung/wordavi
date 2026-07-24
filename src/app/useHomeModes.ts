/**
 * The home screen's mode rows.
 *
 * Modes declare the capabilities they need; only the app layer may ask the
 * services whether those capabilities are actually there, and only it may
 * translate the modes' i18n keys. Both answers can change while the learner is
 * looking at the list — the network drops, a Spanish voice pack finishes
 * installing — so the rows stay subscribed rather than sampling once.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Capability, LearningMode } from '@/modes';
import { allModes } from '@/modes';
import type { HomeModeItem, HomeModeStatus } from '@/screens/HomeScreen';
import { useOnline } from '@/screens/HomeScreen';
import { isRecognitionSupported } from '@/services/speech';
import type { VoiceStatus } from '@/services/tts';
import { getVoiceStatus, onVoicesChanged } from '@/services/tts';

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

/** Live voice availability. `bootstrap` kicks off the initial resolution. */
function useVoiceStatus(): VoiceStatus {
  const [status, setStatus] = useState(getVoiceStatus);

  useEffect(() => {
    const unsubscribe = onVoicesChanged(setStatus);
    return () => {
      unsubscribe();
    };
  }, []);

  return status;
}

export function useHomeModes(): HomeModeItem[] {
  const { t } = useTranslation();
  const online = useOnline();
  const voice = useVoiceStatus();
  // Whether the browser has SpeechRecognition at all is a static fact — unlike
  // a voice pack, it cannot appear mid-session.
  const micSupported = useMemo(() => isRecognitionSupported(), []);

  return useMemo(
    () =>
      allModes().map((mode) => ({
        id: mode.id,
        // Mode label keys are plain strings by contract, so they go through the
        // untyped-key overload; the key itself is the fallback.
        title: t(mode.titleKey, { defaultValue: mode.titleKey }),
        example: t(mode.exampleKey, { defaultValue: mode.exampleKey }),
        status: modeStatus(mode, online, voice, micSupported),
      })),
    [t, online, voice, micSupported],
  );
}
