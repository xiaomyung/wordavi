import { useState, useSyncExternalStore } from 'react';
import type { ToasterItem } from '@/components';
import { Button, Card, CardRow, Chip, ModeRow, Toast, Toaster, Toggle } from '@/components';
import { getToast, pressToastAction, showToast, subscribe } from '@/services/toast';
import { Case, DemoButton, Note, noop, Row, Section, Stack } from './kit';
import { galleryT } from './t';

export function CardsSection() {
  const t = galleryT();
  const [sounds, setSounds] = useState(true);

  return (
    <Section
      id="cards"
      title="Card · CardRow · ModeRow"
      compare="screens/settings.html · home.html"
    >
      <Stack>
        <Case label="raised — the default shelf card">
          <Card>
            <span className="font-extrabold text-sub-strong">{t('home.goal_daily')}</span>
            <span className="font-semibold text-caption text-text-muted">
              {t('home.goal_sub', { done: 12, total: 20 })}
            </span>
          </Card>
        </Case>
        <Case label="grouped — rows with sub / trailing / nav chevron">
          <Card variant="grouped">
            <CardRow label={t('settings.accents_label')} sub={t('settings.accents_sub')} />
            <CardRow
              label={t('settings.sounds_label')}
              sub={t('settings.sounds_sub')}
              trailing={
                <Toggle
                  checked={sounds}
                  onChange={setSounds}
                  aria-label={t('settings.sounds_label')}
                />
              }
            />
            <CardRow
              label={t('settings.export_label')}
              sub={t('settings.export_sub')}
              onPress={noop}
            />
          </Card>
        </Case>
        <Case label="float — toasts, sheets, install prompt">
          <Card variant="float">
            <span className="font-extrabold text-sub-strong">{t('settings.install_label')}</span>
            <span className="font-semibold text-caption text-text-muted">
              {t('settings.install_sub')}
            </span>
          </Card>
        </Case>
        <Case label="paused — dashed, dimmed, offline content">
          <Card variant="paused">
            <span className="font-extrabold text-sub-strong text-text-muted">
              {t('modes.speak.title')}
            </span>
            <span className="font-semibold text-caption text-text-faint">
              {t('home.mode_paused_sub')}
            </span>
          </Card>
        </Case>
        <Case label="ModeRow — normal (chevron) / paused (chip, never a chevron)">
          <div className="flex flex-col gap-2.5">
            <ModeRow
              icon="€"
              title={t('modes.grocery.title')}
              sub={t('modes.grocery.example')}
              onPress={noop}
            />
            <ModeRow
              icon="123"
              title={t('modes.words.title')}
              sub={t('modes.words.example')}
              onPress={noop}
            />
            <ModeRow
              paused
              icon="◍"
              title={t('modes.speak.title')}
              sub={t('home.mode_paused_sub')}
              trailing={<Chip variant="offline">{t('home.offline_chip')}</Chip>}
            />
          </div>
        </Case>
      </Stack>
    </Section>
  );
}

export function ChipsSection() {
  const t = galleryT();
  const [combo, setCombo] = useState(3);

  return (
    <Section
      id="chips"
      title="Chip"
      compare="components/badges.md — screens/home.html · stats.html · drill-text.html"
    >
      <Stack>
        <Case label="score / combo / offline / flag / replay">
          <Row>
            <Chip variant="score">120</Chip>
            <Chip variant="combo" tick={combo}>{`×${combo}`}</Chip>
            <Chip variant="offline">{t('home.offline_chip')}</Chip>
            <Chip variant="flag">{t('stats.needs_practice')}</Chip>
            <Chip variant="replay">{t('drill.listen')}</Chip>
          </Row>
        </Case>
        <Row>
          <DemoButton onPress={() => setCombo((n) => n + 1)}>tick combo</DemoButton>
          <DemoButton onPress={() => setCombo(1)}>reset combo</DemoButton>
        </Row>
        <Note>
          Chips carry no shadow and no animation except the combo tick — a 160ms pulse fired only
          when the counter value changes.
        </Note>
      </Stack>
    </Section>
  );
}

export function ToastSection() {
  const t = galleryT();

  return (
    <Section id="toast" title="Toast · Toaster" compare="components/toast.md — screens/home.html">
      <Stack>
        <Case label="live — queued through services/toast, rendered by the Toaster below">
          <Row>
            <Button
              variant="secondary"
              onClick={() =>
                showToast({
                  text: t('toasts.update_ready'),
                  action: { label: t('toasts.update_action'), onPress: noop },
                })
              }
            >
              {t('toasts.update_action')}
            </Button>
            <Button variant="secondary" onClick={() => showToast({ text: t('toasts.offline') })}>
              {t('home.offline_chip')}
            </Button>
          </Row>
        </Case>
        <Case label="static — open / closed (fade + 6px rise)">
          <Toast open text={t('toasts.no_speech')} />
          <Toast
            open
            text={t('toasts.update_ready')}
            action={{ label: t('toasts.update_action'), onPress: noop }}
          />
          <Toast open={false} text={t('toasts.import_ok')} />
        </Case>
        <Note>
          Toasts queue: press both buttons quickly and the second waits for the first to
          auto-dismiss after 4s. The floating one is bottom-centered, above everything.
        </Note>
      </Stack>
    </Section>
  );
}

/**
 * The real toast surface, subscribed to the framework-free store the way
 * app/ToastHost does: one visible toast at a time, its action delegating back
 * to the store so the queue advances.
 */
export function GalleryToaster() {
  const toast = useSyncExternalStore(subscribe, getToast, getToast);
  const items: ToasterItem[] = toast
    ? [
        {
          id: String(toast.id),
          text: toast.text,
          ...(toast.action !== undefined
            ? { action: { label: toast.action.label, onPress: pressToastAction } }
            : {}),
        },
      ]
    : [];

  return <Toaster items={items} />;
}
