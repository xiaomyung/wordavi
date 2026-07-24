import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/App';

describe('App', () => {
  beforeEach(() => {
    render(<App />);
  });

  it('renders the wordmark and both languages', () => {
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/word\s*avi/i);
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    expect(screen.getByText(/скоро/i)).toBeInTheDocument();
  });

  it('shows a semver app version in the footer', () => {
    expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeInTheDocument();
  });
});
