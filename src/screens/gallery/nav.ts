/**
 * Section index for the gallery's jump nav. Single source of truth: every
 * entry's `id` must match the `id` a `Section` renders, and `tests/screens`
 * asserts that link↔section pairing so the nav can never drift.
 */
export interface GalleryNavEntry {
  /** Anchor target — matches the rendered `<section id>`. */
  id: string;
  /** Short chip label for the sticky nav. */
  label: string;
}

export const GALLERY_SECTIONS: readonly GalleryNavEntry[] = [
  { id: 'buttons', label: 'button' },
  { id: 'choice', label: 'choice' },
  { id: 'accent-keys', label: 'accents' },
  { id: 'answer-input', label: 'input' },
  { id: 'verdict', label: 'verdict' },
  { id: 'stamp', label: 'stamp' },
  { id: 'mic', label: 'mic' },
  { id: 'speaker', label: 'speaker' },
  { id: 'switches', label: 'switches' },
  { id: 'sliders', label: 'sliders' },
  { id: 'cards', label: 'cards' },
  { id: 'chips', label: 'chips' },
  { id: 'toast', label: 'toast' },
  { id: 'progress', label: 'progress' },
  { id: 'streak', label: 'streak' },
  { id: 'price', label: 'price · dots' },
];
