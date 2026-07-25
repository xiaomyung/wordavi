/**
 * Module mocks shared by more than one suite.
 */
import { vi } from 'vitest';
import type { InstallPromptOutcome } from '@/services/install';

/** Stands in for the install service's own availability bus (prompt captured / installed). */
export interface InstallBus {
  listeners: Set<() => void>;
}

/**
 * The `@/services/install` mock every screen carrying an install affordance
 * needs: nothing captured, not iOS, not installed — the quiet default the rest
 * of each suite assumes — plus a bus a test can fire to make the prompt appear.
 *
 * `vi.mock` factories are hoisted above the file's imports, so this must be
 * pulled in from inside the factory and the bus must come from `vi.hoisted`:
 *
 * ```ts
 * const installBus = vi.hoisted(() => ({ listeners: new Set<() => void>() }));
 * vi.mock('@/services/install', async () => {
 *   const { installMock } = await import('../helpers/mocks');
 *   return installMock(installBus);
 * });
 * ```
 *
 * Typed as the real module, so an export added to the service fails typecheck
 * here instead of silently going unmocked.
 */
export function installMock(bus: InstallBus): typeof import('@/services/install') {
  return {
    canPromptInstall: vi.fn(() => false),
    isIos: vi.fn(() => false),
    isStandalone: vi.fn(() => false),
    isInstalled: vi.fn(async () => false),
    onInstallAvailabilityChange: (listener: () => void) => {
      bus.listeners.add(listener);
      return () => bus.listeners.delete(listener);
    },
    promptInstall: vi.fn(async (): Promise<InstallPromptOutcome> => 'accepted'),
  };
}
