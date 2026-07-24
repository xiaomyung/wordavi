import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Segmented, type SegmentedOption } from '@/components/Segmented';

type Lang = 'ru' | 'en' | 'es';

const LANGS: readonly SegmentedOption<Lang>[] = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English', lang: 'en' },
  { value: 'es', label: 'Español', lang: 'es' },
];

describe('Segmented', () => {
  it('renders a radiogroup with one radio per option', () => {
    render(
      <Segmented options={LANGS} value="ru" onChange={vi.fn()} aria-label="Interface language" />,
    );
    const group = screen.getByRole('radiogroup', { name: 'Interface language' });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Русский' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'false');
  });

  it('renders every long label without dropping any', () => {
    render(<Segmented options={LANGS} value="ru" onChange={vi.fn()} />);
    expect(screen.getByText('Русский')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Español')).toBeInTheDocument();
  });

  it('uses a roving tabindex on the selected radio', () => {
    render(<Segmented options={LANGS} value="en" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Русский' })).toHaveAttribute('tabindex', '-1');
  });

  it('selects on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Segmented options={LANGS} value="ru" onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Español' }));
    expect(onChange).toHaveBeenCalledWith('es');
  });

  it('moves selection with the arrow keys, wrapping around', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Segmented options={LANGS} value="ru" onChange={onChange} />);
    // focus follows the arrow: from the first radio, Left wraps to the last (es)
    screen.getByRole('radio', { name: 'Русский' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('es');
    // now focused on es; Right wraps back to the first (ru)
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('ru');
  });

  it('jumps to first and last with Home and End', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Segmented options={LANGS} value="en" onChange={onChange} />);
    screen.getByRole('radio', { name: 'English' }).focus();
    await user.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith('es');
    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenLastCalledWith('ru');
  });
});
