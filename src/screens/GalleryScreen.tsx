/**
 * Hidden component gallery — reachable only via `?gallery=1`.
 *
 * Purpose: a visual smokecheck of every exported component against
 * `design-handoff/wordavi-design-v1/screens/*.html`, and a stable target for
 * Playwright visual-regression baselines. Each section names the component and
 * the mockup file to open beside it; specimens that only exist as a motion or
 * press state carry a gallery-only trigger (dashed pill) to replay them.
 *
 * Dark mode is not duplicated per specimen — the theme control in the sticky
 * bar flips the whole page exactly the way the app does, so what you compare is
 * always the real cascade.
 */
import { useState } from 'react';
import type { SegmentedOption } from '@/components';
import { ScrollArea, Segmented } from '@/components';
import { applyTheme, type ThemePref } from '@/services/theme';
import {
  AccentKeysSection,
  AnswerInputSection,
  StampSection,
  VerdictSection,
} from './gallery/AnswerSections';
import { ButtonsSection, ChoiceSection } from './gallery/ButtonSections';
import { SlidersSection, SwitchesSection } from './gallery/ControlSections';
import { GALLERY_SECTIONS } from './gallery/nav';
import { PriceSection, ProgressSection, StreakSection } from './gallery/ProgressSections';
import {
  CardsSection,
  ChipsSection,
  GalleryToaster,
  ToastSection,
} from './gallery/SurfaceSections';
import { galleryT } from './gallery/t';
import { MicSection, SpeakerSection } from './gallery/VoiceSections';

export function GalleryScreen() {
  const t = galleryT();
  const [theme, setTheme] = useState<ThemePref>('auto');

  const themeOptions: readonly SegmentedOption<ThemePref>[] = [
    { value: 'light', label: t('settings.theme_light') },
    { value: 'dark', label: t('settings.theme_dark') },
    { value: 'auto', label: t('settings.theme_auto') },
  ];

  function chooseTheme(next: ThemePref): void {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className="screen">
      <header className="safe-top flex flex-col gap-2 border-border border-b bg-surface px-screen pt-3 pb-2">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-bold font-display text-accent text-title">gallery</h1>
          <span className="font-semibold text-caption text-text-faint">v{__APP_VERSION__}</span>
        </div>
        <Segmented
          options={themeOptions}
          value={theme}
          onChange={chooseTheme}
          aria-label={t('settings.theme_label')}
        />
        <nav aria-label="sections" className="-mx-screen overflow-x-auto px-screen">
          <ul className="flex w-max gap-1.5 pb-1">
            {GALLERY_SECTIONS.map((entry) => (
              <li key={entry.id}>
                <a
                  href={`#${entry.id}`}
                  className="inline-flex items-center whitespace-nowrap rounded-pill bg-surface-sunken px-2.5 py-1 font-extrabold text-overline text-text-muted"
                >
                  {entry.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <ScrollArea className="safe-bottom flex flex-col gap-10 px-screen py-6">
        <ButtonsSection />
        <ChoiceSection />
        <AccentKeysSection />
        <AnswerInputSection />
        <VerdictSection />
        <StampSection />
        <MicSection />
        <SpeakerSection />
        <SwitchesSection />
        <SlidersSection />
        <CardsSection />
        <ChipsSection />
        <ToastSection />
        <ProgressSection />
        <StreakSection />
        <PriceSection />
      </ScrollArea>

      <GalleryToaster />
    </div>
  );
}
