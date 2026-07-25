/**
 * One-time application boot, called from main.tsx before the first render.
 *
 * Everything here is cross-layer wiring that the layers themselves are not
 * allowed to do: storage cannot reach the logger, the session layer cannot
 * import services, and neither may touch i18n. The app layer owns those seams.
 */
import { detectLanguage, init as initI18n } from '@/i18n';
import { installGlobalErrorCapture, log } from '@/services/log';
import { setEnabled as setSoundsEnabled } from '@/services/sounds';
import { applyTheme } from '@/services/theme';
import { ensureVoiceResolved } from '@/services/tts';
import { setSessionLogger } from '@/session';
import { getSettings, initStorage, setStorageObserver, updateSettings } from '@/storage';

const NS = 'app';

let booted = false;

/**
 * Idempotent: React 19 StrictMode double-invokes effects and the module may be
 * imported from more than one entry point, so a second call must be a no-op
 * rather than a second set of global listeners.
 */
export function bootstrap(): void {
  if (booted) return;
  booted = true;

  initStorage();
  setStorageObserver((event) => {
    log.warn('storage', 'slot recovered', event);
  });

  installGlobalErrorCapture();

  setSessionLogger((level, msg, data) => {
    log[level]('session', msg, data);
  });

  const settings = getSettings();

  // Before onboarding, `settings.uiLang` is only the storage default — nobody
  // has chosen anything yet, so a first-time visitor is greeted in their own
  // browser language (this is the consumer that keeps `detectLanguage`
  // exported). It is persisted straight away so the install step, the language
  // step, `document.lang` and the settings screen all agree from the first
  // paint. Once onboarded, the stored choice always wins.
  const initialLang = settings.onboarded ? settings.uiLang : detectLanguage();
  initI18n({ initialLang });
  if (initialLang !== settings.uiLang) {
    updateSettings({ uiLang: initialLang });
    log.info(NS, 'first-run language detected', { uiLang: initialLang });
  }

  applyTheme(settings.theme);
  setSoundsEnabled(settings.soundsEnabled);

  // Chrome/Android report zero voices until `voiceschanged` fires. Start that
  // race now so the home screen knows whether to pause the listening modes
  // instead of pausing them all on first paint.
  void ensureVoiceResolved();

  log.info(NS, 'boot', { version: __APP_VERSION__ });
}
