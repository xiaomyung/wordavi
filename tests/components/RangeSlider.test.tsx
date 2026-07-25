import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactElement, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RangeSlider, type RangeSliderProps } from '@/components/RangeSlider';

const TICKS = ['0', '10', '100', '1Т', '10Т', '100Т', '1М'] as const;

type Extra = Omit<RangeSliderProps, 'value' | 'onChange' | 'tickLabels'>;

/** Stateful wrapper: reflects onChange back into `value` like a real screen. */
function Controlled({
  start,
  onChangeSpy,
  ...rest
}: { start: [number, number]; onChangeSpy?: (v: [number, number]) => void } & Extra): ReactElement {
  const [value, setValue] = useState<[number, number]>(start);
  return (
    <RangeSlider
      value={value}
      tickLabels={TICKS}
      onChange={(next) => {
        setValue(next);
        onChangeSpy?.(next);
      }}
      {...rest}
    />
  );
}

function thumbs(): [HTMLElement, HTMLElement] {
  const [lo, hi] = screen.getAllByRole('slider');
  if (!lo || !hi) throw new Error('expected two thumbs');
  return [lo, hi];
}

const RECT: DOMRect = {
  x: 0,
  y: 0,
  left: 0,
  top: 0,
  right: 600,
  bottom: 44,
  width: 600,
  height: 44,
  toJSON: () => ({}),
};

describe('RangeSlider rendering & aria', () => {
  it('renders two slider thumbs with range aria attributes', () => {
    render(<Controlled start={[10, 1000]} />);
    const [lo, hi] = thumbs();
    expect(lo).toHaveAttribute('aria-valuemin', '0');
    expect(lo).toHaveAttribute('aria-valuemax', '1000000');
    expect(lo).toHaveAttribute('aria-valuenow', '10');
    expect(hi).toHaveAttribute('aria-valuenow', '1000');
    expect(lo).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('renders all seven tick labels', () => {
    render(<Controlled start={[0, 100]} />);
    for (const tick of TICKS) expect(screen.getByText(tick)).toBeInTheDocument();
  });

  it('uses formatValue for aria-valuetext and thumb labels for names', () => {
    render(
      <Controlled
        start={[10, 100]}
        formatValue={(n) => `#${n}`}
        minThumbLabel="от"
        maxThumbLabel="до"
      />,
    );
    const [lo, hi] = thumbs();
    expect(lo).toHaveAttribute('aria-valuetext', '#10');
    expect(lo).toHaveAttribute('aria-label', 'от');
    expect(hi).toHaveAttribute('aria-label', 'до');
  });

  it('snaps and de-crosses out-of-range incoming values for display', () => {
    render(<Controlled start={[-50, 9_999_999]} />);
    const [lo, hi] = thumbs();
    expect(lo).toHaveAttribute('aria-valuenow', '0');
    expect(hi).toHaveAttribute('aria-valuenow', '1000000');
  });
});

describe('RangeSlider geometry', () => {
  function ticks(container: HTMLElement): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>('[data-tick]')];
  }

  it('pins every tick label to its detent ratio of the rail', () => {
    const { container } = render(<Controlled start={[0, 1000]} />);
    const row = ticks(container);
    expect(row.map((tick) => tick.textContent)).toEqual([...TICKS]);
    expect(row.map((tick) => tick.style.left)).toEqual([
      '0%',
      '16.67%',
      '33.33%',
      '50%',
      '66.67%',
      '83.33%',
      '100%',
    ]);
    // The end labels hang inward; the rest centre on their detent.
    expect(row.map((tick) => tick.style.transform)).toEqual([
      'none',
      'translateX(-50%)',
      'translateX(-50%)',
      'translateX(-50%)',
      'translateX(-50%)',
      'translateX(-50%)',
      'translateX(-100%)',
    ]);
  });

  it('places 500 between the 100 and 1 000 ticks, not on top of either', () => {
    const { container } = render(<Controlled start={[0, 500]} />);
    const [lo, hi] = thumbs();
    expect(lo.style.left).toBe('0%');
    // segment 2 of 6, 400/900 of the way through it => (2 + 4/9) / 6
    expect(hi.style.left).toBe('40.74%');
    const row = ticks(container);
    const tickAt = (index: number): number => Number.parseFloat(row[index]?.style.left ?? '');
    expect(tickAt(2)).toBeLessThan(40.74);
    expect(tickAt(3)).toBeGreaterThan(40.74);
  });

  it('spans the fill between the two thumbs in the same coordinates', () => {
    const { container } = render(<Controlled start={[100, 1000]} />);
    const fill = container.querySelector<HTMLElement>('[data-slider-fill]');
    expect(fill?.style.left).toBe('33.33%');
    expect(fill?.style.right).toBe('50%');
  });
});

describe('RangeSlider focus ring', () => {
  function circleOf(thumb: HTMLElement): HTMLElement {
    const circle = thumb.firstElementChild;
    if (!(circle instanceof HTMLElement)) throw new Error('no thumb circle');
    return circle;
  }

  it('leaves the square hit target visually inert', () => {
    render(<Controlled start={[0, 500]} />);
    const [, hi] = thumbs();
    expect(hi.style.boxShadow).toBe('none');
    expect(hi.style.outline).toMatch(/^none/);
    expect(hi.style.borderRadius).toBe('50%');
  });

  it('rings the round thumb — never the hit target — while focused', () => {
    render(<Controlled start={[0, 500]} />);
    const [, hi] = thumbs();
    const circle = circleOf(hi);
    expect(circle.style.boxShadow).not.toContain('--shadow-focus');
    hi.focus();
    fireEvent.focusIn(hi);
    expect(circle.style.borderRadius).toBe('50%');
    expect(circle.style.boxShadow).toContain('var(--shadow-focus)');
    expect(hi.style.boxShadow).toBe('none');
    hi.blur();
    fireEvent.focusOut(hi);
    expect(circle.style.boxShadow).not.toContain('--shadow-focus');
  });
});

describe('RangeSlider keyboard', () => {
  it('arrow keys move by one fine step per thumb', () => {
    const spy = vi.fn();
    render(<Controlled start={[0, 100]} onChangeSpy={spy} />);
    const [lo, hi] = thumbs();
    fireEvent.keyDown(lo, { key: 'ArrowRight' });
    expect(spy).toHaveBeenLastCalledWith([1, 100]);
    fireEvent.keyDown(hi, { key: 'ArrowLeft' });
    expect(spy).toHaveBeenLastCalledWith([1, 95]);
  });

  it('PageUp jumps the lower thumb to the next detent', () => {
    const spy = vi.fn();
    render(<Controlled start={[10, 1000]} onChangeSpy={spy} />);
    const [lo] = thumbs();
    fireEvent.keyDown(lo, { key: 'PageUp' });
    expect(spy).toHaveBeenLastCalledWith([100, 1000]);
  });

  it('PageDown jumps the upper thumb to the previous detent', () => {
    const spy = vi.fn();
    render(<Controlled start={[100, 100_000]} onChangeSpy={spy} />);
    const [, hi] = thumbs();
    fireEvent.keyDown(hi, { key: 'PageDown' });
    expect(spy).toHaveBeenLastCalledWith([100, 10_000]);
  });

  it('Home/End move to the rail ends, respecting non-cross', () => {
    const spy = vi.fn();
    render(<Controlled start={[100, 1000]} onChangeSpy={spy} />);
    const [lo, hi] = thumbs();
    fireEvent.keyDown(hi, { key: 'End' });
    expect(spy).toHaveBeenLastCalledWith([100, 1_000_000]);
    fireEvent.keyDown(lo, { key: 'Home' });
    expect(spy).toHaveBeenLastCalledWith([0, 1_000_000]);
  });

  it('prevents the lower thumb from crossing the upper thumb', () => {
    const spy = vi.fn();
    render(<Controlled start={[95, 100]} onChangeSpy={spy} />);
    const [lo] = thumbs();
    fireEvent.keyDown(lo, { key: 'ArrowRight' }); // nextStop(95)=100, clamped back to 95
    expect(spy).not.toHaveBeenCalled();
    expect(lo).toHaveAttribute('aria-valuenow', '95');
  });

  it('ignores unrelated keys', () => {
    const spy = vi.fn();
    render(<Controlled start={[10, 100]} onChangeSpy={spy} />);
    const [lo] = thumbs();
    fireEvent.keyDown(lo, { key: 'a' });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('RangeSlider pointer (rect mocked)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(RECT);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('drags a single thumb to the pointer position', () => {
    const spy = vi.fn();
    render(<Controlled start={[0, 100]} onChangeSpy={spy} />);
    const [, hi] = thumbs();
    // clientX 300 of 600 => ratio 0.5 => value 1000 (segment boundary)
    fireEvent.pointerDown(hi, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(hi, { pointerId: 1, clientX: 300 });
    expect(spy).toHaveBeenLastCalledWith([0, 1000]);
    fireEvent.pointerUp(hi, { pointerId: 1 });
  });

  it('a bare-rail click moves the nearest thumb', () => {
    const spy = vi.fn();
    render(<Controlled start={[0, 100]} onChangeSpy={spy} />);
    const [lo] = thumbs();
    const rail = lo.parentElement;
    if (!rail) throw new Error('no rail');
    // ratio 0.5 => 1000, which is above hi(100) => the hi thumb moves
    fireEvent.pointerDown(rail, { pointerId: 2, clientX: 300 });
    expect(spy).toHaveBeenLastCalledWith([0, 1000]);
  });

  it('dragging the filled span moves both thumbs in the same direction', () => {
    const spy = vi.fn();
    const { container } = render(<Controlled start={[10, 100]} onChangeSpy={spy} />);
    const fill = container.querySelector('[data-slider-fill]');
    if (!fill) throw new Error('no fill');
    fireEvent.pointerDown(fill, { pointerId: 3, clientX: 150 }); // startRatio 0.25
    fireEvent.pointerMove(fill, { pointerId: 3, clientX: 210 }); // +0.10 ratio to the right
    expect(spy).toHaveBeenCalled();
    const last = spy.mock.calls.at(-1)?.[0] as [number, number];
    expect(last[0]).toBeGreaterThan(10);
    expect(last[1]).toBeGreaterThan(100);
    fireEvent.pointerUp(fill, { pointerId: 3 });
  });
});

describe('RangeSlider onChangeCommitted', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(RECT);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fires once at the end of a drag, with the settled value', () => {
    const changes = vi.fn();
    const committed = vi.fn();
    render(<Controlled start={[0, 100]} onChangeSpy={changes} onChangeCommitted={committed} />);
    const [, hi] = thumbs();
    fireEvent.pointerDown(hi, { pointerId: 1, clientX: 0 });
    fireEvent.pointerMove(hi, { pointerId: 1, clientX: 250 }); // ratio .4166 => 550
    fireEvent.pointerMove(hi, { pointerId: 1, clientX: 300 }); // ratio .5    => 1000
    expect(changes.mock.calls.length).toBeGreaterThan(1);
    expect(committed).not.toHaveBeenCalled();
    fireEvent.pointerUp(hi, { pointerId: 1 });
    expect(committed).toHaveBeenCalledTimes(1);
    expect(committed).toHaveBeenLastCalledWith([0, 1000]);
  });

  it('fires once on key release, however many steps the press produced', () => {
    const committed = vi.fn();
    render(<Controlled start={[0, 100]} onChangeCommitted={committed} />);
    const [, hi] = thumbs();
    fireEvent.keyDown(hi, { key: 'ArrowLeft' });
    fireEvent.keyDown(hi, { key: 'ArrowLeft' });
    expect(committed).not.toHaveBeenCalled();
    fireEvent.keyUp(hi, { key: 'ArrowLeft' });
    expect(committed).toHaveBeenCalledTimes(1);
    expect(committed).toHaveBeenLastCalledWith([0, 90]);
  });

  it('stays silent when the interaction moved nothing', () => {
    const committed = vi.fn();
    render(<Controlled start={[0, 100]} onChangeCommitted={committed} />);
    const [lo] = thumbs();
    fireEvent.keyDown(lo, { key: 'ArrowLeft' }); // already at the floor
    fireEvent.keyUp(lo, { key: 'ArrowLeft' });
    expect(committed).not.toHaveBeenCalled();
  });

  it('flushes a pending change on blur', () => {
    const committed = vi.fn();
    render(<Controlled start={[0, 100]} onChangeCommitted={committed} />);
    const [, hi] = thumbs();
    fireEvent.keyDown(hi, { key: 'ArrowLeft' });
    fireEvent.focusOut(hi);
    expect(committed).toHaveBeenCalledTimes(1);
    expect(committed).toHaveBeenLastCalledWith([0, 95]);
  });
});

describe('RangeSlider disabled', () => {
  it('marks thumbs disabled and out of tab order', () => {
    render(<Controlled start={[10, 100]} disabled />);
    const [lo, hi] = thumbs();
    expect(lo).toBeDisabled();
    expect(lo).toHaveAttribute('tabindex', '-1');
    expect(hi).toHaveAttribute('aria-disabled', 'true');
  });
});
