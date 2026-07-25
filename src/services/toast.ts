/**
 * Tiny framework-free toast store: a single visible toast plus a FIFO queue.
 * React screens subscribe via useSyncExternalStore (subscribe + getToast);
 * this module has no react/dom dependency of its own.
 */
import { log } from '@/services/log';

const NS = 'toast';
const DEFAULT_DURATION_MS = 4000;

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastRequest {
  text: string;
  action?: ToastAction;
  duration?: number;
}

export interface ToastState {
  id: number;
  text: string;
  action?: ToastAction;
  duration: number;
}

type ToastListener = (toast: ToastState | null) => void;

let nextId = 1;
let current: ToastState | null = null;
const queue: ToastState[] = [];
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<ToastListener>();

function notify(): void {
  for (const listener of listeners) listener(current);
}

function clearDismissTimer(): void {
  if (dismissTimer !== null) {
    clearTimeout(dismissTimer);
    dismissTimer = null;
  }
}

function advance(): void {
  clearDismissTimer();
  current = queue.shift() ?? null;
  notify();
  if (current) {
    const toast = current;
    dismissTimer = setTimeout(() => {
      log.debug(NS, 'toast auto-dismissed', { id: toast.id });
      advance();
    }, toast.duration);
  }
}

/** Queues a toast; shows it immediately if none is currently visible. */
export function showToast(request: ToastRequest): number {
  const toast: ToastState = {
    id: nextId,
    text: request.text,
    duration: request.duration ?? DEFAULT_DURATION_MS,
    ...(request.action !== undefined ? { action: request.action } : {}),
  };
  nextId += 1;

  log.info(NS, 'toast queued', {
    id: toast.id,
    text: toast.text,
    hasAction: toast.action !== undefined,
  });

  queue.push(toast);
  if (current === null) advance();
  return toast.id;
}

/** Dismisses the visible toast (if any) and advances to the next queued one. */
export function dismissToast(): void {
  if (!current) return;
  log.debug(NS, 'toast dismissed', { id: current.id });
  advance();
}

/**
 * Invokes the visible toast's action, then dismisses it. A throwing action is
 * logged and rethrown, but the toast is dismissed either way — leaving it stuck
 * on screen would also block every toast queued behind it.
 */
export function pressToastAction(): void {
  const toast = current;
  if (!toast?.action) return;
  log.info(NS, 'toast action pressed', { id: toast.id });
  try {
    toast.action.onPress();
  } catch (err) {
    log.error(NS, 'toast action threw', { id: toast.id, error: String(err) });
    throw err;
  } finally {
    advance();
  }
}

export function getToast(): ToastState | null {
  return current;
}

export function subscribe(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
