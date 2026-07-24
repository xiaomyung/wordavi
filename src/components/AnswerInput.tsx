import type { KeyboardEvent, Ref } from 'react';
import { useCallback, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { cx } from './cx';
import { Stamp, type Verdict } from './Stamp';
import './answer-controls.css';

export type AnswerMode = 'words' | 'digits';

/**
 * Imperative surface exposed via `ref`. `insertAtCaret` powers the accent-key
 * row (accent-keys.md): it splices a character in at the current caret and
 * flashes it accent-coloured for --duration-flash. `focus` re-focuses the field.
 */
export interface AnswerInputHandle {
  insertAtCaret(char: string): void;
  focus(): void;
}

export interface AnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired when the user presses Enter (never inserts a newline). */
  onSubmit?: () => void;
  /**
   * Setting a verdict freezes the field read-only, swaps the border to the
   * verdict colour, and reveals the inline stamp. The field NEVER shakes.
   */
  verdict?: Verdict;
  /**
   * `words` → default keyboard (`inputmode="text"`); `digits` →
   * `inputmode="decimal"` (comma decimals) + tabular figures.
   */
  mode: AnswerMode;
  /**
   * Faint hint text. The caller MUST ensure it never contains the expected
   * answer — placeholders are below AA contrast and carry no information (a11y.md).
   */
  placeholder?: string;
  className?: string;
  id?: string;
  'aria-label'?: string;
  ref?: Ref<AnswerInputHandle>;
}

const MAX_LINES = 2;

export function AnswerInput({
  value,
  onChange,
  onSubmit,
  verdict,
  mode,
  placeholder,
  className,
  id,
  ref,
  ...rest
}: AnswerInputProps) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const readOnly = verdict !== undefined;

  const spawnFlash = useCallback(
    (area: HTMLTextAreaElement, index: number, char: string) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const style = getComputedStyle(area);
      const mirror = document.createElement('span');
      mirror.textContent = value.slice(0, index);
      mirror.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
      mirror.style.font = style.font;
      wrap.appendChild(mirror);
      const left = (Number.parseFloat(style.paddingLeft) || 16) + mirror.offsetWidth;
      wrap.removeChild(mirror);

      const flash = document.createElement('span');
      flash.className = 'wa-input-flash';
      flash.setAttribute('aria-hidden', 'true');
      flash.textContent = char;
      flash.style.left = `${left}px`;
      flash.style.top = `${Number.parseFloat(style.paddingTop) || 14}px`;
      wrap.appendChild(flash);
      const remove = () => flash.remove();
      flash.addEventListener('animationend', remove, { once: true });
      window.setTimeout(remove, 500);
    },
    [value],
  );

  // Auto-grow from one line to at most two, then clip (single-line semantics).
  // Re-measures via the live DOM whenever the text / layout changes; the deps
  // are the change triggers, not values read in the body.
  // biome-ignore lint/correctness/useExhaustiveDependencies: value/verdict/mode are re-run triggers for a DOM measurement, not read directly.
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = 'auto';
    if (!area.scrollHeight) return;
    const style = getComputedStyle(area);
    const line =
      Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.35 || 24;
    const padY =
      (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
    const borderY =
      (Number.parseFloat(style.borderTopWidth) || 0) +
      (Number.parseFloat(style.borderBottomWidth) || 0);
    const maxHeight = Math.ceil(line * MAX_LINES + padY + borderY);
    area.style.height = `${Math.min(area.scrollHeight, maxHeight)}px`;
  }, [value, verdict, mode]);

  // Restore the caret after the controlled re-render triggered by insertAtCaret;
  // must run once the new value has committed to the DOM.
  // biome-ignore lint/correctness/useExhaustiveDependencies: value is the commit trigger; the body reads only refs.
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (area && pendingCaret.current !== null) {
      area.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [value]);

  useImperativeHandle(
    ref,
    () => ({
      focus() {
        areaRef.current?.focus();
      },
      insertAtCaret(char: string) {
        const area = areaRef.current;
        if (!area || readOnly) return;
        const start = area.selectionStart ?? value.length;
        const end = area.selectionEnd ?? value.length;
        pendingCaret.current = start + char.length;
        spawnFlash(area, start, char);
        onChange(value.slice(0, start) + char + value.slice(end));
      },
    }),
    [value, onChange, readOnly, spawnFlash],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSubmit?.();
    }
  }

  return (
    <div ref={wrapRef} className={cx('wa-input-wrap', className)}>
      <textarea
        ref={areaRef}
        id={id}
        className="wa-input"
        rows={1}
        value={value}
        readOnly={readOnly}
        inputMode={mode === 'digits' ? 'decimal' : 'text'}
        data-mode={mode}
        data-verdict={verdict}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-label={rest['aria-label']}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
      {verdict !== undefined && (
        <span className="wa-input-stamp">
          <Stamp verdict={verdict} animate />
        </span>
      )}
    </div>
  );
}
