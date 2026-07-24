import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLog, log } from '@/services/log';
import { composeReport, copyReport, sendReport } from '@/services/report';
import { clearErrors, pushError } from '@/storage';

function setNavProp(name: string, value: unknown): void {
  Object.defineProperty(navigator, name, { value, configurable: true });
}

function makeFile(name = 'screenshot.png'): File {
  return new File(['fake-bytes'], name, { type: 'image/png' });
}

/** happy-dom records the `mailto:` navigation on window.location, so the sent body is readable. */
function mailtoBody(): string {
  const href = window.location.href;
  const query = href.slice(href.indexOf('?') + 1);
  return new URLSearchParams(query).get('body') ?? '';
}

const TRUNCATION_WARNING = 'report body truncated to fit the channel cap';

function fillLog(entries: number, paddingChars: number): void {
  const padding = 'x'.repeat(paddingChars);
  for (let i = 0; i < entries; i += 1) log.info('session', `padded entry ${i}`, { padding });
}

describe('report', () => {
  beforeEach(() => {
    localStorage.clear();
    clearLog();
    clearErrors();
  });

  afterEach(() => {
    setNavProp('share', undefined);
    setNavProp('canShare', undefined);
    setNavProp('clipboard', undefined);
  });

  describe('composeReport', () => {
    it('gathers version, UA, language, screen size, settings, and errors', () => {
      pushError({ t: 1, message: 'boom' });
      const payload = composeReport({ userText: 'it crashed', screenshots: [] });

      expect(typeof payload.version).toBe('string');
      expect(payload.version.length).toBeGreaterThan(0);
      expect(payload.userAgent).toBe(navigator.userAgent);
      expect(payload.language).toBe(navigator.language);
      expect(payload.screen).toEqual({ width: window.innerWidth, height: window.innerHeight });
      expect(payload.settings.uiLang).toBeDefined();
      expect(payload.errors.some((e) => e.message === 'boom')).toBe(true);
      expect(payload.userText).toBe('it crashed');
      expect(payload.screenshots).toEqual([]);
    });

    it('caps the embedded log excerpt to stay mailto-safe', () => {
      const padding = 'x'.repeat(500);
      for (let i = 0; i < 40; i += 1) {
        log.info('session', `padded entry ${i}`, { padding });
      }

      const payload = composeReport({ userText: '', screenshots: [] });
      expect(payload.logExcerpt.length).toBeLessThanOrEqual(1850);
      expect(() => JSON.parse(payload.logExcerpt)).not.toThrow();

      const entries = JSON.parse(payload.logExcerpt) as { msg: string }[];
      expect(entries.length).toBeLessThan(40);
      expect(entries[entries.length - 1]?.msg).toContain('padded entry 39');
    });

    it('logs that a report was composed', () => {
      const infoSpy = vi.spyOn(log, 'info');
      composeReport({ userText: 'note', screenshots: [makeFile()] });
      expect(infoSpy).toHaveBeenCalledWith('report', 'report composed', expect.anything());
    });
  });

  describe('sendReport', () => {
    it('uses Web Share when screenshots exist and canShare approves', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      setNavProp('share', share);
      setNavProp(
        'canShare',
        vi.fn(() => true),
      );

      const payload = composeReport({ userText: 'bug', screenshots: [makeFile()] });
      const result = await sendReport(payload);

      expect(result).toEqual({ ok: true, channel: 'share', manualAttachHint: false });
      expect(share).toHaveBeenCalledTimes(1);
      const arg = share.mock.calls[0]?.[0] as { files: File[] };
      expect(arg.files).toHaveLength(1);
    });

    it('falls back to mailto when there are no screenshots, even if share is supported', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      setNavProp('share', share);
      setNavProp(
        'canShare',
        vi.fn(() => true),
      );

      const payload = composeReport({ userText: 'bug', screenshots: [] });
      const result = await sendReport(payload);

      expect(share).not.toHaveBeenCalled();
      expect(result.channel).toBe('mailto');
      expect(result.manualAttachHint).toBe(false);
    });

    it('falls back to mailto when canShare rejects the file set', async () => {
      const share = vi.fn();
      setNavProp('share', share);
      setNavProp(
        'canShare',
        vi.fn(() => false),
      );

      const payload = composeReport({ userText: 'bug', screenshots: [makeFile()] });
      const result = await sendReport(payload);

      expect(share).not.toHaveBeenCalled();
      expect(result.channel).toBe('mailto');
      expect(result.manualAttachHint).toBe(true);
    });

    it('falls back to mailto when navigator.share throws', async () => {
      setNavProp('share', vi.fn().mockRejectedValue(new Error('user cancelled')));
      setNavProp(
        'canShare',
        vi.fn(() => true),
      );
      const warnSpy = vi.spyOn(log, 'warn');

      const payload = composeReport({ userText: 'bug', screenshots: [makeFile()] });
      const result = await sendReport(payload);

      expect(result.channel).toBe('mailto');
      expect(warnSpy).toHaveBeenCalled();
    });

    it('falls back to mailto when share is entirely unsupported', async () => {
      const payload = composeReport({ userText: 'bug', screenshots: [] });
      const result = await sendReport(payload);
      expect(result).toEqual({ ok: true, channel: 'mailto', manualAttachHint: false });
    });

    it('flags manualAttachHint when mailto is used with screenshots pending', async () => {
      const payload = composeReport({ userText: 'bug', screenshots: [makeFile()] });
      const result = await sendReport(payload);
      expect(result.channel).toBe('mailto');
      expect(result.manualAttachHint).toBe(true);
    });

    it('addresses the mailto fallback to the project inbox with a versioned subject', async () => {
      const payload = composeReport({ userText: 'hi', screenshots: [] });
      await sendReport(payload);

      expect(window.location.href.startsWith('mailto:xiaomyung.dev@gmail.com?')).toBe(true);
      expect(decodeURIComponent(window.location.href)).toContain(
        `Wordavi report v${payload.version}`,
      );
    });

    it('embeds the diagnostics snapshot in the sent body', async () => {
      pushError({ t: 1, message: 'boom' });
      const payload = composeReport({ userText: 'note text', screenshots: [] });
      await sendReport(payload);

      const body = mailtoBody();
      expect(body).toContain(`wordavi report v${payload.version}`);
      expect(body).toContain(`ua: ${navigator.userAgent}`);
      expect(body).toContain('boom');
      expect(body).toContain('note text');
    });
  });

  describe('body cap', () => {
    it('keeps the mailto body within 1800 chars despite a full log and error ring', async () => {
      fillLog(40, 500);
      for (let i = 0; i < 20; i += 1) pushError({ t: i, message: `failure ${i}` });

      const payload = composeReport({ userText: 'something broke', screenshots: [] });
      const result = await sendReport(payload);

      expect(result.channel).toBe('mailto');
      expect(mailtoBody().length).toBeLessThanOrEqual(1800);
    });

    it('keeps the shared body within 1800 chars too', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      setNavProp('share', share);
      setNavProp(
        'canShare',
        vi.fn(() => true),
      );
      fillLog(40, 500);

      const payload = composeReport({ userText: 'bug', screenshots: [makeFile()] });
      await sendReport(payload);

      const arg = share.mock.calls[0]?.[0] as { text: string };
      expect(arg.text.length).toBeLessThanOrEqual(1800);
    });

    it('budgets the log excerpt so an ordinary report is never hard-truncated', async () => {
      // spyOn reuses a single spy per method, so prior tests' calls linger.
      const warnSpy = vi.spyOn(log, 'warn').mockClear();
      fillLog(40, 200);

      const payload = composeReport({ userText: 'short note', screenshots: [] });
      await sendReport(payload);

      expect(warnSpy).not.toHaveBeenCalledWith('report', TRUNCATION_WARNING, expect.anything());
      expect(mailtoBody().length).toBeLessThanOrEqual(1800);
    });

    it('hard-truncates and warns when the user note alone overflows the cap', async () => {
      const warnSpy = vi.spyOn(log, 'warn').mockClear();

      const payload = composeReport({ userText: 'y'.repeat(5000), screenshots: [] });
      await sendReport(payload);

      expect(warnSpy).toHaveBeenCalledWith('report', TRUNCATION_WARNING, expect.anything());
      expect(mailtoBody().length).toBeLessThanOrEqual(1800);
      expect(mailtoBody().endsWith('…(truncated)')).toBe(true);
    });
  });

  describe('copyReport', () => {
    it('copies the full diagnostics text without truncation', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      setNavProp('clipboard', { writeText });

      const padding = 'x'.repeat(500);
      for (let i = 0; i < 40; i += 1) log.info('session', `entry ${i}`, { padding });
      const payload = composeReport({ userText: 'full text please', screenshots: [] });

      const result = await copyReport(payload);
      expect(result).toEqual({ ok: true });
      expect(writeText).toHaveBeenCalledTimes(1);
      const text = writeText.mock.calls[0]?.[0] as string;
      expect(text).toContain('full text please');
      expect(text.length).toBeGreaterThan(payload.logExcerpt.length);
    });

    it('returns a structured failure instead of throwing when clipboard is unavailable', async () => {
      setNavProp('clipboard', undefined);
      const payload = composeReport({ userText: 'x', screenshots: [] });

      const result = await copyReport(payload);
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns a structured failure when clipboard.writeText rejects', async () => {
      setNavProp('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) });
      const payload = composeReport({ userText: 'x', screenshots: [] });

      const result = await copyReport(payload);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('denied');
    });
  });
});
