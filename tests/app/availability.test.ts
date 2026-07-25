import { describe, expect, it } from 'vitest';
import { availableModeIds, modeStatus } from '@/app/availability';
import type { SingleModeId } from '@/modes';
import { allModes, getMode } from '@/modes';
import type { VoiceStatus } from '@/services/tts';

interface Env {
  online: boolean;
  voice: VoiceStatus;
  micSupported: boolean;
}

/** The bleakest device the app still has to be useful on: no voice, no mic, no network. */
const BARE: Env = { online: false, voice: 'none', micSupported: false };

function statusOf(id: SingleModeId, over: Partial<Env> = {}) {
  const { online, voice, micSupported } = { ...BARE, ...over };
  return modeStatus(getMode(id), online, voice, micSupported);
}

describe('modeStatus', () => {
  it('keeps every typed mode startable on a device with nothing', () => {
    for (const id of ['words', 'digits', 'choice', 'grocery'] as const) {
      expect(statusOf(id), id).toBe('ok');
    }
  });

  it('pauses only the modes whose question cannot be posed', () => {
    expect(statusOf('listen', { online: true })).toBe('paused-voice');
    expect(statusOf('speak', { online: true, voice: 'es-ES' })).toBe('paused-mic');
  });

  it('reports offline before a missing capability', () => {
    expect(statusOf('listen')).toBe('paused-offline');
    expect(statusOf('speak')).toBe('paused-offline');
  });

  it('clears every mode once the browser has voice, mic and network', () => {
    for (const mode of allModes()) {
      expect(modeStatus(mode, true, 'es-ES', true), mode.id).toBe('ok');
    }
  });
});

describe('availableModeIds', () => {
  it('still offers the shop-counter mode with no voice installed', () => {
    expect(availableModeIds(true, 'none', true)).toContain('grocery');
  });

  it('offers exactly the typed modes on a bare device', () => {
    expect(availableModeIds(BARE.online, BARE.voice, BARE.micSupported)).toEqual([
      'words',
      'digits',
      'choice',
      'grocery',
    ]);
  });
});
