import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const services = vi.hoisted(() => ({
  warmupTts: vi.fn(),
  warmupSounds: vi.fn(),
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/services/tts', () => ({ warmup: services.warmupTts }));
vi.mock('@/services/sounds', () => ({ warmup: services.warmupSounds }));
vi.mock('@/services/log', () => ({ log: services.log }));

/** A fresh module per test: "already warmed" is a session fact, not a mount fact. */
async function freshHook(): Promise<() => void> {
  vi.resetModules();
  return (await import('@/app/useGestureWarmup')).useGestureWarmup;
}

function tap(): void {
  window.dispatchEvent(new Event('pointerdown'));
}

function press(): void {
  window.dispatchEvent(new Event('keydown'));
}

describe('useGestureWarmup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The hook is deliberately inert under `test`; every case but the last one
    // is about what a browser does.
    vi.stubEnv('MODE', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('unlocks speech and audio on the first tap', async () => {
    const useGestureWarmup = await freshHook();
    renderHook(() => useGestureWarmup());

    tap();

    expect(services.warmupTts).toHaveBeenCalledTimes(1);
    expect(services.warmupSounds).toHaveBeenCalledTimes(1);
  });

  it('accepts a key press as the gesture', async () => {
    const useGestureWarmup = await freshHook();
    renderHook(() => useGestureWarmup());

    press();

    expect(services.warmupTts).toHaveBeenCalledTimes(1);
    expect(services.warmupSounds).toHaveBeenCalledTimes(1);
  });

  it('warms up once, however many gestures and mounts follow', async () => {
    const useGestureWarmup = await freshHook();
    const first = renderHook(() => useGestureWarmup());

    tap();
    tap();
    press();
    first.unmount();

    renderHook(() => useGestureWarmup());
    tap();

    expect(services.warmupTts).toHaveBeenCalledTimes(1);
    expect(services.warmupSounds).toHaveBeenCalledTimes(1);
  });

  it('drops its listeners when the app unmounts', async () => {
    const useGestureWarmup = await freshHook();
    const { unmount } = renderHook(() => useGestureWarmup());

    unmount();
    tap();

    expect(services.warmupTts).not.toHaveBeenCalled();
    expect(services.warmupSounds).not.toHaveBeenCalled();
  });

  it('stays inert under test, so no suite starts speech or an AudioContext', async () => {
    vi.stubEnv('MODE', 'test');
    const useGestureWarmup = await freshHook();
    renderHook(() => useGestureWarmup());

    tap();

    expect(services.warmupTts).not.toHaveBeenCalled();
    expect(services.warmupSounds).not.toHaveBeenCalled();
  });
});
