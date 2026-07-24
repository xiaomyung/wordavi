import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactElement, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StopSlider, type StopSliderProps } from '@/components/StopSlider';

const STOPS = ['медленно', 'обычная', 'быстро'] as const;

type Extra = Omit<StopSliderProps, 'stops' | 'index' | 'onChange'>;

function Controlled({
  start,
  onChangeSpy,
  ...rest
}: { start: number; onChangeSpy?: (i: number) => void } & Extra): ReactElement {
  const [index, setIndex] = useState(start);
  return (
    <StopSlider
      stops={STOPS}
      index={index}
      onChange={(next) => {
        setIndex(next);
        onChangeSpy?.(next);
      }}
      {...rest}
    />
  );
}

function thumb(): HTMLElement {
  return screen.getByRole('slider');
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

describe('StopSlider rendering & aria', () => {
  it('exposes index-based aria with the current label as valuetext', () => {
    render(<Controlled start={1} ariaLabel="Скорость речи" />);
    const el = thumb();
    expect(el).toHaveAttribute('aria-valuemin', '0');
    expect(el).toHaveAttribute('aria-valuemax', '2');
    expect(el).toHaveAttribute('aria-valuenow', '1');
    expect(el).toHaveAttribute('aria-valuetext', 'обычная');
    expect(el).toHaveAttribute('aria-label', 'Скорость речи');
  });

  it('renders every stop label as a tick', () => {
    render(<Controlled start={0} />);
    for (const stop of STOPS) expect(screen.getByText(stop)).toBeInTheDocument();
  });

  it('clamps an out-of-range index for display', () => {
    render(<Controlled start={9} />);
    expect(thumb()).toHaveAttribute('aria-valuenow', '2');
  });
});

describe('StopSlider keyboard', () => {
  it('arrow keys step one stop and clamp at the ends', () => {
    const spy = vi.fn();
    render(<Controlled start={1} onChangeSpy={spy} />);
    const el = thumb();
    fireEvent.keyDown(el, { key: 'ArrowRight' });
    expect(spy).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(el, { key: 'ArrowRight' }); // already at last stop
    expect(spy).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(el, { key: 'ArrowLeft' });
    expect(spy).toHaveBeenLastCalledWith(1);
  });

  it('Home and End jump to the first and last stop', () => {
    const spy = vi.fn();
    render(<Controlled start={1} onChangeSpy={spy} />);
    const el = thumb();
    fireEvent.keyDown(el, { key: 'End' });
    expect(spy).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(el, { key: 'Home' });
    expect(spy).toHaveBeenLastCalledWith(0);
  });

  it('ignores unrelated keys', () => {
    const spy = vi.fn();
    render(<Controlled start={1} onChangeSpy={spy} />);
    fireEvent.keyDown(thumb(), { key: 'b' });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('StopSlider pointer (rect mocked)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(RECT);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('snaps a rail click to the nearest stop', () => {
    const spy = vi.fn();
    render(<Controlled start={1} onChangeSpy={spy} />);
    const rail = thumb().parentElement;
    if (!rail) throw new Error('no rail');
    fireEvent.pointerDown(rail, { pointerId: 1, clientX: 600 }); // ratio 1 => index 2
    expect(spy).toHaveBeenLastCalledWith(2);
    fireEvent.pointerMove(rail, { pointerId: 1, clientX: 0 }); // ratio 0 => index 0
    expect(spy).toHaveBeenLastCalledWith(0);
    fireEvent.pointerUp(rail, { pointerId: 1 });
  });
});

describe('StopSlider disabled', () => {
  it('marks the thumb disabled and out of tab order', () => {
    render(<Controlled start={1} disabled />);
    const el = thumb();
    expect(el).toBeDisabled();
    expect(el).toHaveAttribute('tabindex', '-1');
    expect(el).toHaveAttribute('aria-disabled', 'true');
  });
});
