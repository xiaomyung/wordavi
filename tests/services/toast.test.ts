import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function freshToast() {
  vi.resetModules();
  return import('@/services/toast');
}

describe('toast', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast immediately when none is visible', async () => {
    const toast = await freshToast();
    toast.showToast({ text: 'saved' });
    expect(toast.getToast()?.text).toBe('saved');
  });

  it('queues a second toast behind the first and shows it after auto-dismiss', async () => {
    const toast = await freshToast();
    toast.showToast({ text: 'first' });
    toast.showToast({ text: 'second' });

    expect(toast.getToast()?.text).toBe('first');
    await vi.advanceTimersByTimeAsync(4000);
    expect(toast.getToast()?.text).toBe('second');
  });

  it('auto-dismisses after the default 4s duration', async () => {
    const toast = await freshToast();
    toast.showToast({ text: 'hello' });
    await vi.advanceTimersByTimeAsync(3999);
    expect(toast.getToast()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(toast.getToast()).toBeNull();
  });

  it('respects a custom duration', async () => {
    const toast = await freshToast();
    toast.showToast({ text: 'quick', duration: 1000 });
    await vi.advanceTimersByTimeAsync(999);
    expect(toast.getToast()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(toast.getToast()).toBeNull();
  });

  it('dismissToast advances to the next queued toast immediately', async () => {
    const toast = await freshToast();
    toast.showToast({ text: 'first' });
    toast.showToast({ text: 'second' });

    toast.dismissToast();
    expect(toast.getToast()?.text).toBe('second');
  });

  it('pressToastAction invokes the action and dismisses the toast', async () => {
    const toast = await freshToast();
    const onPress = vi.fn();
    toast.showToast({ text: 'undo?', action: { label: 'Undo', onPress } });

    toast.pressToastAction();

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(toast.getToast()).toBeNull();
  });

  it('pressToastAction is a no-op when the current toast has no action', async () => {
    const toast = await freshToast();
    toast.showToast({ text: 'plain' });
    expect(() => toast.pressToastAction()).not.toThrow();
    expect(toast.getToast()?.text).toBe('plain');
  });

  it('notifies subscribers on every state change', async () => {
    const toast = await freshToast();
    const listener = vi.fn();
    const unsubscribe = toast.subscribe(listener);

    toast.showToast({ text: 'a' });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ text: 'a' }));

    toast.dismissToast();
    expect(listener).toHaveBeenCalledWith(null);

    unsubscribe();
    listener.mockClear();
    toast.showToast({ text: 'b' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('assigns increasing ids to each toast', async () => {
    const toast = await freshToast();
    const firstId = toast.showToast({ text: 'a' });
    const secondId = toast.showToast({ text: 'b' });
    expect(secondId).toBeGreaterThan(firstId);
  });
});
