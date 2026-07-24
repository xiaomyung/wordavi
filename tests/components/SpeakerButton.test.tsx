import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SpeakerButton } from '@/components/SpeakerButton';

describe('SpeakerButton', () => {
  it('shows two static arcs only while playing', () => {
    const idle = render(<SpeakerButton aria-label="Прослушать" />);
    expect(idle.container.querySelector('.wa-speaker-arcs')).toBeNull();

    const playing = render(<SpeakerButton playing aria-label="Прослушать" />);
    expect(playing.container.querySelector('.wa-speaker-arcs')).not.toBeNull();
  });

  it('forwards clicks and the accessible name', () => {
    const onClick = vi.fn();
    render(<SpeakerButton onClick={onClick} aria-label="Прослушать ещё раз" />);
    const button = screen.getByRole('button', { name: 'Прослушать ещё раз' });
    expect(button).toHaveAttribute('type', 'button');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
