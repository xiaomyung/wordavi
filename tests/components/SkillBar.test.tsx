import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkillBar } from '@/components/SkillBar';

describe('SkillBar', () => {
  it('renders the label, rounded percent, and a correct-colored fill by default', () => {
    render(<SkillBar label="единицы · 1–9" percent={96} />);
    expect(screen.getByText('единицы · 1–9')).toBeInTheDocument();
    expect(screen.getByText('96%')).toBeInTheDocument();
    const fill = screen.getByRole('progressbar').firstElementChild;
    expect(fill).toHaveClass('bg-correct');
    expect(fill).toHaveStyle({ width: '96%' });
  });

  it('switches to the almost color when warn is set', () => {
    render(<SkillBar label="тысячи" percent={52} warn />);
    const fill = screen.getByRole('progressbar').firstElementChild;
    expect(fill).toHaveClass('bg-almost');
    expect(fill).not.toHaveClass('bg-correct');
  });

  it('renders the paired flag chip slot next to the label, not instead of color', () => {
    render(<SkillBar label="тысячи" percent={52} warn flag={<span>потренировать</span>} />);
    expect(screen.getByText('потренировать')).toBeInTheDocument();
  });

  it('clamps out-of-range percentages', () => {
    render(<SkillBar label="edge" percent={140} />);
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '100%' });
  });
});
