import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, VerdictBlock } from '@/components';
import type {
  DrillServices,
  LearningMode,
  ModeId,
  ModeLabels,
  RecognitionErrorKind,
} from '@/modes';
import { findMode, MIXED_MODE_ID, setMixedAvailability } from '@/modes';
import { log } from '@/services/log';
import { isOnline } from '@/services/online';
import { startRecognition } from '@/services/speech';
import { showToast } from '@/services/toast';
import { isSpeaking, speak } from '@/services/tts';
import type { RoundSummary } from '@/session';
import type { SavedRound, SpeechRate } from '@/storage';
import { DrillHeader } from './drill/DrillHeader';
import './drill/drill.css';
import { useDrillRound } from './drill/useDrillRound';
import { useKeyboardInset } from './drill/useKeyboardInset';
import { verdictCopyOf } from './drill/verdict-copy';
import { expectedDisplayOf } from './expected';

const NS = 'drill';
const RECOGNITION_LANG = 'es-ES';

export interface DrillScreenProps {
  modeId: string;
  /**
   * The modes a mixed round may draw from. Only the app layer may ask the
   * services which capabilities are really there, so the answer arrives as a
   * prop; omitting it leaves the mix unrestricted (every mode is fair game).
   */
  availableModeIds?: readonly ModeId[];
  /** Unfinished round from storage; resumed when it belongs to `modeId`. */
  resume?: SavedRound;
  /** "Retry the missed": replay this summary's misses instead of a fresh round. */
  retryOf?: RoundSummary;
  onFinish: (summary: RoundSummary) => void;
  /** Leave without ending the round — the saved round stays resumable. */
  onExit: () => void;
}

/**
 * Splits the mode title on its arrow so the arrow can carry the accent colour,
 * exactly as the mockups render the stage overline ("число → словами").
 */
function ModeOverline({ title }: { title: string }) {
  const [head, ...tail] = title.split('→');
  if (tail.length === 0) return <>{title}</>;
  return (
    <>
      {head}
      <b className="font-extrabold text-accent">→</b>
      {tail.join('→')}
    </>
  );
}

/**
 * Service handles handed to the mode's Prompt/AnswerZone. The modes layer may
 * not import `@/services` (layer contract), so the drill screen is the seam
 * that binds the learner's speech-rate setting to every utterance.
 */
function useDrillServices(speechRate: SpeechRate): DrillServices {
  return useMemo<DrillServices>(
    () => ({
      // Spanish content only — the UI language never reaches the synthesiser.
      speak: (text, opts) => speak(text, { rate: speechRate, slower: opts?.slower ?? false }),
      isSpeaking,
      startRecognition: (handlers) => startRecognition({ ...handlers, lang: RECOGNITION_LANG }),
    }),
    [speechRate],
  );
}

export function DrillScreen(props: DrillScreenProps) {
  const mode = findMode(props.modeId);
  if (mode === undefined) {
    // Home only offers registered modes, so this is a stale `lastMode` from an
    // older build. Render nothing rather than a broken drill.
    log.error(NS, 'unknown mode', { modeId: props.modeId });
    return null;
  }
  if (mode.id === MIXED_MODE_ID) {
    // The mix may only draw from modes this browser can serve. Pushed in here
    // rather than at the button that started the round, so a resumed or retried
    // mixed round is filtered by the capabilities of *this* moment. Idempotent:
    // re-running it on a re-render writes the same list.
    setMixedAvailability(props.availableModeIds ?? null);
  }
  return <DrillRunner {...props} mode={mode} />;
}

type DrillRunnerProps = DrillScreenProps & { mode: LearningMode };

function DrillRunner({ mode, modeId, resume, retryOf, onFinish, onExit }: DrillRunnerProps) {
  const { t } = useTranslation();
  const round = useDrillRound({ modeId, source: mode.source, resume, retryOf, onFinish });
  const { question, record, swapping, finish } = round;

  /* Sticky for the whole round: turning playback down once should stay down. */
  const [slower, setSlower] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  /* Sticky for the whole round: a recogniser that failed once while online is
     not going to answer the next question either. */
  const [recognitionUnavailable, setRecognitionUnavailable] = useState(false);
  const keyboardInset = useKeyboardInset();
  const services = useDrillServices(round.settings.speechRate);

  const labels = useMemo<ModeLabels>(
    // Mode label keys are plain strings by contract, so they go through the
    // untyped-key overload; the key itself is the fallback if a string is missing.
    () => Object.fromEntries(mode.labelKeys.map((key) => [key, t(key, { defaultValue: key })])),
    // `t` is re-created by useTranslation on every language change, so it alone
    // is enough to re-resolve the labels.
    [mode.labelKeys, t],
  );

  const onToggleSlower = useCallback(() => {
    setSlower((value) => !value);
  }, []);

  const onMicDenied = useCallback(() => {
    setMicDenied(true);
    showToast({ text: t('drill.mic_denied') });
    log.warn(NS, 'microphone denied', { modeId });
  }, [t, modeId]);

  /**
   * The screens layer is the only one allowed to ask *why* a recognition attempt
   * failed with `network`. Offline is already answered elsewhere (the offline
   * toast below, plus the mode's own inline "no internet" hint). Online means the
   * browser exposes SpeechRecognition without a reachable recogniser behind it -
   * Brave, and Chromium forks in general - so holding the mic again would only
   * repeat the failure: it retires for the rest of the round and the zone settles
   * into typing, exactly as it does for a denied microphone.
   */
  const onRecognitionError = useCallback(
    (kind: RecognitionErrorKind) => {
      if (kind !== 'network' || !isOnline()) return;
      setRecognitionUnavailable(true);
      log.warn(NS, 'recognition unavailable: falling back to typing for the round', { modeId });
    },
    [modeId],
  );

  /* Voice modes need the network. Offer to end the round rather than stranding
     the learner on a question they cannot answer. */
  useEffect(() => {
    if (!mode.requires.includes('speech')) return;
    const offer = (): void => {
      showToast({
        text: t('toasts.offline'),
        action: { label: t('drill.end_round'), onPress: finish },
      });
    };
    if (!isOnline()) offer();
    window.addEventListener('offline', offer);
    return () => window.removeEventListener('offline', offer);
  }, [mode.requires, t, finish]);

  const endless = round.size === 'endless';
  const expectedDisplay = question === null ? '' : expectedDisplayOf(question);
  const verdictCopy =
    record === null ? null : verdictCopyOf(record, expectedDisplay, round.score.combo, t);
  const swapClass = swapping ? 'wa-prompt-exit' : 'wa-prompt-enter';
  const swapKey = `${round.step}:${question?.id ?? 'none'}`;

  const Prompt = mode.Prompt;
  const AnswerZone = mode.AnswerZone;
  // A composite mode names the mode each question actually came from; a single
  // mode has one title for the whole round.
  const titleKey = (question === null ? undefined : mode.titleKeyFor?.(question)) ?? mode.titleKey;

  return (
    <div className="screen safe-top safe-x" data-mode={mode.id}>
      <DrillHeader
        step={round.step}
        size={round.size}
        score={round.score}
        // Endless has no natural end: its close button finishes the round and
        // shows the summary. Fixed rounds keep the saved round for a resume.
        onLeave={endless ? finish : onExit}
      />

      <main className="screen-content flex flex-col items-center justify-center px-screen">
        {question !== null && (
          <div
            key={swapKey}
            className={`flex flex-col items-center gap-3.5 text-center ${swapClass}`}
          >
            <p
              data-testid="mode-overline"
              className="font-extrabold text-overline text-text-muted lowercase tracking-wide"
            >
              <ModeOverline title={t(titleKey, { defaultValue: titleKey })} />
            </p>
            <Prompt
              question={question}
              services={services}
              slower={slower}
              onToggleSlower={onToggleSlower}
              labels={labels}
            />
          </div>
        )}
      </main>

      <section
        className="safe-bottom flex flex-col gap-3 px-screen pb-5"
        style={keyboardInset > 0 ? { paddingBottom: `${keyboardInset}px` } : undefined}
      >
        {question !== null && (
          <div key={swapKey} className={`flex flex-col gap-3 ${swapClass}`}>
            <AnswerZone
              question={question}
              services={services}
              verdict={record?.verdict ?? null}
              expectedDisplay={expectedDisplay}
              onSubmit={round.submit}
              micDenied={micDenied}
              onMicDenied={onMicDenied}
              recognitionUnavailable={recognitionUnavailable}
              onRecognitionError={onRecognitionError}
              labels={labels}
            />
            {/* A wrong answer is corrected, never punished: no shake, no red
                flood — just the stamp, the right answer and a promise it
                returns (a11y.md / copy.md). */}
            {record !== null && verdictCopy !== null && (
              <VerdictBlock
                verdict={record.verdict}
                title={verdictCopy.title}
                sub={verdictCopy.sub}
              />
            )}
            {record !== null && (
              <Button type="button" onClick={round.advance}>
                {t('common.next')}
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
