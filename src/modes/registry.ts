import type { Capability, LearningMode, ModeId } from './types';
import { MODE_ORDER } from './types';

/**
 * Mode registry. Registration is explicit (see index.ts) rather than glob-based,
 * so the bundle graph and the home-screen order are both readable in one file.
 */

const modes = new Map<ModeId, LearningMode>();

export function registerMode(mode: LearningMode): void {
  modes.set(mode.id, mode);
}

/** Lookup by a known id. Throws on a miss — that can only be a wiring bug. */
export function getMode(id: ModeId): LearningMode {
  const mode = modes.get(id);
  if (mode === undefined) {
    throw new Error(`getMode: mode "${id}" is not registered`);
  }
  return mode;
}

/** Lookup by an untrusted string (a persisted `RoundConfig.modeId`). */
export function findMode(id: string): LearningMode | undefined {
  return modes.get(id as ModeId);
}

/** Every registered mode in {@link MODE_ORDER} — the home-screen order. */
export function allModes(): LearningMode[] {
  return MODE_ORDER.map((id) => modes.get(id)).filter((mode): mode is LearningMode => {
    return mode !== undefined;
  });
}

/**
 * Capabilities a mode cannot run without. Availability *filtering* is the
 * screens' job — they own the services that can answer whether a capability is
 * actually present.
 */
export function modeRequires(id: ModeId): readonly Capability[] {
  return getMode(id).requires;
}
