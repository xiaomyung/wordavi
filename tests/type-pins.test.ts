import { describe, expect, it } from 'vitest';
import type { ToastAction as ComponentToastAction, Verdict as StampVerdict } from '@/components';
import type { VerdictKind } from '@/engine';
import type { SupportedLang } from '@/i18n';
import type { VerdictKind as SoundsVerdictKind } from '@/services/sounds';
import type { ToastAction as ServiceToastAction } from '@/services/toast';
import type { UiLang } from '@/storage';

/**
 * Compile-time pins for types that are deliberately restated in a layer that is
 * not allowed to import the one that owns them (the layer contract in
 * architecture.test.ts is what forbids the import). Each pin stops `tsc`
 * compiling the moment the two spellings drift, which is the whole point — the
 * runtime assertion at the bottom only exists so vitest has something to run.
 *
 * `Mutual<A, B>` is `true` only when each side extends the other. The tuple
 * wrappers matter: a bare `A extends B` distributes over a union and would let
 * a copy that dropped a member still pass.
 */
type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

/** services/sounds picks a chime per verdict; the engine names the verdicts. */
const soundsVerdict: Mutual<SoundsVerdictKind, VerdictKind> = true;

/** components/Stamp draws one glyph per verdict, without importing the engine. */
const stampVerdict: Mutual<StampVerdict, VerdictKind> = true;

/** The toast store hands its action straight to the presentational component. */
const toastAction: Mutual<ServiceToastAction, ComponentToastAction> = true;

/** The stored UI language must be one i18n can actually load. */
const uiLang: Mutual<UiLang, SupportedLang> = true;

describe('cross-layer type pins', () => {
  it('keeps every restated type equivalent to the one it mirrors', () => {
    expect([soundsVerdict, stampVerdict, toastAction, uiLang]).toEqual([true, true, true, true]);
  });
});
