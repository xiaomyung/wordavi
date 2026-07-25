import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLog,
  getRecentLog,
  installGlobalErrorCapture,
  log,
  persistLogNow,
  serializeLog,
} from '@/services/log';
import { getErrors, STORAGE_KEYS } from '@/storage';

describe('log', () => {
  beforeEach(() => {
    localStorage.clear();
    clearLog();
  });

  it('records entries with level, namespace, message, and optional data', () => {
    log.debug('session', 'debug msg');
    log.info('session', 'info msg');
    log.warn('tts', 'warn msg');
    log.error('speech', 'error msg', { code: 42 });

    const entries = getRecentLog();
    expect(entries.map((entry) => entry.level)).toEqual(['debug', 'info', 'warn', 'error']);
    const [firstEntry] = entries;
    expect(firstEntry).toBeDefined();
    expect(firstEntry !== undefined && 'data' in firstEntry).toBe(false);
    expect(entries[3]).toMatchObject({ ns: 'speech', msg: 'error msg', data: { code: 42 } });
  });

  it('caps the in-memory ring buffer at 400 entries', () => {
    for (let i = 0; i < 450; i += 1) {
      log.info('session', `msg-${i}`);
    }
    const entries = getRecentLog(1000);
    expect(entries).toHaveLength(400);
    expect(entries[0]?.msg).toBe('msg-50');
    expect(entries[399]?.msg).toBe('msg-449');
  });

  it('truncates oversized data payloads', () => {
    const big = 'y'.repeat(5000);
    log.debug('session', 'big payload', { big });
    const [entry] = getRecentLog();
    const data = entry?.data;
    expect(typeof data).toBe('string');
    expect((data as string).length).toBeLessThan(2100);
  });

  it('persists to wordavi:log after the debounce window and survives a reload', async () => {
    vi.useFakeTimers();
    log.info('session', 'first');
    log.warn('session', 'second');
    await vi.advanceTimersByTimeAsync(1100);
    vi.useRealTimers();

    vi.resetModules();
    const reloaded = await import('@/services/log');
    const entries = reloaded.getRecentLog();
    expect(entries.map((entry) => entry.msg)).toEqual(['first', 'second']);
  });

  it('drops the oldest persisted entries to stay under the ~64KB cap', () => {
    const padding = 'x'.repeat(2000);
    for (let i = 0; i < 60; i += 1) {
      log.info('session', `padded-${i}`, { padding });
    }
    persistLogNow();

    const raw = localStorage.getItem(STORAGE_KEYS.log) ?? '';
    expect(raw).not.toBe('');
    expect(raw.length).toBeLessThanOrEqual(64 * 1024);

    const persisted = JSON.parse(raw) as unknown[];
    expect(persisted.length).toBeLessThan(60);
    expect(getRecentLog()).toHaveLength(60);
  });

  it('serializeLog stays within the char budget and produces valid JSON', () => {
    for (let i = 0; i < 100; i += 1) {
      log.info('session', `entry number ${i} with padding text to grow the payload`);
    }
    const serialized = serializeLog(500);
    expect(serialized.length).toBeLessThanOrEqual(520);

    const parsed = JSON.parse(serialized) as { msg: string }[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeLessThan(100);
    expect(parsed[parsed.length - 1]?.msg).toContain('entry number 99');
  });

  it('clearLog empties both the buffer and the persisted copy', () => {
    log.info('session', 'to be cleared');
    persistLogNow();
    clearLog();
    expect(getRecentLog()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEYS.log)).toBe('[]');
  });

  it('mirrors to console only in dev mode', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    log.info('ui', 'hello');
    if (import.meta.env.DEV) {
      expect(spy).toHaveBeenCalled();
    } else {
      expect(spy).not.toHaveBeenCalled();
    }
    spy.mockRestore();
  });

  it('installGlobalErrorCapture writes a window error to the log and the error ring', () => {
    const uninstall = installGlobalErrorCapture();
    const event = new ErrorEvent('error', { message: 'boom', error: new Error('boom') });
    window.dispatchEvent(event);

    expect(getRecentLog().some((entry) => entry.level === 'error' && entry.msg === 'boom')).toBe(
      true,
    );
    expect(getErrors().some((entry) => entry.message === 'boom')).toBe(true);

    uninstall();
  });

  it('installGlobalErrorCapture writes an unhandled rejection to both slots', () => {
    const uninstall = installGlobalErrorCapture();
    const rejectionEvent = new Event('unhandledrejection') as Event & { reason: unknown };
    Object.defineProperty(rejectionEvent, 'reason', {
      value: new Error('rejected'),
      configurable: true,
    });
    window.dispatchEvent(rejectionEvent as unknown as PromiseRejectionEvent);

    expect(getRecentLog().some((entry) => entry.msg === 'rejected')).toBe(true);
    expect(getErrors().some((entry) => entry.message === 'rejected')).toBe(true);

    uninstall();
  });

  it('uninstall stops further capture', () => {
    const uninstall = installGlobalErrorCapture();
    uninstall();
    const before = getErrors().length;
    window.dispatchEvent(new ErrorEvent('error', { message: 'after uninstall' }));
    expect(getErrors().length).toBe(before);
  });
});
