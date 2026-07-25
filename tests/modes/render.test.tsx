import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { allModes, getMode, numeralFontSizePx, promptDisplay, promptSpanish } from '@/modes';
import type { Question } from '@/session';
import { generateFor, labelsFor, roundConfig, stubServices } from './helpers';

/** U+2009 THIN SPACE — the engine's thousands/unit separator. */
const THIN = ' ';

function numberQuestion(id: string, value: number): Question {
  return {
    id,
    bucket: 'hundreds_reg',
    prompt: { kind: 'number', value },
    accepted: { intVal: value },
  };
}

describe('prompt formatting helpers', () => {
  it('scales the numeral by digit count', () => {
    expect(numeralFontSizePx(7)).toBe(92);
    expect(numeralFontSizePx(1234)).toBe(92);
    expect(numeralFontSizePx(12_345)).toBe(64);
    expect(numeralFontSizePx(999_999)).toBe(64);
    expect(numeralFontSizePx(1_000_000)).toBe(48);
  });

  it('renders each payload kind for display and for speech', () => {
    expect(promptDisplay({ kind: 'number', value: 1_234_567 })).toBe(`1${THIN}234${THIN}567`);
    expect(promptDisplay({ kind: 'price', euros: 2, cents: 35 })).toBe(`2,35${THIN}€`);
    expect(promptDisplay({ kind: 'quantity', grams: 1500 })).toBe(`1,5${THIN}kg`);
    expect(promptDisplay({ kind: 'quantity', grams: 250 })).toBe(`250${THIN}g`);
    expect(promptSpanish({ kind: 'number', value: 914 })).toBe('novecientos catorce');
    expect(promptSpanish({ kind: 'price', euros: 2, cents: 35 })).toBe('dos con treinta y cinco');
    expect(promptSpanish({ kind: 'quantity', grams: 500 })).toBe('medio kilo');
    expect(promptSpanish({ kind: 'decimal', intPart: 3, fracDigits: '5' })).toBe('tres coma cinco');
  });
});

describe('words zones', () => {
  const words = getMode('words');
  const labels = labelsFor(words);

  it('shows the numeral at the prompt-xl size', () => {
    render(
      <words.Prompt
        question={numberQuestion('words:n475', 475)}
        services={stubServices()}
        slower={false}
        onToggleSlower={vi.fn()}
        labels={labels}
      />,
    );
    const numeral = screen.getByTestId('numeral-prompt');
    expect(numeral).toHaveTextContent('475');
    expect(numeral).toHaveStyle({ fontSize: '92px' });
  });

  it('groups long numerals with thin spaces and shrinks them', () => {
    render(
      <words.Prompt
        question={numberQuestion('words:n1234567', 1_234_567)}
        services={stubServices()}
        slower={false}
        onToggleSlower={vi.fn()}
        labels={labels}
      />,
    );
    const numeral = screen.getByTestId('numeral-prompt');
    expect(numeral.textContent).toBe(`1${THIN}234${THIN}567`);
    expect(numeral).toHaveStyle({ fontSize: '48px' });
  });

  it('submits typed words and offers the accent keys', () => {
    const onSubmit = vi.fn();
    render(
      <words.AnswerZone
        question={numberQuestion('words:n475', 475)}
        services={stubServices()}
        verdict={null}
        expectedDisplay="475"
        onSubmit={onSubmit}
        micDenied={false}
        onMicDenied={vi.fn()}
        labels={labels}
      />,
    );
    const field = screen.getByRole('textbox');
    expect(field).toHaveAttribute('inputmode', 'text');
    expect(screen.getByRole('button', { name: 'Проверить' })).toBeDisabled();
    fireEvent.change(field, { target: { value: 'cuatrocientos setenta y cinco' } });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    expect(onSubmit).toHaveBeenCalledWith('cuatrocientos setenta y cinco');
    expect(screen.getAllByRole('button', { name: 'á' })).toHaveLength(1);
  });

  it('freezes and drops its CTA once a verdict lands', () => {
    render(
      <words.AnswerZone
        question={numberQuestion('words:n475', 475)}
        services={stubServices()}
        verdict="correct"
        expectedDisplay="475"
        onSubmit={vi.fn()}
        micDenied={false}
        onMicDenied={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Проверить' })).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('clears the draft when the drill moves to the next question', () => {
    const { rerender } = render(
      <words.AnswerZone
        question={numberQuestion('words:n475', 475)}
        services={stubServices()}
        verdict={null}
        expectedDisplay="475"
        onSubmit={vi.fn()}
        micDenied={false}
        onMicDenied={vi.fn()}
        labels={labels}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'cuatro' } });
    rerender(
      <words.AnswerZone
        question={numberQuestion('words:n26', 26)}
        services={stubServices()}
        verdict={null}
        expectedDisplay="26"
        onSubmit={vi.fn()}
        micDenied={false}
        onMicDenied={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.getByRole('textbox')).toHaveValue('');
  });
});

describe('digits zones', () => {
  const digits = getMode('digits');
  const labels = labelsFor(digits);

  it('shows the Spanish phrase and speaks only on demand', async () => {
    const services = stubServices();
    render(
      <digits.Prompt
        question={numberQuestion('digits:n914', 914)}
        services={services}
        slower={false}
        onToggleSlower={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.getByTestId('spanish-phrase')).toHaveTextContent('novecientos catorce');
    expect(services.speak).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'прослушать' }));
    await act(async () => {});
    expect(services.speak).toHaveBeenCalledWith('novecientos catorce', { slower: false });
  });

  it('answers with the decimal keyboard and no accent keys', () => {
    const onSubmit = vi.fn();
    render(
      <digits.AnswerZone
        question={numberQuestion('digits:n914', 914)}
        services={stubServices()}
        verdict={null}
        expectedDisplay="914"
        onSubmit={onSubmit}
        micDenied={false}
        onMicDenied={vi.fn()}
        labels={labels}
      />,
    );
    const field = screen.getByRole('textbox');
    expect(field).toHaveAttribute('inputmode', 'decimal');
    expect(screen.queryByRole('group')).toBeNull();
    fireEvent.change(field, { target: { value: '914' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('914');
  });
});

describe('listen zones', () => {
  const listen = getMode('listen');
  const labels = labelsFor(listen);

  function renderPrompt(services = stubServices(), slower = false, onToggleSlower = vi.fn()) {
    return render(
      <listen.Prompt
        question={numberQuestion('listen:n250', 250)}
        services={services}
        slower={slower}
        onToggleSlower={onToggleSlower}
        labels={labels}
      />,
    );
  }

  it('plays the number once when the question appears', async () => {
    const services = stubServices();
    renderPrompt(services);
    await act(async () => {});
    expect(services.speak).toHaveBeenCalledTimes(1);
    expect(services.speak).toHaveBeenCalledWith('doscientos cincuenta', { slower: false });
  });

  it('replays on demand and never shows the number', async () => {
    const services = stubServices();
    const { container } = renderPrompt(services);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Нажмите, чтобы прослушать ещё раз' }));
    await act(async () => {});
    expect(services.speak).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain('250');
  });

  it('carries the sticky slower toggle from the drill', async () => {
    const services = stubServices();
    const onToggleSlower = vi.fn();
    renderPrompt(services, true, onToggleSlower);
    await act(async () => {});
    expect(services.speak).toHaveBeenCalledWith('doscientos cincuenta', { slower: true });
    const pill = screen.getByRole('button', { name: 'медленнее ×0,5' });
    expect(pill).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(pill);
    expect(onToggleSlower).toHaveBeenCalledTimes(1);
  });

  it('answers in digits', () => {
    const onSubmit = vi.fn();
    render(
      <listen.AnswerZone
        question={numberQuestion('listen:n250', 250)}
        services={stubServices()}
        verdict={null}
        expectedDisplay="250"
        onSubmit={onSubmit}
        micDenied={false}
        onMicDenied={vi.fn()}
        labels={labels}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    expect(onSubmit).toHaveBeenCalledWith('250');
  });
});

describe('grocery zones', () => {
  const grocery = getMode('grocery');
  const labels = labelsFor(grocery);
  const priceQuestion: Question = {
    id: 'grocery:p2.35',
    bucket: 'price_cents',
    prompt: { kind: 'price', euros: 2, cents: 35 },
    accepted: { canonical: 'dos con treinta y cinco', variants: [] },
  };

  it('shows the price tag, the cashier hint and a replay pill', async () => {
    const services = stubServices();
    render(
      <grocery.Prompt
        question={priceQuestion}
        services={services}
        slower={false}
        onToggleSlower={vi.fn()}
        labels={labels}
      />,
    );
    // getByText collapses the thin space, so the query uses a plain one.
    expect(screen.getByText('2,35 €')).toBeInTheDocument();
    expect(screen.getByText('Как скажет кассир?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'прослушать' }));
    await act(async () => {});
    expect(services.speak).toHaveBeenCalledWith('dos con treinta y cinco', { slower: false });
  });

  it('renders a weight payload on the same tag', () => {
    render(
      <grocery.Prompt
        question={{
          id: 'grocery:q500',
          bucket: 'qty_fractions',
          prompt: { kind: 'quantity', grams: 500 },
          accepted: { canonical: 'medio kilo', variants: [] },
        }}
        services={stubServices()}
        slower={false}
        onToggleSlower={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.getByText('500 g')).toBeInTheDocument();
  });

  it('answers in words with the accent keys', () => {
    const onSubmit = vi.fn();
    render(
      <grocery.AnswerZone
        question={priceQuestion}
        services={stubServices()}
        verdict={null}
        expectedDisplay="dos con treinta y cinco"
        onSubmit={onSubmit}
        micDenied={false}
        onMicDenied={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.getByPlaceholderText('например: dos con veinte')).toBeInTheDocument();
    expect(screen.getByRole('group')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'dos con treinta y cinco' } });
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    expect(onSubmit).toHaveBeenCalledWith('dos con treinta y cinco');
  });
});

describe('every mode renders both zones for its own questions', () => {
  it.each(allModes().map((mode) => [mode.id, mode] as const))('%s', async (_id, mode) => {
    const config = roundConfig({ modeId: mode.id });
    const bucket = mode.source.eligibleBuckets(config)[0];
    if (bucket === undefined) throw new Error('no eligible bucket');
    const question = generateFor(mode, bucket, 31, config);
    const labels = labelsFor(mode);
    const services = stubServices();
    const { container } = render(
      <>
        <mode.Prompt
          question={question}
          services={services}
          slower={false}
          onToggleSlower={vi.fn()}
          labels={labels}
        />
        <mode.AnswerZone
          question={question}
          services={services}
          verdict={null}
          expectedDisplay="0"
          onSubmit={vi.fn()}
          micDenied={false}
          onMicDenied={vi.fn()}
          labels={labels}
        />
      </>,
    );
    await act(async () => {});
    expect(container.querySelectorAll('button').length).toBeGreaterThan(0);
    // No raw i18n key ever reaches the screen.
    expect(container.textContent).not.toMatch(/\b(drill|common|modes|toasts)\.[a-z_]+/);
  });
});
