import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GalleryScreen } from '@/screens/GalleryScreen';
import { GALLERY_SECTIONS } from '@/screens/gallery/nav';

/** One heading per major section — the regex anchors keep `Stamp` off `StreakStamps`. */
const SECTION_HEADINGS: readonly RegExp[] = [
  /^Pressable · Button$/,
  /^ChoiceButton$/,
  /^AccentKeys$/,
  /^AnswerInput$/,
  /^VerdictBlock$/,
  /^Stamp$/,
  /^MicButton · Transcript$/,
  /^SpeakerButton · PillButton$/,
  /^Toggle · Stepper · Segmented$/,
  /^RangeSlider · StopSlider$/,
  /^Card · CardRow · ModeRow$/,
  /^Chip$/,
  /^Toast · Toaster$/,
  /^ProgressRule · GoalRing · SkillBar$/,
  /^StreakStamps$/,
  /^PriceTag · Dots$/,
];

describe('GalleryScreen', () => {
  it('renders the gallery shell without crashing', () => {
    render(<GalleryScreen />);
    expect(screen.getByRole('heading', { level: 1, name: /gallery/i })).toBeInTheDocument();
  });

  it('renders a heading for every major section', () => {
    render(<GalleryScreen />);
    for (const name of SECTION_HEADINGS) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
  });

  it('exposes the theme segmented control with light/dark/auto', () => {
    render(<GalleryScreen />);
    const group = screen.getByRole('radiogroup', { name: 'Тема' });
    expect(group).toBeInTheDocument();
    for (const label of ['Светлая', 'Тёмная', 'Авто']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('radio', { name: 'Авто' })).toHaveAttribute('aria-checked', 'true');
  });

  it('links every nav entry to a section that exists', () => {
    const { container } = render(<GalleryScreen />);
    for (const entry of GALLERY_SECTIONS) {
      expect(container.querySelector(`a[href="#${entry.id}"]`)).not.toBeNull();
      expect(container.querySelector(`section#${entry.id}`)).not.toBeNull();
    }
  });

  it('shows real Russian copy from the i18n resources', () => {
    render(<GalleryScreen />);
    expect(screen.getByText('¡Muy bien!')).toBeInTheDocument();
    expect(screen.getByText('Почти — veintiséis')).toBeInTheDocument();
    expect(screen.getByText('Микрофон недоступен')).toBeInTheDocument();
  });
});
