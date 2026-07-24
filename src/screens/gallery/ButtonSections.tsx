import { Button, ChoiceButton, Pressable } from '@/components';
import { formatNumber } from '@/engine';
import { Case, Note, Row, Section, Stack } from './kit';
import { galleryT } from './t';

function SettingsGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  );
}

export function ButtonsSection() {
  const t = galleryT();
  return (
    <Section
      id="buttons"
      title="Pressable · Button"
      compare="components/buttons.md — screens/onboarding.html · home.html"
    >
      <Stack>
        <Case label="primary — resting / disabled">
          <Row>
            <Button>{t('common.check')}</Button>
            <Button disabled>{t('common.check')}</Button>
          </Row>
        </Case>
        <Case label="primary tall (60px) — resting / disabled">
          <Button size="tall" className="w-full">
            {t('onboarding.step4_cta')}
          </Button>
          <Button size="tall" className="w-full" disabled>
            {t('onboarding.step4_cta')}
          </Button>
        </Case>
        <Case label="secondary — resting / disabled">
          <Row>
            <Button variant="secondary">{t('common.next')}</Button>
            <Button variant="secondary" disabled>
              {t('common.next')}
            </Button>
          </Row>
        </Case>
        <Case label="ghost — resting / disabled">
          <Row>
            <Button variant="ghost">{t('onboarding.step4_ghost')}</Button>
            <Button variant="ghost" disabled>
              {t('onboarding.step4_ghost')}
            </Button>
          </Row>
        </Case>
        <Case label="icon — resting / disabled">
          <Row>
            <Button variant="icon" aria-label={t('settings.title')}>
              <SettingsGlyph />
            </Button>
            <Button variant="icon" aria-label={t('settings.title')} disabled>
              <SettingsGlyph />
            </Button>
          </Row>
        </Case>
        <Case label="Pressable — bare physics primitive">
          <Row>
            <Pressable className="rounded-button bg-accent px-5 py-3 font-extrabold text-label text-on-accent">
              depth=primary · 3px
            </Pressable>
            <Pressable
              depth="raised"
              className="rounded-button border border-border bg-surface-raised px-5 py-3 font-extrabold text-label text-text"
            >
              depth=raised · 2px
            </Pressable>
          </Row>
        </Case>
        <Note>
          Resting shadows are only half the component. Press (or Tab, then hold Space) to see the
          shelf sink and the focus ring layer outside it — 3px travel on primary depth, 2px on
          raised. Disabled loses the shelf entirely.
        </Note>
      </Stack>
    </Section>
  );
}

export function ChoiceSection() {
  const t = galleryT();
  return (
    <Section id="choice" title="ChoiceButton" compare="screens/drill-choice.html">
      <Stack>
        <Case label="four states — 2×2 grid, as drilled">
          <div className="grid grid-cols-2 gap-3">
            <ChoiceButton>475</ChoiceButton>
            <ChoiceButton state="selected">914</ChoiceButton>
            <ChoiceButton state="revealedCorrect">26</ChoiceButton>
            <ChoiceButton state="chosenWrong">{formatNumber(1234)}</ChoiceButton>
          </div>
        </Case>
        <Case label="locked — idle tiles after a reveal (inert, no press)">
          <div className="grid grid-cols-2 gap-3">
            <ChoiceButton locked>475</ChoiceButton>
            <ChoiceButton locked>914</ChoiceButton>
          </div>
        </Case>
        <Note>
          {t('drill.choice_hint')} — idle keeps its 2px underside; every other state is flat. Press
          the idle tiles: the locked pair must not move.
        </Note>
      </Stack>
    </Section>
  );
}
