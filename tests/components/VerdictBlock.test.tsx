import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VerdictBlock } from '@/components/VerdictBlock';

describe('VerdictBlock', () => {
  it('renders a coloured verdict with stamp, title and sub line', () => {
    const { container } = render(
      <VerdictBlock verdict="correct" title="¡Muy bien!" sub="+10 очков" />,
    );
    const block = screen.getByRole('status');
    expect(block).toHaveClass('wa-verdict', 'wa-verdict--correct');
    expect(block).toHaveTextContent('¡Muy bien!');
    expect(block).toHaveTextContent('+10 очков');
    // uses the circled stamp for the outcome
    expect(container.querySelector('.wa-verdict-icon svg')).toHaveAttribute(
      'data-verdict',
      'correct',
    );
  });

  it('omits the sub line when none is given', () => {
    render(<VerdictBlock verdict="wrong" title="Правильно: 914" />);
    expect(document.querySelector('.wa-verdict-sub')).toBeNull();
  });

  it('muted variant drops the colour and shows the crossed-mic icon (no stamp)', () => {
    const { container } = render(
      <VerdictBlock variant="muted" title="Микрофон недоступен" sub="введите ответ текстом" />,
    );
    const block = screen.getByRole('status');
    expect(block).toHaveClass('wa-verdict--muted');
    expect(container.querySelector('[data-verdict]')).toBeNull();
    // default crossed-mic glyph: mic body + arc/stem + cross stroke
    expect(container.querySelector('path[d="M4 4l16 16"]')).not.toBeNull();
  });

  it('muted variant renders a caller-provided icon', () => {
    const { container } = render(
      <VerdictBlock
        variant="muted"
        title="Оффлайн"
        icon={<span data-testid="custom-icon">!</span>}
      />,
    );
    expect(container.querySelector('[data-testid="custom-icon"]')).not.toBeNull();
    expect(container.querySelector('path[d="M4 4l16 16"]')).toBeNull();
  });
});
