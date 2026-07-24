import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Transcript } from '@/components/Transcript';

describe('Transcript', () => {
  it('shows interim text with a blinking caret and a polite live region', () => {
    const { container } = render(<Transcript text="setecientos quin" />);
    const line = container.querySelector('.wa-trans');
    expect(line).toHaveTextContent('setecientos quin');
    expect(line).toHaveAttribute('aria-live', 'polite');
    expect(container.querySelector('.wa-caret')).not.toBeNull();
  });

  it('reserves the line even when empty, and can hide the caret', () => {
    const { container } = render(<Transcript text="" caret={false} />);
    expect(container.querySelector('.wa-trans')).not.toBeNull();
    expect(container.querySelector('.wa-caret')).toBeNull();
  });
});
