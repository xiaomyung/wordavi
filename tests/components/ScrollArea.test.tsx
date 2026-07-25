import { act, fireEvent, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScrollArea, scrollThumbGeometry, scrollTopFromDrag } from '@/components/ScrollArea';

/* One scroll state used by every DOM spec below: 1000px of content seen through
   a 400px viewport, on a 380px rail (the rail is inset from both ends).
     thumb height = 400/1000 * 380 = 152
     travel       = 380 - 152      = 228
     scrollable   = 1000 - 400     = 600
   so a quarter of the way down (scrollTop 150) the thumb sits at 57px. The
   numbers were picked to stay whole, so a failure reads as a real geometry bug
   rather than as float dust. */
const SCROLL_HEIGHT = 1000;
const CLIENT_HEIGHT = 400;
const TRACK_HEIGHT = 380;

/** happy-dom reports 0 for every layout metric, so each one is pinned by hand. */
function fixMetric(el: Element, name: 'scrollHeight' | 'clientHeight', value: number): void {
  Object.defineProperty(el, name, { value, configurable: true });
}

interface Parts {
  wrap: HTMLElement;
  scroller: HTMLElement;
  rail: HTMLElement;
  thumb: HTMLElement;
}

function parts(container: HTMLElement): Parts {
  const wrap = container.querySelector('.wa-scroll');
  const scroller = container.querySelector('.wa-scroll-view');
  const rail = container.querySelector('[data-scroll-rail]');
  const thumb = container.querySelector('[data-scroll-thumb]');
  if (
    !(wrap instanceof HTMLElement) ||
    !(scroller instanceof HTMLElement) ||
    !(rail instanceof HTMLElement) ||
    !(thumb instanceof HTMLElement)
  ) {
    throw new Error('ScrollArea did not render a wrapper, scroller, rail and thumb');
  }
  return { wrap, scroller, rail, thumb };
}

/** Gives the mounted area overflowing content and repaints it via a scroll. */
function overflow(p: Parts, scrollTop = 0): void {
  fixMetric(p.scroller, 'scrollHeight', SCROLL_HEIGHT);
  fixMetric(p.scroller, 'clientHeight', CLIENT_HEIGHT);
  fixMetric(p.rail, 'clientHeight', TRACK_HEIGHT);
  p.scroller.scrollTop = scrollTop;
  fireEvent.scroll(p.scroller);
}

describe('scrollThumbGeometry', () => {
  it('draws nothing when the content fits', () => {
    expect(scrollThumbGeometry(0, 400, 400, 380)).toEqual({
      overflowing: false,
      height: 0,
      offset: 0,
    });
  });

  it('ignores a sub-pixel overflow', () => {
    // fractional line boxes and browser zoom leave sub-pixel dust behind; a bar
    // that appears for half a pixel of nothing is worse than no bar
    expect(scrollThumbGeometry(0, 401, 400, 380).overflowing).toBe(false);
    expect(scrollThumbGeometry(0, 402, 400, 380).overflowing).toBe(true);
  });

  it('sizes the thumb by the visible share of the content', () => {
    const geometry = scrollThumbGeometry(0, SCROLL_HEIGHT, CLIENT_HEIGHT, TRACK_HEIGHT);
    expect(geometry).toEqual({ overflowing: true, height: 152, offset: 0 });
  });

  it('offsets the thumb by the scroll progress, not by the scroll distance', () => {
    expect(scrollThumbGeometry(150, SCROLL_HEIGHT, CLIENT_HEIGHT, TRACK_HEIGHT).offset).toBe(57);
    expect(scrollThumbGeometry(300, SCROLL_HEIGHT, CLIENT_HEIGHT, TRACK_HEIGHT).offset).toBe(114);
    // the bottom of the content puts the thumb exactly at the end of the rail
    expect(scrollThumbGeometry(600, SCROLL_HEIGHT, CLIENT_HEIGHT, TRACK_HEIGHT).offset).toBe(228);
  });

  it('floors the thumb at a grabbable length on very long content', () => {
    const geometry = scrollThumbGeometry(0, 100_000, 400, 380);
    expect(geometry.height).toBe(28);
  });

  it('clamps the offset when the scroll position is out of range', () => {
    expect(scrollThumbGeometry(-50, SCROLL_HEIGHT, CLIENT_HEIGHT, TRACK_HEIGHT).offset).toBe(0);
    expect(scrollThumbGeometry(9999, SCROLL_HEIGHT, CLIENT_HEIGHT, TRACK_HEIGHT).offset).toBe(228);
  });

  it('never divides by an unmeasured viewport or rail', () => {
    expect(scrollThumbGeometry(0, 1000, 0, 380).overflowing).toBe(false);
    expect(scrollThumbGeometry(0, 1000, 400, 0).overflowing).toBe(false);
  });
});

describe('scrollTopFromDrag', () => {
  it('maps a thumb delta onto the scrollable range', () => {
    // 57px of the 228px travel is a quarter of the way, i.e. 150 of 600px
    expect(scrollTopFromDrag(0, 57, SCROLL_HEIGHT, CLIENT_HEIGHT, TRACK_HEIGHT)).toBe(150);
    expect(scrollTopFromDrag(150, -57, SCROLL_HEIGHT, CLIENT_HEIGHT, TRACK_HEIGHT)).toBe(0);
  });

  it('parks at the ends instead of running past them', () => {
    expect(scrollTopFromDrag(0, 5000, SCROLL_HEIGHT, CLIENT_HEIGHT, TRACK_HEIGHT)).toBe(600);
    expect(scrollTopFromDrag(0, -5000, SCROLL_HEIGHT, CLIENT_HEIGHT, TRACK_HEIGHT)).toBe(0);
  });

  it('holds position when there is nothing to scroll', () => {
    expect(scrollTopFromDrag(0, 100, 400, 400, 380)).toBe(0);
  });
});

describe('ScrollArea rendering', () => {
  it('renders a div scroller carrying screen-content and the caller class', () => {
    const { container } = render(<ScrollArea className="px-screen pb-6">body</ScrollArea>);
    const { scroller } = parts(container);
    expect(scroller.tagName).toBe('DIV');
    expect(scroller).toHaveClass('screen-content', 'wa-scroll-view', 'px-screen', 'pb-6');
    expect(scroller).toHaveTextContent('body');
  });

  it('renders the element type it is given, so the drill keeps its main landmark', () => {
    const { container } = render(
      <ScrollArea as="main" className="flex">
        body
      </ScrollArea>,
    );
    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main).toHaveClass('screen-content', 'flex');
  });

  it('passes unknown props through to the scroller', () => {
    const { container } = render(
      <ScrollArea id="content" data-screen="home">
        body
      </ScrollArea>,
    );
    const { scroller } = parts(container);
    expect(scroller).toHaveAttribute('id', 'content');
    expect(scroller).toHaveAttribute('data-screen', 'home');
  });

  it('forwards a ref to the scroller, not to the wrapper', () => {
    const ref = createRef<HTMLElement>();
    const { container } = render(<ScrollArea ref={ref}>body</ScrollArea>);
    const { scroller } = parts(container);
    expect(ref.current).toBe(scroller);
  });

  it('keeps the rail outside the scroller and hidden from assistive tech', () => {
    const { container } = render(<ScrollArea>body</ScrollArea>);
    const { wrap, scroller, rail } = parts(container);
    // outside the scroller: the overlay must not scroll with the content, and
    // must not add a single pixel to the scrollable box
    expect(scroller.contains(rail)).toBe(false);
    expect(wrap.contains(rail)).toBe(true);
    expect(rail).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws no thumb while the content fits', () => {
    const { container } = render(<ScrollArea>body</ScrollArea>);
    const { rail, thumb } = parts(container);
    expect(rail.dataset.overflow).toBe('false');
    expect(rail.dataset.visible).toBe('false');
    expect(thumb.style.height).toBe('0px');
  });
});

describe('ScrollArea geometry', () => {
  it('sizes and positions the thumb from the measured scroll state', () => {
    const { container } = render(<ScrollArea>body</ScrollArea>);
    const p = parts(container);
    overflow(p);

    expect(p.rail.dataset.overflow).toBe('true');
    expect(p.thumb.style.height).toBe('152px');
    expect(p.thumb.style.transform).toBe('translateY(0px)');
  });

  it('moves the thumb as the content scrolls', () => {
    const { container } = render(<ScrollArea>body</ScrollArea>);
    const p = parts(container);
    overflow(p, 150);
    expect(p.thumb.style.transform).toBe('translateY(57px)');

    p.scroller.scrollTop = 600;
    fireEvent.scroll(p.scroller);
    expect(p.thumb.style.transform).toBe('translateY(228px)');
  });
});

describe('ScrollArea visibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reveals the thumb on scroll and fades it out once the scrolling stops', () => {
    const { container } = render(<ScrollArea>body</ScrollArea>);
    const p = parts(container);
    overflow(p, 150);
    expect(p.rail.dataset.visible).toBe('true');

    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(p.rail.dataset.visible).toBe('true');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(p.rail.dataset.visible).toBe('false');
    // hidden, but still measured: the geometry survives the fade
    expect(p.rail.dataset.overflow).toBe('true');
    expect(p.thumb.style.height).toBe('152px');
  });

  it('holds the thumb up while a mouse hovers the area', () => {
    const { container } = render(<ScrollArea>body</ScrollArea>);
    const p = parts(container);
    overflow(p);

    fireEvent.pointerEnter(p.wrap, { pointerType: 'mouse' });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(p.rail.dataset.visible).toBe('true');

    fireEvent.pointerLeave(p.wrap);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(p.rail.dataset.visible).toBe('false');
  });

  it('lets a touch fade out like any other scroll', () => {
    const { container } = render(<ScrollArea>body</ScrollArea>);
    const p = parts(container);
    overflow(p);

    // a finger "enters" on touchdown and may never fire the matching leave
    fireEvent.pointerEnter(p.wrap, { pointerType: 'touch' });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(p.rail.dataset.visible).toBe('false');
  });

  it('never reveals a thumb the content does not need', () => {
    const { container } = render(<ScrollArea>body</ScrollArea>);
    const p = parts(container);
    fireEvent.scroll(p.scroller);
    expect(p.rail.dataset.visible).toBe('false');
  });
});

describe('ScrollArea dragging', () => {
  it('scrolls the content by the thumb', () => {
    const { container } = render(<ScrollArea>body</ScrollArea>);
    const p = parts(container);
    overflow(p);

    fireEvent.pointerDown(p.thumb, { pointerId: 1, clientY: 100, isPrimary: true, button: 0 });
    expect(p.thumb.dataset.dragging).toBe('true');

    fireEvent.pointerMove(p.thumb, { pointerId: 1, clientY: 157 });
    expect(p.scroller.scrollTop).toBe(150);
    expect(p.thumb.style.transform).toBe('translateY(57px)');

    fireEvent.pointerUp(p.thumb, { pointerId: 1, clientY: 157 });
    expect(p.thumb.dataset.dragging).toBe('false');
  });

  it('ignores pointer movement once the drag is over', () => {
    const { container } = render(<ScrollArea>body</ScrollArea>);
    const p = parts(container);
    overflow(p);

    fireEvent.pointerDown(p.thumb, { pointerId: 1, clientY: 100, isPrimary: true, button: 0 });
    fireEvent.pointerUp(p.thumb, { pointerId: 1, clientY: 100 });
    fireEvent.pointerMove(p.thumb, { pointerId: 1, clientY: 400 });
    expect(p.scroller.scrollTop).toBe(0);
  });

  it('does not drag a thumb the content does not need', () => {
    const { container } = render(<ScrollArea>body</ScrollArea>);
    const p = parts(container);

    fireEvent.pointerDown(p.thumb, { pointerId: 1, clientY: 100, isPrimary: true, button: 0 });
    fireEvent.pointerMove(p.thumb, { pointerId: 1, clientY: 300 });
    expect(p.scroller.scrollTop).toBe(0);
  });
});

describe('ScrollArea resizing', () => {
  /* happy-dom ships a ResizeObserver whose observe() is a no-op, so the
     callback never fires on its own — the stub keeps a handle on it. */
  let notify: (() => void) | null = null;

  beforeEach(() => {
    notify = null;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('remeasures when the observer reports a size change', () => {
    const { container } = render(
      <ScrollArea>
        <p>body</p>
      </ScrollArea>,
    );
    const p = parts(container);
    expect(p.rail.dataset.overflow).toBe('false');

    fixMetric(p.scroller, 'scrollHeight', SCROLL_HEIGHT);
    fixMetric(p.scroller, 'clientHeight', CLIENT_HEIGHT);
    fixMetric(p.rail, 'clientHeight', TRACK_HEIGHT);
    expect(notify).not.toBeNull();
    act(() => {
      notify?.();
    });

    expect(p.rail.dataset.overflow).toBe('true');
    expect(p.thumb.style.height).toBe('152px');
    // a resize alone is not an interaction: nothing fades in unprompted
    expect(p.rail.dataset.visible).toBe('false');
  });
});
