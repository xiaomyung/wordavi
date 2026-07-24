import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildAccepted, numberToWords } from '@/engine';
import type { AnswerZoneProps, RecognitionHandlers } from '@/modes';
import { getMode, pickGiven } from '@/modes';
import type { Question } from '@/session';
import { labelsFor, stubServices } from './helpers';

const speak = getMode('speak');
const labels = labelsFor(speak);

function spokenQuestion(value: number): Question {
  return {
    id: `speak:n${value}`,
    bucket: 'twenties_fused',
    prompt: { kind: 'number', value },
    accepted: buildAccepted(numberToWords(value), []),
  };
}

/** Captures the handlers the answer zone hands to the recogniser. */
function recognitionSpy() {
  const stop = vi.fn();
  let handlers: RecognitionHandlers | null = null;
  const services = stubServices({
    startRecognition: (h: RecognitionHandlers) => {
      handlers = h;
      return { stop };
    },
  });
  return {
    services,
    stop,
    fire(): RecognitionHandlers {
      if (handlers === null) throw new Error('recognition was never started');
      return handlers;
    },
  };
}

function renderZone(over: Partial<AnswerZoneProps> = {}) {
  const props: AnswerZoneProps = {
    question: spokenQuestion(26),
    services: stubServices(),
    verdict: null,
    expectedDisplay: '26',
    onSubmit: vi.fn(),
    micDenied: false,
    onMicDenied: vi.fn(),
    labels,
    ...over,
  };
  return { props, ...render(<speak.AnswerZone {...props} />) };
}

describe('pickGiven', () => {
  const question = spokenQuestion(26); // veintiséis

  it('prefers the accent-correct alternative over unaccented and wrong ones', () => {
    expect(pickGiven(['veintisiete', 'veintiseis', 'veintiséis'], question)).toBe('veintiséis');
  });

  it('takes an accent-only miss over an outright wrong alternative', () => {
    expect(pickGiven(['treinta', 'veintiseis'], question)).toBe('veintiseis');
  });

  it('prefers the earlier alternative on a tie', () => {
    expect(pickGiven(['veintiséis', 'veintiséis'], question)).toBe('veintiséis');
    expect(pickGiven(['treinta', 'cuarenta'], question)).toBe('treinta');
  });

  it('falls back to the first alternative for a digit-target question', () => {
    const digitQuestion: Question = { ...question, accepted: { intVal: 26 } };
    expect(pickGiven(['veintiséis', 'veintiseis'], digitQuestion)).toBe('veintiséis');
  });

  it('returns an empty string when the recogniser produced nothing', () => {
    expect(pickGiven([], question)).toBe('');
  });

  it('is the pickGiven the mode exposes', () => {
    expect(speak.pickGiven).toBe(pickGiven);
  });
});

describe('speak zones', () => {
  it('shows the numeral and an empty transcript line', () => {
    render(
      <speak.Prompt
        question={spokenQuestion(715)}
        services={stubServices()}
        slower={false}
        onToggleSlower={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.getByTestId('numeral-prompt')).toHaveTextContent('715');
    expect(document.querySelector('.wa-trans')?.textContent).toBe('');
  });

  it('streams interim text from the answer zone into the prompt transcript', () => {
    const spy = recognitionSpy();
    const question = spokenQuestion(715);
    render(
      <>
        <speak.Prompt
          question={question}
          services={spy.services}
          slower={false}
          onToggleSlower={vi.fn()}
          labels={labels}
        />
        <speak.AnswerZone
          question={question}
          services={spy.services}
          verdict={null}
          expectedDisplay="715"
          onSubmit={vi.fn()}
          micDenied={false}
          onMicDenied={vi.fn()}
          labels={labels}
        />
      </>,
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Держите и говорите' }), {
      pointerId: 1,
    });
    act(() => {
      spy.fire().interim?.('setecientos quin');
    });
    expect(document.querySelector('.wa-trans')?.textContent).toContain('setecientos quin');
  });

  it('starts recognition on hold and stops it on release', () => {
    const spy = recognitionSpy();
    renderZone({ services: spy.services });
    const mic = screen.getByRole('button', { name: 'Держите и говорите' });
    fireEvent.pointerDown(mic, { pointerId: 1 });
    expect(spy.fire()).toBeTruthy();
    fireEvent.pointerUp(mic, { pointerId: 1 });
    expect(spy.stop).toHaveBeenCalled();
  });

  it('submits the best alternative when recognition finishes', () => {
    const spy = recognitionSpy();
    const onSubmit = vi.fn();
    renderZone({ services: spy.services, onSubmit });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Держите и говорите' }), {
      pointerId: 1,
    });
    act(() => {
      spy.fire().onFinal(['veintisiete', 'veintiséis']);
    });
    expect(onSubmit).toHaveBeenCalledWith('veintiséis');
  });

  it('reports a denied microphone to the drill', () => {
    const spy = recognitionSpy();
    const onMicDenied = vi.fn();
    renderZone({ services: spy.services, onMicDenied });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Держите и говорите' }), {
      pointerId: 1,
    });
    act(() => {
      spy.fire().onError('denied');
    });
    expect(onMicDenied).toHaveBeenCalledTimes(1);
  });

  it('shows an inline hint when nothing was heard', () => {
    const spy = recognitionSpy();
    renderZone({ services: spy.services });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Держите и говорите' }), {
      pointerId: 1,
    });
    act(() => {
      spy.fire().onError('no-speech');
    });
    expect(screen.getByText('не расслышали — попробуйте ещё раз')).toBeInTheDocument();
  });

  it('offers the text fallback and switches to it on demand', () => {
    renderZone();
    fireEvent.click(screen.getByRole('button', { name: 'Ввести текстом' }));
    expect(screen.getByRole('textbox')).toHaveAttribute('data-mode', 'words');
    expect(screen.getByRole('group')).toBeInTheDocument();
  });

  it('renders the denied frame with a muted block, text input and help link', () => {
    const onMicHelp = vi.fn();
    renderZone({ micDenied: true, onMicHelp });
    expect(screen.getByText('Микрофон недоступен')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('data-mode', 'words');
    fireEvent.click(screen.getByRole('button', { name: 'Как включить микрофон?' }));
    expect(onMicHelp).toHaveBeenCalledTimes(1);
  });

  it('omits the help link when the drill offers no handler', () => {
    renderZone({ micDenied: true });
    expect(screen.queryByRole('button', { name: 'Как включить микрофон?' })).toBeNull();
  });

  it('submits typed text from the denied fallback', () => {
    const onSubmit = vi.fn();
    renderZone({ micDenied: true, onSubmit });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' veintiséis ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    expect(onSubmit).toHaveBeenCalledWith('veintiséis');
  });
});
