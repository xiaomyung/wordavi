import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setNavProp } from '../helpers/nav';

function setVibrate(fn: ((pattern: number | number[]) => boolean) | undefined): void {
  setNavProp('vibrate', fn);
}

async function freshHaptics(): Promise<{
  haptics: typeof import('@/services/haptics');
  log: typeof import('@/services/log').log;
}> {
  vi.resetModules();
  const logModule = await import('@/services/log');
  const haptics = await import('@/services/haptics');
  return { haptics, log: logModule.log };
}

describe('haptics', () => {
  beforeEach(() => {
    setVibrate(undefined);
  });

  afterEach(() => {
    setVibrate(undefined);
  });

  it('reports unsupported when navigator.vibrate is missing', async () => {
    const { haptics } = await freshHaptics();
    expect(haptics.isHapticsSupported()).toBe(false);
  });

  it('reports supported when navigator.vibrate exists', async () => {
    setVibrate(vi.fn(() => true));
    const { haptics } = await freshHaptics();
    expect(haptics.isHapticsSupported()).toBe(true);
  });

  it('tick vibrates for 15ms', async () => {
    const vibrate = vi.fn(() => true);
    setVibrate(vibrate);
    const { haptics } = await freshHaptics();

    haptics.tick();
    expect(vibrate).toHaveBeenCalledWith(15);
  });

  it('wrongReveal uses the double pulse pattern', async () => {
    const vibrate = vi.fn(() => true);
    setVibrate(vibrate);
    const { haptics } = await freshHaptics();

    haptics.wrongReveal();
    expect(vibrate).toHaveBeenCalledWith([15, 60, 15]);
  });

  it('dayStamp vibrates for 20ms', async () => {
    const vibrate = vi.fn(() => true);
    setVibrate(vibrate);
    const { haptics } = await freshHaptics();

    haptics.dayStamp();
    expect(vibrate).toHaveBeenCalledWith(20);
  });

  it('silently no-ops when unsupported', async () => {
    const { haptics } = await freshHaptics();
    expect(() => haptics.tick()).not.toThrow();
    expect(() => haptics.wrongReveal()).not.toThrow();
    expect(() => haptics.dayStamp()).not.toThrow();
  });

  it('warns exactly once across repeated calls when unsupported', async () => {
    const { haptics, log } = await freshHaptics();
    const warnSpy = vi.spyOn(log, 'warn');

    haptics.tick();
    haptics.wrongReveal();
    haptics.dayStamp();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('haptics', 'vibrate unsupported', expect.anything());
  });

  it('logs an info entry per successful haptic', async () => {
    const vibrate = vi.fn(() => true);
    setVibrate(vibrate);
    const { haptics, log } = await freshHaptics();
    const infoSpy = vi.spyOn(log, 'info');

    haptics.tick();
    expect(infoSpy).toHaveBeenCalledWith('haptics', 'haptic fired', expect.anything());
  });
});
