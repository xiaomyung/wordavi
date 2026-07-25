import { useState } from 'react';
import type { SegmentedOption } from '@/components';
import { RangeSlider, Segmented, Stepper, StopSlider, Toggle } from '@/components';
import { formatNumber } from '@/engine';
import { Case, Note, noop, Row, Section, Stack } from './kit';
import { galleryT } from './t';

/** Questions-per-round stops; the last one is the endless round (∞). */
const ROUND_STOPS = [10, 15, 20, 25, 30, Number.POSITIVE_INFINITY];

type UiLang = 'ru' | 'en' | 'es';

export function SwitchesSection() {
  const t = galleryT();
  const [accents, setAccents] = useState(true);
  const [sounds, setSounds] = useState(false);
  const [roundIndex, setRoundIndex] = useState(2);
  const [lang, setLang] = useState<UiLang>('ru');

  const round = ROUND_STOPS[roundIndex] ?? 20;
  const langOptions: readonly SegmentedOption<UiLang>[] = [
    { value: 'ru', label: t('settings.language_ru') },
    { value: 'en', label: t('settings.language_en'), lang: 'en' },
    { value: 'es', label: t('settings.language_es'), lang: 'es' },
  ];

  return (
    <Section id="switches" title="Toggle · Stepper · Segmented" compare="screens/settings.html">
      <Stack>
        <Case label="Toggle — live on / live off">
          <Row>
            <Toggle
              checked={accents}
              onChange={setAccents}
              aria-label={t('settings.accents_label')}
            />
            <Toggle checked={sounds} onChange={setSounds} aria-label={t('settings.sounds_label')} />
          </Row>
        </Case>
        <Case label="Toggle — disabled on / disabled off (dim never reaches the knob)">
          <Row>
            <Toggle checked disabled onChange={noop} aria-label={t('settings.accents_label')} />
            <Toggle
              checked={false}
              disabled
              onChange={noop}
              aria-label={t('settings.sounds_label')}
            />
          </Row>
        </Case>
        <Case label="Stepper — live, ends clamp, top stop is the endless round">
          <Stepper
            aria-label={t('settings.questions_per_round_label')}
            canDecrement={roundIndex > 0}
            canIncrement={roundIndex < ROUND_STOPS.length - 1}
            onDecrement={() => setRoundIndex((index) => Math.max(0, index - 1))}
            onIncrement={() =>
              setRoundIndex((index) => Math.min(ROUND_STOPS.length - 1, index + 1))
            }
          >
            {Number.isFinite(round) ? round : t('common.endless')}
          </Stepper>
        </Case>
        <Case label="Segmented — three RU/EN/ES options, roving tabindex">
          <Segmented
            options={langOptions}
            value={lang}
            onChange={setLang}
            aria-label={t('settings.ui_language_label')}
          />
        </Case>
        <Note>
          Step to both ends: the disabled key loses its border and shelf. In the segmented control
          arrow keys move selection with focus, and long labels wrap instead of clipping.
        </Note>
      </Stack>
    </Section>
  );
}

export function SlidersSection() {
  const t = galleryT();
  const [range, setRange] = useState<[number, number]>([0, 100]);
  const [rate, setRate] = useState(1);

  const tickLabels = [
    t('settings.range_tick_0'),
    t('settings.range_tick_10'),
    t('settings.range_tick_100'),
    t('settings.range_tick_1k'),
    t('settings.range_tick_10k'),
    t('settings.range_tick_100k'),
    t('settings.range_tick_1m'),
  ];

  return (
    <Section id="sliders" title="RangeSlider · StopSlider" compare="screens/settings.html">
      <Stack>
        <Case label={`RangeSlider — live, ${formatNumber(range[0])} … ${formatNumber(range[1])}`}>
          <RangeSlider
            value={range}
            onChange={setRange}
            tickLabels={tickLabels}
            formatValue={formatNumber}
            minThumbLabel={`${t('settings.range_label')} — min`}
            maxThumbLabel={`${t('settings.range_label')} — max`}
          />
        </Case>
        <Case label="RangeSlider — disabled">
          <RangeSlider
            value={[100, 10_000]}
            onChange={noop}
            tickLabels={tickLabels}
            formatValue={formatNumber}
            minThumbLabel={`${t('settings.range_label')} — min`}
            maxThumbLabel={`${t('settings.range_label')} — max`}
            disabled
          />
        </Case>
        <Case label={`StopSlider — speech rate, ${tickStop(t, rate)}`}>
          <StopSlider
            stops={[t('settings.speed_slow'), t('settings.speed_normal'), t('settings.speed_fast')]}
            index={rate}
            onChange={setRate}
            ariaLabel={t('settings.speech_speed_label')}
          />
        </Case>
        <Note>
          Seven detents at equal visual spacing (0 · 10 · 100 · 1k · 10k · 100k · 1M), so each fine
          step takes the same width. Drag the span between the thumbs to move both; PageUp/PageDown
          jump detent to detent. Values read out thin-space grouped.
        </Note>
      </Stack>
    </Section>
  );
}

function tickStop(t: ReturnType<typeof galleryT>, index: number): string {
  if (index === 0) return t('settings.speed_slow');
  if (index === 2) return t('settings.speed_fast');
  return t('settings.speed_normal');
}
