import { useState } from 'react';
import type { StreakStampDay } from '@/components';
import {
  Chip,
  computePriceTagFontSizePx,
  Dots,
  GoalRing,
  PriceTag,
  ProgressRule,
  SkillBar,
  StreakStamps,
} from '@/components';
import { formatPrice, formatWeight } from '@/engine';
import { Case, DemoButton, Note, Row, Section, Stack } from './kit';
import { galleryT } from './t';

const ROUND_LENGTH = 8;

/** Three stamped days, today waiting, three still ahead. */
const STREAK_WEEK: readonly StreakStampDay[] = [
  { seedKey: '2026-07-19', state: 'done' },
  { seedKey: '2026-07-20', state: 'done' },
  { seedKey: '2026-07-21', state: 'done' },
  { seedKey: '2026-07-22', state: 'today' },
  { seedKey: '2026-07-23', state: 'future' },
  { seedKey: '2026-07-24', state: 'future' },
  { seedKey: '2026-07-25', state: 'future' },
];

const LONG_PROMPT = 'dos kilos y medio';

export function ProgressSection() {
  const t = galleryT();
  const [answered, setAnswered] = useState(3);
  const [sweep, setSweep] = useState(0);

  return (
    <Section
      id="progress"
      title="ProgressRule · GoalRing · SkillBar"
      compare="components/progress.md — screens/drill-text.html · home.html · stats.html"
    >
      <Stack>
        <Case label="ProgressRule — 0 / 40 / 100%">
          <ProgressRule value={0} aria-label="round progress — 0%" />
          <ProgressRule value={40} aria-label="round progress — 40%" />
          <ProgressRule value={100} aria-label="round progress — 100%" />
        </Case>
        <Case label={`ProgressRule — live, ${answered} / ${ROUND_LENGTH}`}>
          <ProgressRule
            value={answered}
            max={ROUND_LENGTH}
            aria-label={`round progress — ${answered} of ${ROUND_LENGTH}`}
          />
          <Row>
            <DemoButton
              onPress={() => setAnswered((n) => Math.min(ROUND_LENGTH, n + 1))}
            >{`+1 (${t('common.next')})`}</DemoButton>
            <DemoButton onPress={() => setAnswered(0)}>reset (instant jump)</DemoButton>
          </Row>
        </Case>
        <Case label="GoalRing — 56px dashboard / 72px result, with centre label">
          <Row>
            <GoalRing key={`sm-${sweep}`} value={12} max={20} sweep={sweep > 0}>
              <span className="font-bold font-display text-sub text-text numerals">60%</span>
            </GoalRing>
            <GoalRing key={`lg-${sweep}`} value={20} max={20} size="lg" sweep={sweep > 0}>
              <span className="font-bold font-display text-sub-strong text-text numerals">
                100%
              </span>
            </GoalRing>
            <GoalRing value={0} max={20}>
              <span className="font-bold font-display text-sub text-text-muted numerals">0%</span>
            </GoalRing>
          </Row>
          <Row>
            <DemoButton onPress={() => setSweep((n) => n + 1)}>replay sweep (600ms)</DemoButton>
          </Row>
        </Case>
        <Case label="SkillBar — normal / warn with paired flag chip">
          <SkillBar label={t('stats.skill_tens')} percent={86} />
          <SkillBar label={t('stats.skill_hundreds')} percent={62} />
          <SkillBar
            label={t('stats.skill_prices')}
            percent={41}
            warn
            flag={
              <Chip variant="flag" className="ml-2">
                {t('stats.needs_practice')}
              </Chip>
            }
          />
        </Case>
        <Note>
          The rule animates forward over 240ms and jumps back with no animation. Colour never
          carries the warning alone — the warn bar always ships with its flag chip.
        </Note>
      </Stack>
    </Section>
  );
}

export function StreakSection() {
  const t = galleryT();
  const [pop, setPop] = useState(0);

  return (
    <Section
      id="streak"
      title="StreakStamps"
      compare="components/streak-stamps.md — screens/stats.html · summary.html"
    >
      <Stack>
        <Case label="28px — three done (deterministic jitter), today dashed, three future">
          <StreakStamps
            key={`week-${pop}`}
            days={STREAK_WEEK}
            {...(pop > 0 ? { popIndex: 3 } : {})}
          />
          <Row>
            <DemoButton onPress={() => setPop((n) => n + 1)}>pop today (420ms)</DemoButton>
          </Row>
        </Case>
        <Case label="30px — the stats-screen variant">
          <StreakStamps days={STREAK_WEEK} size={30} />
        </Case>
        <Note>{t('stats.streak_today_sub', { count: 3 })}</Note>
      </Stack>
    </Section>
  );
}

export function PriceSection() {
  const t = galleryT();
  const [step, setStep] = useState(0);
  const price = formatPrice(2, 35);
  const weight = formatWeight(1500);
  const weightText = `${weight.value} ${weight.unit}`;

  return (
    <Section
      id="price"
      title="PriceTag · Dots"
      compare="components/price-tag.md — screens/drill-grocery.html · onboarding.html"
    >
      <Stack>
        <Case label={`price — ${computePriceTagFontSizePx(price)}px (full size)`}>
          <PriceTag>{price}</PriceTag>
        </Case>
        <Case label={`weight — ${computePriceTagFontSizePx(weightText)}px`}>
          <PriceTag>{weightText}</PriceTag>
        </Case>
        <Case label={`long phrase — ${computePriceTagFontSizePx(LONG_PROMPT)}px (auto-shrink)`}>
          <PriceTag>{LONG_PROMPT}</PriceTag>
        </Case>
        <Case label={`Dots — step ${step + 1} of 4`}>
          <Dots count={4} activeIndex={step} aria-label={`step ${step + 1} of 4`} />
          <Row>
            <DemoButton onPress={() => setStep((n) => (n + 1) % 4)}>{t('common.next')}</DemoButton>
            <DemoButton onPress={() => setStep(0)}>{t('common.back')}</DemoButton>
          </Row>
        </Case>
        <Note>
          Every tag keeps one line: the font size is a pure function of string length, floored at
          22px, and the punch hole stays vertically centred at every size.
        </Note>
      </Stack>
    </Section>
  );
}
