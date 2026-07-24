import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AnswerInput, type AnswerInputHandle } from '@/components/AnswerInput';

describe('AnswerInput', () => {
  it('words mode uses the text keyboard and is editable', () => {
    render(<AnswerInput value="" onChange={vi.fn()} mode="words" aria-label="answer" />);
    const area = screen.getByRole('textbox');
    expect(area).toHaveAttribute('inputmode', 'text');
    expect(area).toHaveAttribute('data-mode', 'words');
    expect(area).not.toHaveAttribute('readonly');
    // no stamp until a verdict is set
    expect(document.querySelector('.wa-input-stamp')).toBeNull();
  });

  it('digits mode switches to the decimal keyboard', () => {
    render(<AnswerInput value="" onChange={vi.fn()} mode="digits" aria-label="answer" />);
    const area = screen.getByRole('textbox');
    expect(area).toHaveAttribute('inputmode', 'decimal');
    expect(area).toHaveAttribute('data-mode', 'digits');
  });

  it('reports edits through onChange', () => {
    const onChange = vi.fn();
    render(<AnswerInput value="" onChange={onChange} mode="words" aria-label="answer" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'cuatro' } });
    expect(onChange).toHaveBeenCalledWith('cuatro');
  });

  it('submits on Enter without inserting a newline', () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    render(
      <AnswerInput
        value="cuatro"
        onChange={onChange}
        onSubmit={onSubmit}
        mode="words"
        aria-label="answer"
      />,
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('freezes read-only and shows the inline stamp once a verdict is set', () => {
    render(
      <AnswerInput
        value="cuatrocientos"
        onChange={vi.fn()}
        mode="words"
        verdict="correct"
        aria-label="answer"
      />,
    );
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    expect(screen.getByRole('textbox')).toHaveAttribute('data-verdict', 'correct');
    const stamp = document.querySelector('.wa-input-stamp svg');
    expect(stamp).toHaveAttribute('data-verdict', 'correct');
    // the field's inline stamp pops on appearance
    expect(stamp).toHaveAttribute('data-animate', 'true');
  });

  it('insertAtCaret splices at the caret and flashes the inserted char', () => {
    const onChange = vi.fn();
    const ref = createRef<AnswerInputHandle>();
    render(
      <AnswerInput ref={ref} value="cuatro" onChange={onChange} mode="words" aria-label="answer" />,
    );
    const area = screen.getByRole('textbox') as HTMLTextAreaElement;
    area.setSelectionRange(3, 3);
    ref.current?.insertAtCaret('á');
    expect(onChange).toHaveBeenCalledWith('cuaátro');
    const flash = document.querySelector('.wa-input-flash');
    expect(flash?.textContent).toBe('á');
    expect(flash).toHaveAttribute('aria-hidden', 'true');
  });

  it('shift+Enter does not submit', () => {
    const onSubmit = vi.fn();
    render(
      <AnswerInput
        value="cuatro"
        onChange={vi.fn()}
        onSubmit={onSubmit}
        mode="words"
        aria-label="answer"
      />,
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('insertAtCaret is inert once a verdict has frozen the field', () => {
    const onChange = vi.fn();
    const ref = createRef<AnswerInputHandle>();
    render(
      <AnswerInput
        ref={ref}
        value="cuatro"
        onChange={onChange}
        mode="words"
        verdict="wrong"
        aria-label="answer"
      />,
    );
    ref.current?.insertAtCaret('á');
    expect(onChange).not.toHaveBeenCalled();
    expect(document.querySelector('.wa-input-flash')).toBeNull();
  });

  it('exposes focus() on the ref', () => {
    const ref = createRef<AnswerInputHandle>();
    render(<AnswerInput ref={ref} value="" onChange={vi.fn()} mode="words" aria-label="answer" />);
    ref.current?.focus();
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('passes className through to the wrapper', () => {
    const { container } = render(
      <AnswerInput value="" onChange={vi.fn()} mode="words" className="mt-4" aria-label="answer" />,
    );
    expect(container.querySelector('.wa-input-wrap')).toHaveClass('mt-4');
  });

  it('renders the placeholder', () => {
    render(
      <AnswerInput
        value=""
        onChange={vi.fn()}
        mode="words"
        placeholder="введите ответ словами"
        aria-label="answer"
      />,
    );
    expect(screen.getByPlaceholderText('введите ответ словами')).toBeInTheDocument();
  });
});
