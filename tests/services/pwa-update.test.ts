import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The virtual module only exists inside a Vite build, and registering a real
 * worker is an e2e concern (see e2e/pwa.spec.ts). What matters here is the
 * decision layer on top of it: an update must never interrupt a drill.
 */
const applyUpdate = vi.fn(() => Promise.resolve());
let needRefresh: (() => void) | undefined;

vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: { onNeedRefresh?: () => void }) => {
    needRefresh = options.onNeedRefresh;
    return applyUpdate;
  },
}));

async function freshModules() {
  vi.resetModules();
  const i18n = await import('@/i18n');
  i18n.init({ initialLang: 'en' });
  const pwaUpdate = await import('@/services/pwaUpdate');
  const toast = await import('@/services/toast');
  return { pwaUpdate, toast };
}

describe('pwa update', () => {
  beforeEach(() => {
    applyUpdate.mockClear();
    needRefresh = undefined;
  });

  it('offers the update as a toast when the learner is not drilling', async () => {
    const { pwaUpdate, toast } = await freshModules();
    pwaUpdate.initPwaUpdate(() => 'home');
    await vi.waitFor(() => expect(needRefresh).toBeDefined());

    needRefresh?.();

    const shown = toast.getToast();
    expect(shown?.text).toBeTruthy();
    expect(shown?.action?.label).toBeTruthy();

    toast.pressToastAction();
    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('parks the offer during a drill and makes it on the next screen change', async () => {
    const { pwaUpdate, toast } = await freshModules();
    let screenKind = 'drill';
    pwaUpdate.initPwaUpdate(() => screenKind);
    await vi.waitFor(() => expect(needRefresh).toBeDefined());

    needRefresh?.();
    expect(toast.getToast()).toBeNull();

    // Still drilling (a re-render, not a navigation): still silent.
    pwaUpdate.notifyScreenChanged();
    expect(toast.getToast()).toBeNull();

    screenKind = 'summary';
    pwaUpdate.notifyScreenChanged();
    expect(toast.getToast()).not.toBeNull();
  });

  it('offers a parked update only once', async () => {
    const { pwaUpdate, toast } = await freshModules();
    pwaUpdate.initPwaUpdate(() => 'home');
    await vi.waitFor(() => expect(needRefresh).toBeDefined());

    needRefresh?.();
    toast.dismissToast();

    pwaUpdate.notifyScreenChanged();
    expect(toast.getToast()).toBeNull();
  });
});
