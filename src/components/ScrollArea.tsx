import type { HTMLAttributes, PointerEvent, ReactElement, Ref } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import './scroll-area.css';
import { cx } from './cx';
import { capturePointer } from './slider-shared';

/**
 * ScrollArea — the app's own overlay scrollbar for a `.screen-content` region.
 *
 * Why this exists: the platform scrollbar is a space-consuming control on
 * Linux/Windows desktop Chrome (a grey gutter with arrow buttons). It appears
 * and disappears with the content, so every screen whose content crosses the
 * viewport height reflows by ~15px, and it looks nothing like the rest of the
 * app. This draws the same affordance as an absolutely positioned overlay:
 * showing or hiding it can never move a pixel of content, and it looks
 * identical on every platform.
 *
 * The scroller itself is untouched apart from hiding the native bar, so wheel,
 * touch, keyboard and fragment-link scrolling all keep working natively — the
 * rail is a read-out of the scroll position plus a drag handle, nothing more.
 *
 * Geometry is written straight to the thumb's inline style rather than held in
 * state: a scroll event fires up to once per frame, and re-rendering the whole
 * screen subtree to move a bar by a few pixels is work for nothing. Every
 * measurement read happens before the single style write, so there is no
 * read/write layout thrash either. The thumb math is exported as a pure
 * function so it can be unit-tested without a DOM.
 */

/** Element the scroll region is rendered as (DrillScreen keeps its `<main>`). */
export type ScrollAreaTag = 'div' | 'main' | 'section';

/** Shortest the thumb is ever drawn — below this it stops reading as a grip. */
const MIN_THUMB_PX = 28;

/**
 * Sub-pixel slack. A scroller whose content fits can still report a scrollHeight
 * a fraction taller than its clientHeight (fractional line boxes, browser zoom),
 * and a scrollbar that appears for half a pixel of nothing is worse than none.
 */
const OVERFLOW_TOLERANCE_PX = 1;

/** Idle delay before the thumb fades back out. */
const HIDE_DELAY_MS = 800;

export interface ScrollThumbGeometry {
  /** False when the content fits: nothing is drawn at all. */
  overflowing: boolean;
  /** Thumb length in px. */
  height: number;
  /** Thumb distance from the top of the rail, in px. */
  offset: number;
}

/** Trimmed of float dust so repeated writes produce a stable style string. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Thumb length and position for one scroll state. The thumb is as long a share
 * of the rail as the viewport is of the content, floored at MIN_THUMB_PX so a
 * very long page still leaves something to grab, and it travels the leftover
 * rail in proportion to how far the content has scrolled.
 */
export function scrollThumbGeometry(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  trackHeight: number,
): ScrollThumbGeometry {
  const overflow = scrollHeight - clientHeight;
  // Also the division guard: every ratio below divides by one of these.
  if (overflow <= OVERFLOW_TOLERANCE_PX || clientHeight <= 0 || trackHeight <= 0) {
    return { overflowing: false, height: 0, offset: 0 };
  }
  const height = Math.min(
    trackHeight,
    Math.max(MIN_THUMB_PX, (clientHeight / scrollHeight) * trackHeight),
  );
  const travel = trackHeight - height;
  const progress = Math.min(1, Math.max(0, scrollTop / overflow));
  return { overflowing: true, height: round2(height), offset: round2(travel * progress) };
}

/**
 * Inverse of the offset above: where a drag that has moved the thumb `deltaY`
 * px from `startScrollTop` leaves the content. Clamped to the scrollable range,
 * so overshooting the rail parks at the top/bottom instead of running away.
 */
export function scrollTopFromDrag(
  startScrollTop: number,
  deltaY: number,
  scrollHeight: number,
  clientHeight: number,
  trackHeight: number,
): number {
  const geometry = scrollThumbGeometry(0, scrollHeight, clientHeight, trackHeight);
  const travel = trackHeight - geometry.height;
  if (!geometry.overflowing || travel <= 0) return startScrollTop;
  const overflow = scrollHeight - clientHeight;
  const next = startScrollTop + (deltaY * overflow) / travel;
  return Math.min(Math.max(next, 0), overflow);
}

interface DragState {
  readonly pointerId: number;
  readonly pointerY: number;
  readonly scrollTop: number;
}

interface Metrics {
  scrollHeight: number;
  clientHeight: number;
  trackHeight: number;
}

export interface ScrollAreaProps extends HTMLAttributes<HTMLElement> {
  /** Tag rendered as the scroller. Defaults to `div`. */
  as?: ScrollAreaTag;
  // explicit `| undefined`: callers forward a possibly-absent ref under exactOptionalPropertyTypes
  ref?: Ref<HTMLElement> | undefined;
}

/**
 * `className` is merged onto the scroller *after* `screen-content`, so caller
 * utilities keep winning; every other prop lands on the scroller too, leaving
 * the wrapper and the rail entirely internal.
 */
export function ScrollArea({
  as = 'div',
  className,
  children,
  ref,
  ...rest
}: ScrollAreaProps): ReactElement {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<Metrics>({ scrollHeight: 0, clientHeight: 0, trackHeight: 0 });
  const dragRef = useRef<DragState | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const revealedRef = useRef(false);
  const hoveringRef = useRef(false);

  /** Our own handle on the scroller, plus whatever the caller asked for. */
  const setScroller = useCallback(
    (node: HTMLElement | null): void => {
      scrollerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  /**
   * The single writer: measures, then paints the whole overlay state (geometry,
   * overflow, visibility, drag). Nothing else touches the rail or the thumb, so
   * there is exactly one place where the DOM and the refs can disagree.
   */
  const sync = useCallback((): void => {
    const el = scrollerRef.current;
    const rail = railRef.current;
    const thumb = thumbRef.current;
    if (!el || !rail || !thumb) return;

    const metrics: Metrics = {
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      trackHeight: rail.clientHeight,
    };
    metricsRef.current = metrics;
    const geometry = scrollThumbGeometry(
      el.scrollTop,
      metrics.scrollHeight,
      metrics.clientHeight,
      metrics.trackHeight,
    );

    rail.dataset.overflow = String(geometry.overflowing);
    rail.dataset.visible = String(geometry.overflowing && revealedRef.current);
    thumb.dataset.dragging = String(dragRef.current !== null);
    thumb.style.height = `${geometry.height}px`;
    thumb.style.transform = `translateY(${geometry.offset}px)`;
  }, []);

  const scheduleHide = useCallback((): void => {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
    // A hovering pointer or a live drag keeps the thumb up indefinitely.
    if (hoveringRef.current || dragRef.current !== null) return;
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      revealedRef.current = false;
      sync();
    }, HIDE_DELAY_MS);
  }, [sync]);

  const reveal = useCallback((): void => {
    revealedRef.current = true;
    sync();
    scheduleHide();
  }, [sync, scheduleHide]);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    const wrap = wrapRef.current;
    if (!el || !wrap) return;

    sync();

    // Native listeners rather than React props: `scroll` does not bubble and
    // passive is the cheapest thing a scrolling frame can carry, `pointerenter`
    // has no React equivalent that fires without a synthetic `pointerover`, and
    // keeping all three here leaves a caller's own handlers on the scroller
    // untouched.
    const onScroll = (): void => {
      reveal();
    };
    const onEnter = (event: globalThis.PointerEvent): void => {
      // Touch pointers enter and leave with the gesture, and some engines skip
      // the leave entirely — treating them as hover would pin the thumb open
      // long after the finger is gone. Only a mouse/pen holds it visible.
      hoveringRef.current = event.pointerType !== 'touch';
      reveal();
    };
    const onLeave = (): void => {
      hoveringRef.current = false;
      scheduleHide();
    };
    // The rail sits above the content, so a wheel over it hit-tests to the rail
    // — whose ancestors are all unscrollable (.wa-scroll is visible, .screen is
    // hidden, the document is exactly one viewport). Without forwarding, parking
    // the cursor where the native bar used to be would kill the wheel.
    const onWheel = (event: globalThis.WheelEvent): void => {
      el.scrollTop += event.deltaY;
      event.preventDefault();
      reveal();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    wrap.addEventListener('pointerenter', onEnter);
    wrap.addEventListener('pointerleave', onLeave);
    railRef.current?.addEventListener('wheel', onWheel, { passive: false });

    // Absent in some test DOMs; the scroll/hover measures keep the thumb honest
    // without it, this only catches size changes nobody scrolled for.
    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            sync();
          })
        : null;
    // The children ARE the content: callers style the scroller itself as their
    // flex column, so an inner wrapper to measure would break every caller's
    // layout. Observing each child covers content that grows in place; a
    // childList watcher re-observes when the set changes, which keeps the whole
    // subscription out of the render path (`children` is a fresh value every
    // render, and re-observing 16 gallery sections per render is pure waste).
    const observeChildren = (): void => {
      if (!observer) return;
      for (const child of el.children) observer.observe(child);
    };
    if (observer) {
      observer.observe(el);
      if (railRef.current) observer.observe(railRef.current);
      observeChildren();
    }
    const mutations =
      typeof MutationObserver === 'function'
        ? new MutationObserver(() => {
            observeChildren();
            sync();
          })
        : null;
    mutations?.observe(el, { childList: true });

    return () => {
      el.removeEventListener('scroll', onScroll);
      wrap.removeEventListener('pointerenter', onEnter);
      wrap.removeEventListener('pointerleave', onLeave);
      railRef.current?.removeEventListener('wheel', onWheel);
      observer?.disconnect();
      mutations?.disconnect();
    };
  }, [sync, reveal, scheduleHide]);

  useEffect(() => {
    const onResize = (): void => {
      sync();
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [sync]);

  useEffect(
    () => () => {
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    },
    [],
  );

  function startDrag(event: PointerEvent<HTMLDivElement>): void {
    const el = scrollerRef.current;
    // Primary button only: a right-press opens the context menu and may never
    // deliver an up, which would strand the drag state and scroll the content
    // on a bare hover afterwards.
    if (!el || !event.isPrimary || event.button !== 0) return;
    // Stops the press from selecting the text it is dragging over.
    event.preventDefault();
    event.stopPropagation();
    capturePointer(event.currentTarget, event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      pointerY: event.clientY,
      scrollTop: el.scrollTop,
    };
    reveal();
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    const el = scrollerRef.current;
    // A second finger landing on the thumb would otherwise hijack the delta.
    if (!drag || !el || event.pointerId !== drag.pointerId) return;
    const { scrollHeight, clientHeight, trackHeight } = metricsRef.current;
    el.scrollTop = scrollTopFromDrag(
      drag.scrollTop,
      event.clientY - drag.pointerY,
      scrollHeight,
      clientHeight,
      trackHeight,
    );
    // A programmatic scrollTop only fires `scroll` on the next frame, so the
    // thumb is repainted here to stay glued to the pointer.
    sync();
  }

  function endDrag(event: PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* capture may already be gone */
    }
    sync();
    scheduleHide();
  }

  const Scroller = as;

  return (
    <div ref={wrapRef} className="wa-scroll">
      <Scroller
        ref={setScroller}
        className={cx('screen-content wa-scroll-view', className)}
        {...rest}
      >
        {children}
      </Scroller>
      <div ref={railRef} aria-hidden="true" className="wa-scroll-rail" data-scroll-rail="">
        <div
          ref={thumbRef}
          className="wa-scroll-thumb"
          data-scroll-thumb=""
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={endDrag}
        />
      </div>
    </div>
  );
}
