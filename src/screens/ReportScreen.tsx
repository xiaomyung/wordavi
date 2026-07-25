/**
 * Report a problem — a modal screen over whatever the user was doing.
 *
 * The user writes a note and optionally attaches screenshots; everything else
 * (version, UA, settings, error ring, recent log) is gathered by
 * services/report at send time. The diagnostics line is informational only:
 * it tells the user what travels with the report, and nothing there is
 * editable.
 */
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, CloseGlyph } from '@/components';
import { getRecentLog, log } from '@/services/log';
import { composeReport, copyReport, sendReport } from '@/services/report';
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

/** Follow-up line under the actions; the send channel decides which one shows. */
type SendNote = 'none' | 'sent' | 'attach';

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
  const [note, setNote] = useState<SendNote>('none');
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const fileInput = useRef<HTMLInputElement>(null);
  const [diagnostics] = useState(
    () => `v${__APP_VERSION__} · errors ${getErrors().length} · log ${getRecentLog().length}`,
  );

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
    setShots((current) => {
      const gone = current.find((shot) => shot.id === id);
      if (gone) releasePreview(gone.url);
      return current.filter((shot) => shot.id !== id);
    });
  }

  async function handleSend(): Promise<void> {
    setBusy(true);
    const payload = composeReport({ userText: text, screenshots: shots.map((shot) => shot.file) });
    const result = await sendReport(payload);
    setBusy(false);
    if (result.ok) showToast({ text: t('report.sent') });
    // A mailto hand-off can't carry files, and a failed send is worth the same
    // nudge: the user still has the option of attaching them by hand.
    setNote(result.ok && !result.manualAttachHint ? 'sent' : 'attach');
  }

  async function handleCopy(): Promise<void> {
    const payload = composeReport({ userText: text, screenshots: shots.map((shot) => shot.file) });
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

      <div className="screen-content safe-bottom flex flex-col gap-4 px-screen pt-2 pb-6">
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
          {note === 'none' ? null : (
            <p className="text-center font-semibold text-caption text-text-muted leading-normal">
              {note === 'sent' ? t('report.sent_hint') : t('report.mailto_fallback')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
