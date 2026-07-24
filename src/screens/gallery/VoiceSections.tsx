import { useState } from 'react';
import type { MicState } from '@/components';
import { MicButton, PillButton, SpeakerButton, Transcript } from '@/components';
import { Case, Note, Row, Section, Stack } from './kit';
import { galleryT } from './t';

const SAMPLE_TRANSCRIPT = 'cuatrocientos setenta y cin';

function SpeakerGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4z" fill="currentColor" />
    </svg>
  );
}

export function MicSection() {
  const t = galleryT();
  const [live, setLive] = useState<MicState>('idle');

  return (
    <Section id="mic" title="MicButton · Transcript" compare="screens/drill-mic.html">
      <Stack>
        <Case label="live — hold the button (pointer or Space) to enter holding">
          <Row>
            <MicButton
              state={live}
              onHoldStart={() => setLive('holding')}
              onHoldEnd={() => setLive('idle')}
              aria-label={t('drill.hold_to_talk')}
            />
          </Row>
        </Case>
        <Case label="holding — the app's only looping animation (two pulsing rings)">
          <Row>
            <MicButton state="holding" aria-label={t('drill.hold_to_talk')} />
          </Row>
        </Case>
        <Case label="denied — crossed, muted, inert">
          <Row>
            <MicButton state="denied" aria-label={t('drill.mic_denied')} />
          </Row>
        </Case>
        <Case label="Transcript — interim text with blinking caret">
          <Transcript text={SAMPLE_TRANSCRIPT} />
        </Case>
        <Case label="Transcript — empty, still reserving its line">
          <Transcript text="" />
        </Case>
        <Note>{t('drill.release_hint')}</Note>
      </Stack>
    </Section>
  );
}

export function SpeakerSection() {
  const t = galleryT();
  const [playing, setPlaying] = useState(false);
  const [slower, setSlower] = useState(true);

  return (
    <Section
      id="speaker"
      title="SpeakerButton · PillButton"
      compare="screens/drill-digits.html · drill-grocery.html"
    >
      <Stack>
        <Case label="resting / playing — arcs are static, never animated">
          <Row>
            <SpeakerButton
              playing={playing}
              onClick={() => setPlaying((on) => !on)}
              aria-label={t('drill.listen_again')}
            />
            <SpeakerButton playing aria-label={t('drill.listen_again')} />
          </Row>
        </Case>
        <Case label="PillButton — action / toggle on / disabled">
          <Row>
            <PillButton glyph={<SpeakerGlyph />}>{t('drill.listen')}</PillButton>
            <PillButton active={slower} onClick={() => setSlower((on) => !on)}>
              {t('drill.slower')}
            </PillButton>
            <PillButton disabled>{t('home.offline_chip')}</PillButton>
          </Row>
        </Case>
        <Note>
          Click the first speaker to toggle its arcs. The action pill carries no aria-pressed; the
          slower pill does — toggle it and watch the accent-tint fill.
        </Note>
      </Stack>
    </Section>
  );
}
