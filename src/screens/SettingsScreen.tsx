/**
 * Settings — see design-handoff/wordavi-design-v1/screens/settings.html.
 *
 * Two grouped cards ("практика" / "приложение") plus a standalone report row.
 * Every control writes through to storage on change and takes effect live; the
 * screen holds no draft state and has no save button. Navigation is callback
 * props only — the screen never decides what comes next.
 *
 * Beyond the mockup this screen also carries the data rows the PWA needs
 * (install, export, restore); they use the same nav-row pattern as "Сообщить о
 * проблеме" so the addition reads as part of the same list.
 */
import { type ChangeEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, CardRow, Pressable } from '@/components';
import { log } from '@/services/log';
import { showToast } from '@/services/toast';
import { clearAllData, exportData, importData } from '@/storage';
import {
  AccentsSetting,
  BackGlyph,
  GoalSetting,
  InstallSteps,
  installAffordance,
  LanguageSetting,
  RangeSetting,
  RoundSetting,
  runInstallPrompt,
  SoundsSetting,
  SpeechRateSetting,
  ThemeSetting,
  UI_NS,
  useSettingsState,
} from './settingsParts';

export interface SettingsScreenProps {
  onBack: () => void;
  onReport: () => void;
}

function backupFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `wordavi-backup-${date}.json`;
}

/** Saves a JSON string as a download. Returns false when the browser has no blob URLs. */
function downloadJson(json: string, filename: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    log.error(UI_NS, 'data export failed', { error: String(err) });
    return false;
  }
}

/**
 * Danger-filled confirm key. The design system has no destructive button
 * variant, so this composes the same way Button itself does — shelf physics
 * from Pressable, fill/size/type from tokens — rather than fighting Button's
 * own background utility (which wins or loses by stylesheet order, not by
 * class order).
 */
const RESET_CONFIRM_CLASS =
  'inline-flex h-(--size-cta) w-full items-center justify-center rounded-button ' +
  'bg-danger px-7 font-extrabold font-sans text-[1.0625rem] text-on-accent';

export function SettingsScreen({ onBack, onReport }: SettingsScreenProps) {
  const { t } = useTranslation();
  const { settings, update, reload } = useSettingsState();
  const [installStepsOpen, setInstallStepsOpen] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const affordance = installAffordance();

  function handleInstall(): void {
    if (affordance === 'prompt') {
      void runInstallPrompt();
      return;
    }
    setInstallStepsOpen(true);
  }

  function handleExport(): void {
    const filename = backupFilename();
    if (!downloadJson(exportData(), filename)) return;
    log.info(UI_NS, 'data exported', { filename });
    showToast({ text: t('toasts.export_ok') });
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    // Clearing the value lets the same file be picked twice in a row.
    event.target.value = '';
    if (!file) return;

    let result: ReturnType<typeof importData>;
    try {
      result = importData(await file.text());
    } catch (err) {
      log.error(UI_NS, 'import read failed', { error: String(err) });
      result = { ok: false, reason: 'parse' };
    }

    if (!result.ok) {
      log.warn(UI_NS, 'import rejected', { reason: result.reason });
      showToast({ text: t('toasts.import_bad') });
      return;
    }

    // The imported bundle carries its own language/theme/sounds — re-apply them
    // so the screen the user is looking at matches what was just restored.
    reload();
    log.info(UI_NS, 'data imported', {});
    showToast({ text: t('toasts.import_ok') });
  }

  function handleReset(): void {
    log.info(UI_NS, 'data reset', {});
    clearAllData();
    // Reload rather than re-render: in-memory caches (log ring, app state, the
    // settings this screen already read) only come back empty on a fresh boot,
    // which lands the user back in onboarding.
    location.reload();
  }

  return (
    <div className="screen">
      <header className="safe-top flex items-center gap-3 bg-surface px-screen pt-4 pb-2">
        <Button variant="icon" onClick={onBack} aria-label={t('common.back')}>
          <BackGlyph />
        </Button>
        <h1 className="font-bold font-display text-title">{t('settings.title')}</h1>
      </header>

      <div className="screen-content safe-bottom flex flex-col gap-3 px-screen pt-2 pb-6">
        <h2 className="font-extrabold text-overline text-text-muted tracking-wide">
          {t('settings.section_practice')}
        </h2>
        <Card variant="grouped">
          <RangeSetting settings={settings} update={update} />
          <AccentsSetting settings={settings} update={update} />
          <RoundSetting settings={settings} update={update} />
        </Card>

        <h2 className="mt-1 font-extrabold text-overline text-text-muted tracking-wide">
          {t('settings.section_app')}
        </h2>
        <Card variant="grouped">
          <LanguageSetting settings={settings} update={update} />
          <ThemeSetting settings={settings} update={update} />
          <SpeechRateSetting settings={settings} update={update} />
          <GoalSetting settings={settings} update={update} />
          <SoundsSetting settings={settings} update={update} />
          {affordance === 'hidden' ? null : (
            <CardRow
              label={t('settings.install_label')}
              sub={t('settings.install_sub')}
              onPress={handleInstall}
            />
          )}
          <CardRow
            label={t('settings.export_label')}
            sub={t('settings.export_sub')}
            onPress={handleExport}
          />
          <CardRow
            label={t('settings.import_label')}
            sub={t('settings.import_sub')}
            onPress={() => fileInput.current?.click()}
          />
        </Card>

        {installStepsOpen ? <InstallSteps onClose={() => setInstallStepsOpen(false)} /> : null}

        <Card variant="grouped">
          <CardRow label={t('settings.report_problem')} onPress={onReport} />
        </Card>

        {/* Destructive, so it lives last and confirms in place — a browser
            confirm() would be the one dialog in the app that isn't ours. */}
        <Card variant="grouped">
          {confirmingReset ? (
            <div className="flex flex-col gap-3 px-4 py-3.5">
              <span className="font-extrabold text-[15px] text-danger">
                {t('settings.reset_label')}
              </span>
              <p className="font-semibold text-caption text-text-muted leading-normal">
                {t('settings.reset_warning')}
              </p>
              <Pressable depth="raised" onClick={handleReset} className={RESET_CONFIRM_CLASS}>
                {t('settings.reset_confirm')}
              </Pressable>
              <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
                {t('settings.reset_cancel')}
              </Button>
            </div>
          ) : (
            <CardRow
              label={<span className="text-danger">{t('settings.reset_label')}</span>}
              onPress={() => setConfirmingReset(true)}
            />
          )}
        </Card>

        <p className="text-center font-semibold text-caption text-text-faint">
          {t('settings.version', { version: __APP_VERSION__ })}
        </p>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            void handleImportFile(event);
          }}
        />
      </div>
    </div>
  );
}
