import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class FakeParam {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
}

class FakeOscillator {
  type = 'sine';
  frequency = new FakeParam();
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeGain {
  gain = new FakeParam();
  connect = vi.fn();
}

class FakeAudioContext {
  state: 'running' | 'suspended' = 'running';
  currentTime = 0;
  destination = {};
  createOscillator = vi.fn(() => new FakeOscillator());
  createGain = vi.fn(() => new FakeGain());
  resume = vi.fn(() => Promise.resolve());
}

/**
 * `vi.fn()` mocks are not constructable with `new` in this environment, so
 * the fake AudioContext constructor is a plain function that returns an
 * explicit instance (a constructor returning an object overrides `this`).
 */
function installFakeAudioContext(initialState: 'running' | 'suspended' = 'running'): {
  instances: FakeAudioContext[];
} {
  const instances: FakeAudioContext[] = [];
  function FakeCtor(): FakeAudioContext {
    const instance = new FakeAudioContext();
    instance.state = initialState;
    instances.push(instance);
    return instance;
  }
  vi.stubGlobal('AudioContext', FakeCtor);
  return { instances };
}

async function freshSounds(): Promise<{
  sounds: typeof import('@/services/sounds');
  log: typeof import('@/services/log').log;
}> {
  vi.resetModules();
  const logModule = await import('@/services/log');
  const sounds = await import('@/services/sounds');
  return { sounds, log: logModule.log };
}

describe('sounds', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to disabled', async () => {
    installFakeAudioContext();
    const { sounds } = await freshSounds();
    expect(sounds.isEnabled()).toBe(false);
  });

  it('does not create an AudioContext until the gate is enabled and a sound plays', async () => {
    const { instances } = installFakeAudioContext();
    const { sounds } = await freshSounds();

    sounds.playVerdict('correct');
    expect(instances).toHaveLength(0);

    sounds.setEnabled(true);
    sounds.playVerdict('correct');
    expect(instances).toHaveLength(1);
  });

  it('reuses a single AudioContext across multiple plays', async () => {
    const { instances } = installFakeAudioContext();
    const { sounds } = await freshSounds();
    sounds.setEnabled(true);

    sounds.playVerdict('correct');
    sounds.playVerdict('almost');
    sounds.playVerdict('wrong');

    expect(instances).toHaveLength(1);
  });

  it('plays a two-note chirp for correct', async () => {
    const { instances } = installFakeAudioContext();
    const { sounds } = await freshSounds();
    sounds.setEnabled(true);

    sounds.playVerdict('correct');
    const ctx = instances[0];
    expect(ctx?.createOscillator).toHaveBeenCalledTimes(2);
    expect(ctx?.createGain).toHaveBeenCalledTimes(2);
  });

  it('plays a single tone for almost and wrong', async () => {
    const { instances } = installFakeAudioContext();
    const { sounds } = await freshSounds();
    sounds.setEnabled(true);

    sounds.playVerdict('almost');
    expect(instances[0]?.createOscillator).toHaveBeenCalledTimes(1);

    sounds.playVerdict('wrong');
    expect(instances[0]?.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('keeps the master gain low', async () => {
    const { instances } = installFakeAudioContext();
    const { sounds } = await freshSounds();
    sounds.setEnabled(true);

    sounds.playVerdict('wrong');
    const ctx = instances[0];
    const gain = ctx?.createGain.mock.results[0]?.value as FakeGain;
    const rampCall = gain.gain.linearRampToValueAtTime.mock.calls[0];
    expect(rampCall?.[0]).toBeCloseTo(0.15);
  });

  it('warns and no-ops when AudioContext is unavailable', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const { sounds, log } = await freshSounds();
    sounds.setEnabled(true);
    const warnSpy = vi.spyOn(log, 'warn');

    expect(() => sounds.playVerdict('correct')).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('falls back to webkitAudioContext when the unprefixed constructor is missing', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const instances: FakeAudioContext[] = [];
    function FakeCtor(): FakeAudioContext {
      const instance = new FakeAudioContext();
      instances.push(instance);
      return instance;
    }
    window.webkitAudioContext = FakeCtor as unknown as typeof AudioContext;

    try {
      const { sounds, log } = await freshSounds();
      const warnSpy = vi.spyOn(log, 'warn');
      sounds.setEnabled(true);

      sounds.playVerdict('correct');

      expect(instances).toHaveLength(1);
      expect(warnSpy).toHaveBeenCalledWith('sounds', 'falling back to webkitAudioContext', {});
    } finally {
      window.webkitAudioContext = undefined;
    }
  });

  it('warmup creates the context and resumes it when suspended', async () => {
    const { instances } = installFakeAudioContext('suspended');
    const { sounds } = await freshSounds();

    sounds.warmup();

    expect(instances).toHaveLength(1);
    expect(instances[0]?.resume).toHaveBeenCalledTimes(1);
  });

  it('warmup does not double-create the context if already created', async () => {
    const { instances } = installFakeAudioContext();
    const { sounds } = await freshSounds();

    sounds.setEnabled(true);
    sounds.playVerdict('correct');
    sounds.warmup();

    expect(instances).toHaveLength(1);
  });

  it('setEnabled logs the gate change', async () => {
    installFakeAudioContext();
    const { sounds, log } = await freshSounds();
    const infoSpy = vi.spyOn(log, 'info');

    sounds.setEnabled(true);
    expect(infoSpy).toHaveBeenCalledWith('sounds', 'sounds setEnabled', { enabled: true });
  });
});
