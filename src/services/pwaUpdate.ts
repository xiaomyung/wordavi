/**
 * Service-worker lifecycle for the installed app.
 *
 * The plugin is configured with `registerType: 'prompt'`, so a freshly built
 * worker sits in `waiting` until the learner accepts it. Accepting reloads the
 * page — which is why the offer is never made during a drill: the round in
 * progress would be thrown away mid-question. An update that arrives mid-drill
 * is parked and re-offered on the next screen change.
 */
import i18n from '@/i18n';
import { log } from '@/services/log';
import { showToast } from '@/services/toast';

const NS = 'pwa';

type ApplyUpdate = (reloadPage?: boolean) => Promise<void>;

export interface PwaUpdateHooks {
  /**
   * True while the learner must not be interrupted (a drill in progress). Read
   * at offer time, so it has to answer for right now rather than for whatever
   * was true at registration. Which screens count is the app's business, not
   * this module's.
   */
  isBusy: () => boolean;
}

let isBusy: () => boolean = () => false;
let applyUpdate: ApplyUpdate | null = null;
/** A worker is waiting but the learner has not been asked yet. */
let updateParked = false;
let registered = false;

function offerUpdate(): void {
  if (!updateParked || applyUpdate === null) return;
  if (isBusy()) {
    log.debug(NS, 'update parked until the learner is free');
    return;
  }

  const apply = applyUpdate;
  updateParked = false;
  log.info(NS, 'update offered');
  showToast({
    text: i18n.t('toasts.update_ready'),
    action: {
      label: i18n.t('toasts.update_action'),
      onPress: () => {
        log.info(NS, 'update accepted');
        void apply(true);
      },
    },
  });
}

/** Registers the service worker (once) and starts watching for updates. */
export function initPwaUpdate(hooks: PwaUpdateHooks): void {
  isBusy = hooks.isBusy;
  if (registered) return;
  registered = true;

  // Loaded lazily so dev and test runs never pull in the virtual module: the
  // caller guards on import.meta.env.PROD, and this keeps that guard honest.
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      applyUpdate = registerSW({
        // Registering on `load` would be a no-op when that event has already
        // fired by the time the app mounts.
        immediate: true,
        onNeedRefresh() {
          log.info(NS, 'new version waiting');
          updateParked = true;
          offerUpdate();
        },
        // No toast: the first install succeeding is not news to the learner.
        onOfflineReady() {
          log.info(NS, 'offline ready');
        },
        onRegisterError(error) {
          log.warn(NS, 'registration failed', { error: String(error) });
        },
      });
    })
    .catch((error: unknown) => {
      log.warn(NS, 'service worker unavailable', { error: String(error) });
    });
}

/** Re-offers a parked update. The app calls this whenever `isBusy` may have flipped. */
export function notifyScreenChanged(): void {
  offerUpdate();
}
