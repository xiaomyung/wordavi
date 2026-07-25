import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cx } from './cx';
import { Pressable } from './Pressable';

export type ChoiceState = 'idle' | 'selected' | 'revealedCorrect' | 'chosenWrong';

// idle keeps its raised 2px underside; every other state is flat (choice-buttons.md).
const STATE: Record<ChoiceState, string> = {
  idle: 'border-border bg-surface-raised',
  selected: 'border-accent bg-accent-tint',
  revealedCorrect: 'border-correct bg-correct-tint',
  chosenWrong: 'border-wrong bg-wrong-tint',
};

export interface ChoiceButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  state?: ChoiceState;
  /** Grid locked after reveal: idle tiles stay idle but become inert (no press). */
  locked?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * The tile's own 22px verdict stamp (no size token) — circled check / cross,
 * currentColor stroke. Deliberately not the shared `Stamp`: that one is the
 * 26px answer-field stamp with its pop animation.
 */
function TileStamp({ kind }: { kind: 'check' | 'cross' }) {
  return (
    <span
      className={cx(
        'inline-flex size-[1.375rem] shrink-0 -rotate-[8deg] items-center justify-center rounded-full border-2',
        kind === 'check' ? 'text-correct' : 'text-wrong',
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3.5"
        aria-hidden="true"
      >
        {kind === 'check' ? <path d="M5 13l4 4L19 7" /> : <path d="M6 6l12 12M18 6L6 18" />}
      </svg>
    </span>
  );
}

/**
 * Multiple-choice tile (2x2 grid). --text-choice numeral (26, tabular). After
 * reveal it is non-interactive: aria-disabled, no press physics, click ignored.
 */
export function ChoiceButton({
  children,
  state = 'idle',
  locked = false,
  className,
  onClick,
  ref,
  ...rest
}: ChoiceButtonProps) {
  const revealed = state === 'revealedCorrect' || state === 'chosenWrong';
  const inert = locked || revealed;
  return (
    <Pressable
      ref={ref}
      depth="raised"
      flat={state !== 'idle'}
      aria-disabled={inert || undefined}
      aria-pressed={state === 'selected' || undefined}
      onClick={inert ? undefined : onClick}
      className={cx(
        'flex h-(--size-choice) w-full items-center justify-center gap-2 rounded-button border-2',
        'font-display text-choice font-bold text-text numerals',
        STATE[state],
        className,
      )}
      {...rest}
    >
      {children}
      {state === 'revealedCorrect' && <TileStamp kind="check" />}
      {state === 'chosenWrong' && <TileStamp kind="cross" />}
    </Pressable>
  );
}
