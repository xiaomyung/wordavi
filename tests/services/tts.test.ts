import { afterEach, describe, expect, it, vi } from 'vitest';

type VoiceInit = Partial<SpeechSynthesisVoice> & { lang: string };

function makeVoice(init: VoiceInit): SpeechSynthesisVoice {
  return {
    default: false,
    localService: false,
    name: init.name ?? init.lang,
    voiceURI: init.name ?? init.lang,
    ...init,
  } as SpeechSynthesisVoice;
}

class FakeUtterance {
  text: string;
  lang = '';
  rate = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

interface FakeSynth {
  getVoices: () => SpeechSynthesisVoice[];
  addEventListener: (
    type: string,
    handler: () => void,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  removeEventListener: (type: string, handler: () => void) => void;
  speak: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  setVoices: (voices: SpeechSynthesisVoice[]) => void;
  fireVoicesChanged: () => void;
}

function installFakeSynthesis(initialVoices: SpeechSynthesisVoice[] = []): FakeSynth {
  let voices = initialVoices;
  const handlers = new Map<() => void, boolean>();

  const fake: FakeSynth = {
    getVoices: () => voices,
    addEventListener: (type, handler, options) => {
      if (type !== 'voiceschanged') return;
      const once = typeof options === 'object' && !!options.once;
      handlers.set(handler, once);
    },
    removeEventListener: (type, handler) => {
      if (type !== 'voiceschanged') return;
      handlers.delete(handler);
    },
    speak: vi.fn(),
    cancel: vi.fn(),
    setVoices: (next) => {
      voices = next;
    },
    fireVoicesChanged: () => {
      for (const [handler, once] of [...handlers.entries()]) {
        handler();
        if (once) handlers.delete(handler);
      }
    },
  };

  vi.stubGlobal('speechSynthesis', fake);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  return fake;
}

/** Awaits a couple of microtask ticks - enough for `await ensureVoiceResolved()` to settle. */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function freshTts(): Promise<{
  tts: typeof import('@/services/tts');
  log: typeof import('@/services/log').log;
}> {
  vi.resetModules();
  const logModule = await import('@/services/log');
  const tts = await import('@/services/tts');
  return { tts, log: logModule.log };
}

describe('tts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('voice resolution', () => {
    it('resolves synchronously when getVoices returns voices immediately', async () => {
      installFakeSynthesis([makeVoice({ lang: 'es-ES', localService: true })]);
      const { tts } = await freshTts();
      const status = await tts.ensureVoiceResolved();
      expect(status).toBe('es-ES');
      expect(tts.getVoiceStatus()).toBe('es-ES');
    });

    it('waits for voiceschanged when getVoices is initially empty (Chrome race)', async () => {
      const synth = installFakeSynthesis([]);
      const { tts } = await freshTts();

      const pending = tts.ensureVoiceResolved();
      synth.setVoices([makeVoice({ lang: 'es-ES', localService: true })]);
      synth.fireVoicesChanged();

      const status = await pending;
      expect(status).toBe('es-ES');
    });

    it('falls back to none after the voiceschanged timeout elapses', async () => {
      vi.useFakeTimers();
      installFakeSynthesis([]);
      const { tts, log } = await freshTts();

      const warnSpy = vi.spyOn(log, 'warn');
      const pending = tts.ensureVoiceResolved();
      await vi.advanceTimersByTimeAsync(1100);

      const status = await pending;
      expect(status).toBe('none');
      expect(warnSpy).toHaveBeenCalledWith(
        'tts',
        expect.stringContaining('timed out'),
        expect.anything(),
      );
    });

    it('memoizes the resolution promise across calls', async () => {
      const synth = installFakeSynthesis([makeVoice({ lang: 'es-ES', localService: true })]);
      const { tts } = await freshTts();
      const first = await tts.ensureVoiceResolved();
      synth.setVoices([]);
      const second = await tts.ensureVoiceResolved();
      expect(first).toBe(second);
    });

    it('notifies onVoicesChanged subscribers when the picked voice changes live', async () => {
      const synth = installFakeSynthesis([makeVoice({ lang: 'en-US', localService: true })]);
      const { tts } = await freshTts();
      await tts.ensureVoiceResolved();
      expect(tts.getVoiceStatus()).toBe('none');

      const cb = vi.fn();
      const unsubscribe = tts.onVoicesChanged(cb);

      synth.setVoices([makeVoice({ lang: 'es-ES', localService: true })]);
      synth.fireVoicesChanged();

      expect(cb).toHaveBeenCalledWith('es-ES');
      expect(tts.getVoiceStatus()).toBe('es-ES');

      unsubscribe();
      synth.setVoices([]);
      synth.fireVoicesChanged();
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('resolves to none when speechSynthesis is unavailable', async () => {
      vi.stubGlobal('speechSynthesis', undefined);
      const { tts } = await freshTts();
      expect(await tts.ensureVoiceResolved()).toBe('none');
    });
  });

  describe('voice pick priority', () => {
    const cases: {
      name: string;
      voices: VoiceInit[];
      expectedStatus: 'es-ES' | 'es-other' | 'none';
      expectedReason: RegExp;
    }[] = [
      {
        name: 'prefers es-ES local over everything else',
        voices: [
          { lang: 'es-MX', localService: true },
          { lang: 'es-ES', localService: false },
          { lang: 'es-ES', localService: true, name: 'es-ES-local' },
        ],
        expectedStatus: 'es-ES',
        expectedReason: /es-ES local voice/,
      },
      {
        name: 'falls back to es-ES non-local when no local es-ES voice exists',
        voices: [
          { lang: 'es-MX', localService: true },
          { lang: 'es-ES', localService: false },
        ],
        expectedStatus: 'es-ES',
        expectedReason: /es-ES voice \(non-local\)/,
      },
      {
        name: 'falls back to any es-* local voice when no es-ES voice exists',
        voices: [
          { lang: 'en-US', localService: true },
          { lang: 'es-MX', localService: true },
        ],
        expectedStatus: 'es-other',
        expectedReason: /es-\* local voice/,
      },
      {
        name: 'falls back to any es-* voice as a last resort',
        voices: [
          { lang: 'en-US', localService: true },
          { lang: 'es-MX', localService: false },
        ],
        expectedStatus: 'es-other',
        expectedReason: /es-\* voice/,
      },
      {
        name: 'reports none when no es-* voice exists at all',
        voices: [{ lang: 'en-US', localService: true }],
        expectedStatus: 'none',
        expectedReason: /no es-\* voice available/,
      },
    ];

    it.each(cases)('$name', async ({ voices, expectedStatus, expectedReason }) => {
      installFakeSynthesis(voices.map(makeVoice));
      const { tts, log } = await freshTts();
      const debugSpy = vi.spyOn(log, 'debug');

      const status = await tts.ensureVoiceResolved();
      expect(status).toBe(expectedStatus);

      const pickCall = debugSpy.mock.calls.find((call) => call[1] === 'voice pick');
      expect(pickCall).toBeDefined();
      const data = pickCall?.[2] as { status: string; reason: string };
      expect(data.status).toBe(expectedStatus);
      expect(data.reason).toMatch(expectedReason);
    });
  });

  describe('speak', () => {
    it('cancels any in-flight utterance before speaking', async () => {
      const synth = installFakeSynthesis([makeVoice({ lang: 'es-ES', localService: true })]);
      const { tts } = await freshTts();

      const promise = tts.speak('hola');
      await flushMicrotasks();

      expect(synth.cancel).toHaveBeenCalledTimes(1);
      expect(synth.speak).toHaveBeenCalledTimes(1);
      const cancelOrder = synth.cancel.mock.invocationCallOrder[0] as number;
      const speakOrder = synth.speak.mock.invocationCallOrder[0] as number;
      expect(cancelOrder).toBeLessThan(speakOrder);

      const utterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance;
      utterance.onend?.();
      await promise;
    });

    it('applies rate presets and the slower multiplier', async () => {
      const synth = installFakeSynthesis([makeVoice({ lang: 'es-ES', localService: true })]);
      const { tts } = await freshTts();

      const promise = tts.speak('tres', { rate: 'slow', slower: true });
      await flushMicrotasks();

      const utterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance;
      expect(utterance.rate).toBeCloseTo(0.75 * 0.5);
      utterance.onend?.();
      await promise;
    });

    it('defaults to normal rate with no slower multiplier', async () => {
      const synth = installFakeSynthesis([makeVoice({ lang: 'es-ES', localService: true })]);
      const { tts } = await freshTts();

      const promise = tts.speak('cuatro');
      await flushMicrotasks();

      const utterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance;
      expect(utterance.rate).toBe(1);
      utterance.onend?.();
      await promise;
    });

    it('resolves the promise on error and logs it', async () => {
      const synth = installFakeSynthesis([makeVoice({ lang: 'es-ES', localService: true })]);
      const { tts, log } = await freshTts();
      const errorSpy = vi.spyOn(log, 'error');

      const promise = tts.speak('cinco');
      await flushMicrotasks();

      const utterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance;
      utterance.onerror?.({ error: 'synthesis-failed' });
      await promise;

      expect(errorSpy).toHaveBeenCalledWith('tts', 'speech synthesis error', expect.anything());
    });

    it('logs a cancellation at debug rather than as a failure', async () => {
      const synth = installFakeSynthesis([makeVoice({ lang: 'es-ES', localService: true })]);
      const { tts, log } = await freshTts();
      const errorSpy = vi.spyOn(log, 'error').mockClear();
      const debugSpy = vi.spyOn(log, 'debug').mockClear();

      const promise = tts.speak('cinco');
      await flushMicrotasks();

      const utterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance;
      utterance.onerror?.({ error: 'canceled' });
      await promise;

      expect(debugSpy).toHaveBeenCalledWith('tts', 'speak canceled', expect.anything());
      expect(errorSpy).not.toHaveBeenCalledWith('tts', 'speech synthesis error', expect.anything());
    });

    it('tracks isSpeaking across the utterance lifecycle', async () => {
      const synth = installFakeSynthesis([makeVoice({ lang: 'es-ES', localService: true })]);
      const { tts } = await freshTts();

      expect(tts.isSpeaking()).toBe(false);
      const promise = tts.speak('seis');
      await flushMicrotasks();
      expect(tts.isSpeaking()).toBe(true);

      const utterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance;
      utterance.onend?.();
      await promise;
      expect(tts.isSpeaking()).toBe(false);
    });

    it('keeps isSpeaking true when a newer utterance cancels the previous one', async () => {
      const synth = installFakeSynthesis([makeVoice({ lang: 'es-ES', localService: true })]);
      const { tts } = await freshTts();

      const first = tts.speak('uno');
      await flushMicrotasks();
      const firstUtterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance;

      const second = tts.speak('dos');
      await flushMicrotasks();
      const secondUtterance = synth.speak.mock.calls[1]?.[0] as FakeUtterance;

      // cancel() makes the superseded utterance report an error only *after*
      // the replacement is already speaking - it must not clear the flag.
      firstUtterance.onerror?.({ error: 'canceled' });
      await first;
      expect(tts.isSpeaking()).toBe(true);

      secondUtterance.onend?.();
      await second;
      expect(tts.isSpeaking()).toBe(false);
    });

    it('logs an info entry when an utterance finishes', async () => {
      const synth = installFakeSynthesis([makeVoice({ lang: 'es-ES', localService: true })]);
      const { tts, log } = await freshTts();
      const infoSpy = vi.spyOn(log, 'info');

      const promise = tts.speak('ocho');
      await flushMicrotasks();
      const utterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance;
      utterance.onend?.();
      await promise;

      expect(infoSpy).toHaveBeenCalledWith('tts', 'speak finished', expect.anything());
    });

    it('no-ops without throwing when speechSynthesis is unavailable', async () => {
      vi.stubGlobal('speechSynthesis', undefined);
      const { tts } = await freshTts();
      await expect(tts.speak('siete')).resolves.toBeUndefined();
    });
  });

  describe('warmup', () => {
    it('speaks an empty, silent utterance to unlock iOS', async () => {
      const synth = installFakeSynthesis([]);
      const { tts } = await freshTts();
      tts.warmup();
      expect(synth.speak).toHaveBeenCalledTimes(1);
      const utterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance;
      expect(utterance.text).toBe('');
      expect(utterance.volume).toBe(0);
    });

    it('warns instead of throwing when unavailable', async () => {
      vi.stubGlobal('speechSynthesis', undefined);
      const { tts, log } = await freshTts();
      const warnSpy = vi.spyOn(log, 'warn');
      expect(() => tts.warmup()).not.toThrow();
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
