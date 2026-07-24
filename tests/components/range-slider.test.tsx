import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactElement, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RangeSlider, type RangeSliderProps } from '@/components/RangeSlider';

const TICKS = ['0', '10', '100', '1 тыс', '10 тыс', '100 тыс', '1 млн'] as const;

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

describe('RangeSlider disabled', () => {
  it('marks thumbs disabled and out of tab order', () => {
    render(<Controlled start={[10, 100]} disabled />);
    const [lo, hi] = thumbs();
    expect(lo).toBeDisabled();
    expect(lo).toHaveAttribute('tabindex', '-1');
    expect(hi).toHaveAttribute('aria-disabled', 'true');
  });
});
