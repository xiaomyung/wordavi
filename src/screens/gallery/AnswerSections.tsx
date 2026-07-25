import { useRef, useState } from 'react';
import type { AnswerInputHandle } from '@/components';
import { AccentKeys, AnswerInput, Stamp, VerdictBlock } from '@/components';
import { Case, DemoButton, Note, noop, Row, Section, Stack } from './kit';
import { galleryT } from './t';

const LONG_ANSWER = 'novecientos ochenta y siete mil seiscientos cincuenta y cuatro';

export function AccentKeysSection() {
  const t = galleryT();
  const inputRef = useRef<AnswerInputHandle>(null);
  const [value, setValue] = useState('veintis');

  return (
    <Section id="accent-keys" title="AccentKeys" compare="screens/drill-text.html">
      <Stack>
        <Case label="live — inserts at the caret of the field above">
          <AnswerInput
            ref={inputRef}
            mode="words"
            value={value}
            onChange={setValue}
            placeholder={t('drill.type_placeholder')}
            aria-label={t('drill.type_placeholder')}
          />
          <AccentKeys
            label={t('drill.type_instead')}
            onInsert={(char) => inputRef.current?.insertAtCaret(char)}
          />
        </Case>
        <Case label="disabled">
          <AccentKeys label={t('drill.type_instead')} disabled onInsert={noop} />
        </Case>
        <Note>
          Put the caret mid-word, then tap a key: the character splices in at the caret, the caret
          survives the re-render, and the inserted glyph flashes accent-coloured for 300ms. Tapping
          a key must never steal focus from the field.
        </Note>
      </Stack>
    </Section>
  );
}

export function AnswerInputSection() {
  const t = galleryT();
  const [words, setWords] = useState('');
  const [digits, setDigits] = useState('250');

  return (
    <Section
      id="answer-input"
      title="AnswerInput"
      compare="screens/drill-text.html · drill-digits.html"
    >
      <Stack>
        <Case label="words — idle, placeholder hint">
          <AnswerInput
            mode="words"
            value={words}
            onChange={setWords}
            placeholder={t('drill.type_placeholder')}
            aria-label={t('drill.type_placeholder')}
          />
        </Case>
        <Case label="digits — inputmode decimal, tabular figures">
          <AnswerInput
            mode="digits"
            value={digits}
            onChange={setDigits}
            placeholder={t('drill.digits_placeholder')}
            aria-label={t('drill.digits_placeholder')}
          />
        </Case>
        <Case label="verdict correct — read-only, stamped">
          <AnswerInput
            mode="words"
            verdict="correct"
            value="cuatrocientos setenta y cinco"
            onChange={noop}
            aria-label={t('drill.type_placeholder')}
          />
        </Case>
        <Case label="verdict almost — missing accent, still counted">
          <AnswerInput
            mode="words"
            verdict="almost"
            value="veintiseis"
            onChange={noop}
            aria-label={t('drill.type_placeholder')}
          />
        </Case>
        <Case label="verdict wrong — never shakes">
          <AnswerInput
            mode="digits"
            verdict="wrong"
            value="940"
            onChange={noop}
            aria-label={t('drill.digits_placeholder')}
          />
        </Case>
        <Case label="long value — grows to two lines, then clips">
          <AnswerInput
            mode="words"
            value={LONG_ANSWER}
            onChange={noop}
            aria-label={t('drill.type_placeholder')}
          />
        </Case>
        <Note>
          Focus the two live fields to check the accent border and caret. The three verdict fields
          are frozen read-only: typing must do nothing, and the stamp sits inside the field.
        </Note>
      </Stack>
    </Section>
  );
}

export function VerdictSection() {
  const t = galleryT();
  return (
    <Section
      id="verdict"
      title="VerdictBlock"
      compare="screens/drill-text.html · drill-mic.html (muted)"
    >
      <Stack>
        <Case label="correct">
          <VerdictBlock
            verdict="correct"
            title={t('verdict.correct')}
            sub={t('verdict.correct_sub', { n: 3 })}
          />
        </Case>
        <Case label="almost">
          <VerdictBlock
            verdict="almost"
            title={t('verdict.almost', { word: 'veintiséis' })}
            sub={t('verdict.almost_sub')}
          />
        </Case>
        <Case label="wrong — as the drill words it (verdict-copy.ts)">
          <VerdictBlock
            verdict="wrong"
            title={t('verdict.wrong', { answer: 'novecientos catorce' })}
            sub={t('verdict.wrong_sub_plain')}
          />
        </Case>
        <Case label="wrong — with a confusable hint (string exists, no mode emits it yet)">
          <VerdictBlock
            verdict="wrong"
            title={t('verdict.wrong', { answer: 'novecientos catorce' })}
            sub={t('verdict.wrong_sub', { hint: '914' })}
          />
        </Case>
        <Case label="muted — neutral info line, crossed-mic icon">
          <VerdictBlock
            variant="muted"
            title={t('drill.mic_denied')}
            sub={t('drill.mic_denied_sub')}
          />
        </Case>
      </Stack>
    </Section>
  );
}

export function StampSection() {
  const [replay, setReplay] = useState(0);
  return (
    <Section
      id="stamp"
      title="Stamp"
      compare="components/answer-input.md — screens/drill-text.html"
    >
      <Stack>
        <Case label="26px — correct / almost / wrong">
          <Row>
            <Stamp key={`correct-${replay}`} verdict="correct" animate />
            <Stamp key={`almost-${replay}`} verdict="almost" animate />
            <Stamp key={`wrong-${replay}`} verdict="wrong" animate />
          </Row>
        </Case>
        <Case label="22px — inline size used by VerdictBlock">
          <Row>
            <Stamp verdict="correct" size={22} />
            <Stamp verdict="almost" size={22} />
            <Stamp verdict="wrong" size={22} />
          </Row>
        </Case>
        <Row>
          <DemoButton onPress={() => setReplay((n) => n + 1)}>replay pop</DemoButton>
        </Row>
        <Note>
          The pop runs scale .6→1.1→1 with a −16°→−8° rotation, once, on mount. The ring stroke is
          non-scaling, so it stays 2px at both sizes.
        </Note>
      </Stack>
    </Section>
  );
}
