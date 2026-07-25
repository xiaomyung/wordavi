import { useTranslation } from 'react-i18next';
import { Button, Chip, ProgressRule } from '@/components';
import type { RoundSize, Score } from '@/session';

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export interface DrillHeaderProps {
  /** 1-based number of the question on stage. */
  step: number;
  size: RoundSize;
  score: Score;
  onLeave: () => void;
}

/**
 * The shared drill header: leave button, progress, counter, then the score row.
 * Identical in all six modes — only the stage and answer zone below it swap
 * (design README). Endless rounds drop the rule and count against ∞ instead.
 */
export function DrillHeader({ step, size, score, onLeave }: DrillHeaderProps) {
  const { t } = useTranslation();
  const endless = size === 'endless';
  const total = endless ? 0 : size;
  const shown = endless ? step : Math.min(step, total);

  return (
    <header className="flex flex-col gap-3 px-screen pt-3">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="icon"
          onClick={onLeave}
          aria-label={endless ? t('drill.end_round') : t('common.close')}
        >
          <CloseIcon />
        </Button>
        {!endless && (
          <ProgressRule
            value={shown}
            max={total}
            className="flex-1"
            // The rule is the visual twin of the counter beside it; naming it
            // the same way keeps the bar from reaching a screen reader unnamed.
            aria-label={t('drill.counter', { n: shown, total })}
          />
        )}
        <span
          className={`numerals font-bold text-caption text-text-muted ${endless ? 'flex-1 text-right' : ''}`}
        >
          {endless
            ? t('drill.counter_endless', { n: shown })
            : t('drill.counter', { n: shown, total })}
        </span>
      </div>
      <div className="flex justify-end gap-1.5">
        <Chip variant="score" tick={score.points}>
          {score.points}
          <small className="font-semibold text-text-muted">{t('drill.points')}</small>
        </Chip>
        {score.combo > 1 && (
          <Chip variant="combo" tick={score.combo}>
            ×{score.combo}
          </Chip>
        )}
      </div>
    </header>
  );
}
