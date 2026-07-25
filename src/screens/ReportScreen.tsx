/**
 * Report a problem — a modal screen over whatever the user was doing.
 *
 * The user writes a note and optionally attaches screenshots; everything else
 * (version, UA, settings, error ring, recent log) is gathered by
 * services/report at send time. The diagnostics line is informational only:
 * it tells the user what travels with the report, and nothing there is
 * editable.
 *
 * A screenshot only travels when the browser can share files. Where it cannot,
 * the note under the actions says so while the sheet is still open and names
 * the file to attach, so the image is attached in the mail app instead of
 * quietly never arriving.
 */
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, CloseGlyph, ScrollArea } from '@/components';
import { getRecentLog, log } from '@/services/log';
import type { SendReportResult } from '@/services/report';
import { composeReport, copyReport, planReport, sendReport } from '@/services/report';
import { showToast } from '@/services/toast';
import { getErrors } from '@/storage';
import { UI_NS } from './log-ns';

export interface ReportScreenProps {
  onClose: () => void;
}

interface Shot {
  id: number;
  file: File;
  /** Empty when the browser has no blob URLs — the row still lists the name. */
  url: string;
}

const NOTE_CLASS = 'text-center font-semibold text-caption text-text-muted leading-normal';

/**
 * Screenshots the learner still has to attach in their mail app: what the
 * planned channel would drop while the sheet is open, and what the hand-off
 * actually dropped once it happened. A send that got nowhere reports none —
 * nothing reached a mail draft, so there is nothing to attach to yet.
 */
function droppedScreenshots(sent: SendReportResult | null, planned: number): number {
  if (sent === null) return planned;
  return sent.ok ? sent.droppedScreenshots : 0;
}

function previewUrl(file: File): string {
  try {
    return URL.createObjectURL(file);
  } catch {
    return '';
  }
}

function releasePreview(url: string): void {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* nothing to release */
  }
}

export function ReportScreen({ onClose }: ReportScreenProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [shots, setShots] = useState<Shot[]>([]);
  const [sent, setSent] = useState<SendReportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const fileInput = useRef<HTMLInputElement>(null);
  const [diagnostics] = useState(
    () => `v${__APP_VERSION__} · errors ${getErrors().length} · log ${getRecentLog().length}`,
  );

  const files = useMemo(() => shots.map((shot) => shot.file), [shots]);
  const plan = useMemo(() => planReport(files), [files]);
  const dropped = droppedScreenshots(sent, plan.droppedScreenshots);

  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  useEffect(() => {
    return () => {
      for (const shot of shotsRef.current) releasePreview(shot.url);
    };
  }, []);

  function handleFiles(event: ChangeEvent<HTMLInputElement>): void {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (picked.length === 0) return;
    // The last hand-off's advice was about a different set of screenshots.
    setSent(null);
    setShots((current) => [
      ...current,
      ...picked.map((file) => {
        const id = nextId.current;
        nextId.current += 1;
        return { id, file, url: previewUrl(file) };
      }),
    ]);
    log.info(UI_NS, 'report screenshots attached', { count: picked.length });
  }

  function removeShot(id: number): void {
    setSent(null);
    setShots((current) => {
      const gone = current.find((shot) => shot.id === id);
      if (gone) releasePreview(gone.url);
      return current.filter((shot) => shot.id !== id);
    });
  }

  async function handleSend(): Promise<void> {
    setBusy(true);
    const payload = composeReport({ userText: text, screenshots: files });
    // sendReport is total by contract, but a stuck spinner would leave the
    // learner with no way to send and no way to know why, so the release of the
    // busy flag does not depend on that contract holding.
    const result = await sendReport(payload).catch((err: unknown) => {
      log.error(UI_NS, 'report send threw', { error: String(err) });
      return { ok: false, channel: 'mailto', droppedScreenshots: 0 } satisfies SendReportResult;
    });
    setBusy(false);
    if (result.ok) showToast({ text: t('report.sent') });
    setSent(result);
  }

  async function handleCopy(): Promise<void> {
    const payload = composeReport({ userText: text, screenshots: files });
    const result = await copyReport(payload);
    showToast({ text: result.ok ? t('toasts.copied') : t('toasts.copy_failed') });
  }

  return (
    <div className="screen">
      <header className="safe-top flex items-center gap-3 bg-surface px-screen pt-4 pb-2">
        <Button variant="icon" onClick={onClose} aria-label={t('common.close')}>
          <CloseGlyph />
        </Button>
        <h1 className="font-bold font-display text-title">{t('report.title')}</h1>
      </header>

      <ScrollArea className="safe-bottom flex flex-col gap-4 px-screen pt-2 pb-6">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('report.describe_placeholder')}
          aria-label={t('report.title')}
          rows={5}
          className="w-full rounded-input border-[1.5px] border-border bg-surface-raised px-4 py-3.5 font-semibold text-body-lg text-text placeholder:text-text-faint"
        />

        <div className="flex flex-col gap-3">
          <Button variant="secondary" onClick={() => fileInput.current?.click()}>
            {t('report.attach_image')}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFiles}
          />
          {shots.length > 0 ? (
            <ul className="flex flex-wrap gap-2.5">
              {shots.map((shot) => (
                <li key={shot.id} className="relative">
                  <img
                    src={shot.url}
                    alt={shot.file.name}
                    className="size-20 rounded-key border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeShot(shot.id)}
                    aria-label={`${t('common.close')} · ${shot.file.name}`}
                    className="-top-1.5 -right-1.5 absolute flex size-6 items-center justify-center rounded-full border border-border bg-surface-raised font-extrabold text-text-muted"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <Card>
          <p className="numerals font-mono text-caption text-text-muted">{diagnostics}</p>
        </Card>

        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => {
              void handleSend();
            }}
          >
            {t('report.send')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              void handleCopy();
            }}
          >
            {t('report.copy')}
          </Button>
          {dropped > 0 ? (
            <p className={NOTE_CLASS}>
              {t('report.attach_by_hand', {
                count: dropped,
                files: files.map((file) => file.name).join(', '),
              })}
            </p>
          ) : null}
          {sent === null ? null : (
            <p className={NOTE_CLASS}>
              {sent.ok ? t('report.sent_hint') : t('report.send_failed')}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
