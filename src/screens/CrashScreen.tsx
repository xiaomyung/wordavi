/**
 * Crash fallback — what the error boundary renders when a screen throws.
 *
 * Calm and warm on purpose (copy.md): apologise, offer a way out, offer a way
 * to tell us. No stack traces, no error codes, no blame — the diagnostics the
 * developer needs travel with the report screen instead.
 */
import { useTranslation } from 'react-i18next';
import { Button } from '@/components';

export interface CrashScreenProps {
  onRestart: () => void;
  onReport: () => void;
}

export function CrashScreen({ onRestart, onReport }: CrashScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="safe-area flex min-h-dvh flex-col items-center justify-center gap-8 px-screen text-center">
      <div className="flex flex-col gap-2">
        <h1 className="font-bold font-display text-title-lg leading-tight">{t('crash.title')}</h1>
        <p className="mx-auto max-w-[19rem] font-semibold text-body text-text-muted leading-normal">
          {t('crash.sub')}
        </p>
      </div>
      <div className="flex w-full flex-col gap-3">
        <Button variant="primary" size="tall" onClick={onRestart}>
          {t('crash.restart')}
        </Button>
        <Button variant="ghost" onClick={onReport}>
          {t('crash.report')}
        </Button>
      </div>
    </div>
  );
}
