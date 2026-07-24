import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ModeRow } from '@/components/ModeRow';

describe('ModeRow', () => {
  it('renders as a single touch-target button with icon, title and sub', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(
      <ModeRow icon={<span>42</span>} title="Number → words" sub="475 → …" onPress={onPress} />,
    );

    const row = screen.getByRole('button', { name: /number → words/i });
    expect(row).toHaveClass('min-h-(--size-choice)');
    await user.click(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders the icon in a 44px radius-key tile', () => {
    render(<ModeRow icon={<span>42</span>} title="Number → words" sub="475 → …" />);
    const tile = screen.getByRole('button').firstElementChild;
    expect(tile).toHaveClass('size-11');
    expect(tile).toHaveClass('rounded-key');
    expect(tile).toContainElement(screen.getByText('42'));
  });

  it('dims the icon tile when paused', () => {
    render(<ModeRow icon={<span>42</span>} title="Say it aloud" sub="offline" paused />);
    expect(screen.getByRole('button').firstElementChild).toHaveClass('opacity-65');
  });

  it('shows a trailing chevron by default when not paused', () => {
    const { container } = render(<ModeRow icon="€" title="Prices" sub="2,35 €" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders the paused style without a chevron', () => {
    const { container } = render(
      <ModeRow icon="🎤" title="Say it aloud" sub="offline for now" paused />,
    );
    const row = screen.getByRole('button');
    expect(row).toHaveClass('border-dashed');
    expect(row).toHaveClass('bg-surface-paused');
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('shows a trailing chip instead of the chevron when supplied, even paused', () => {
    render(
      <ModeRow
        icon="🎤"
        title="Say it aloud"
        sub="offline for now"
        paused
        trailing={<span>offline</span>}
      />,
    );
    expect(screen.getByText('offline')).toBeInTheDocument();
  });
});
