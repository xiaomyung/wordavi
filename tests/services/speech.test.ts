import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
}

function createFakeInstance(): FakeRecognitionInstance {
  return {
    lang: '',
    continuous: false,
    interimResults: false,
    maxAlternatives: 1,
    onresult: null,
    onerror: null,
    onend: null,
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
  };
}

function makeResult(alternatives: string[], isFinal: boolean): SpeechRecognitionEvent {
  const result = { length: alternatives.length, isFinal } as SpeechRecognitionResult;
  const indexable = result as unknown as Record<number, SpeechRecognitionAlternative>;
  alternatives.forEach((transcript, i) => {
    indexable[i] = { transcript, confidence: 1 };
  });
  const list = { length: 1, 0: result } as unknown as SpeechRecognitionResultList;
  return { resultIndex: 0, results: list } as SpeechRecognitionEvent;
}

function makeErrorEvent(code: SpeechRecognitionErrorCode): SpeechRecognitionErrorEvent {
  return { error: code, message: '' } as SpeechRecognitionErrorEvent;
}

/**
 * `vi.fn()` mocks are not constructable with `new` in this environment, so
 * the fake constructor is a plain function that returns an explicit instance
 * (a constructor returning an object overrides `this`).
 */
function installFakeCtor(): { instances: FakeRecognitionInstance[] } {
  const instances: FakeRecognitionInstance[] = [];
  function FakeCtor(): FakeRecognitionInstance {
    const instance = createFakeInstance();
    instances.push(instance);
    return instance;
  }
  window.webkitSpeechRecognition = FakeCtor as unknown as SpeechRecognitionConstructor;
  return { instances };
}

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

async function freshSpeech(): Promise<{
  speech: typeof import('@/services/speech');
  log: typeof import('@/services/log').log;
}> {
  vi.resetModules();
  const logModule = await import('@/services/log');
  const speech = await import('@/services/speech');
  return { speech, log: logModule.log };
}

describe('speech', () => {
  beforeEach(() => {
    setOnline(true);
  });

  afterEach(() => {
    window.webkitSpeechRecognition = undefined;
    window.SpeechRecognition = undefined;
    setOnline(true);
  });

  it('reports unsupported when no recognition constructor exists', async () => {
    const { speech } = await freshSpeech();
    expect(speech.isRecognitionSupported()).toBe(false);
  });

  it('reports supported when webkitSpeechRecognition exists', async () => {
    installFakeCtor();
    const { speech } = await freshSpeech();
    expect(speech.isRecognitionSupported()).toBe(true);
  });

  it('short-circuits to a network error without starting when offline', async () => {
    const { instances } = installFakeCtor();
    setOnline(false);
    const { speech } = await freshSpeech();

    const onError = vi.fn();
    const handle = speech.startRecognition({ onFinal: vi.fn(), onError });

    expect(onError).toHaveBeenCalledWith('network');
    expect(instances).toHaveLength(0);
    expect(() => handle.stop()).not.toThrow();
  });

  it('reports other when unsupported and online', async () => {
    const { speech } = await freshSpeech();

    const onError = vi.fn();
    speech.startRecognition({ onFinal: vi.fn(), onError });
    expect(onError).toHaveBeenCalledWith('other');
  });

  it('starts recognition with es-ES lang and maxAlternatives 5 by default', async () => {
    const { instances } = installFakeCtor();
    const { speech } = await freshSpeech();

    speech.startRecognition({ onFinal: vi.fn(), onError: vi.fn() });
    const instance = instances[0];
    expect(instance).toBeDefined();
    expect(instance?.lang).toBe('es-ES');
    expect(instance?.maxAlternatives).toBe(5);
    expect(instance?.start).toHaveBeenCalledTimes(1);
  });

  it('respects a custom lang', async () => {
    const { instances } = installFakeCtor();
    const { speech } = await freshSpeech();

    speech.startRecognition({ lang: 'en-US', onFinal: vi.fn(), onError: vi.fn() });
    expect(instances[0]?.lang).toBe('en-US');
  });

  it('forwards final alternatives to onFinal', async () => {
    const { instances } = installFakeCtor();
    const { speech } = await freshSpeech();

    const onFinal = vi.fn();
    speech.startRecognition({ onFinal, onError: vi.fn() });
    instances[0]?.onresult?.(makeResult(['tres', 'trece', 'seis', 'diez', 'doce'], true));

    expect(onFinal).toHaveBeenCalledWith(['tres', 'trece', 'seis', 'diez', 'doce']);
  });

  it('forwards interim results to the interim callback, not onFinal', async () => {
    const { instances } = installFakeCtor();
    const { speech } = await freshSpeech();

    const onFinal = vi.fn();
    const interim = vi.fn();
    speech.startRecognition({ onFinal, onError: vi.fn(), interim });
    instances[0]?.onresult?.(makeResult(['tre'], false));

    expect(interim).toHaveBeenCalledWith('tre');
    expect(onFinal).not.toHaveBeenCalled();
  });

  it.each([
    ['no-speech', 'no-speech'],
    ['not-allowed', 'denied'],
    ['service-not-allowed', 'denied'],
    ['network', 'network'],
    ['aborted', 'aborted'],
    ['audio-capture', 'other'],
    ['language-not-supported', 'other'],
  ] as const)('maps recognition error %s to %s', async (code, expected) => {
    const { instances } = installFakeCtor();
    const { speech } = await freshSpeech();

    const onError = vi.fn();
    speech.startRecognition({ onFinal: vi.fn(), onError });
    instances[0]?.onerror?.(makeErrorEvent(code));

    expect(onError).toHaveBeenCalledWith(expected);
  });

  it('logs an error when a recognition error occurs', async () => {
    const { instances } = installFakeCtor();
    const { speech, log } = await freshSpeech();
    const errorSpy = vi.spyOn(log, 'error');

    speech.startRecognition({ onFinal: vi.fn(), onError: vi.fn() });
    instances[0]?.onerror?.(makeErrorEvent('network'));

    expect(errorSpy).toHaveBeenCalledWith('speech', 'recognition error', expect.anything());
  });

  it('logs recognition start and stop at info level', async () => {
    const { instances } = installFakeCtor();
    const { speech, log } = await freshSpeech();
    const infoSpy = vi.spyOn(log, 'info');

    const handle = speech.startRecognition({ onFinal: vi.fn(), onError: vi.fn() });
    expect(infoSpy).toHaveBeenCalledWith(
      'speech',
      'recognition start requested',
      expect.anything(),
    );

    handle.stop();
    expect(infoSpy).toHaveBeenCalledWith('speech', 'recognition stop requested', expect.anything());

    instances[0]?.onend?.();
    expect(infoSpy).toHaveBeenCalledWith('speech', 'recognition ended', {
      lang: 'es-ES',
      explicitStop: true,
    });
  });

  it('logs an end that was not requested by the caller', async () => {
    const { instances } = installFakeCtor();
    const { speech, log } = await freshSpeech();
    const infoSpy = vi.spyOn(log, 'info');

    speech.startRecognition({ onFinal: vi.fn(), onError: vi.fn() });
    instances[0]?.onend?.();

    expect(infoSpy).toHaveBeenCalledWith('speech', 'recognition ended', {
      lang: 'es-ES',
      explicitStop: false,
    });
  });

  it('stop() calls the underlying stop exactly once', async () => {
    const { instances } = installFakeCtor();
    const { speech } = await freshSpeech();

    const handle = speech.startRecognition({ onFinal: vi.fn(), onError: vi.fn() });
    handle.stop();
    handle.stop();

    expect(instances[0]?.stop).toHaveBeenCalledTimes(1);
  });
});
