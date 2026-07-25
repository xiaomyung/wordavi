/**
 * The app's inline SVG glyphs, in one place.
 *
 * Every drawing here was duplicated across two or more components/screens
 * (the same chevron in `Card` and `ModeRow`, the same microphone in
 * `MicButton`, `VerdictBlock` and the home mode list, …). They are plain
 * presentational leaves: no props beyond a size or a variant, `aria-hidden`
 * throughout — the accessible name always belongs to the control around them.
 *
 * Glyphs with no `width`/`height` are sized by their container (e.g. the icon
 * button's `[&>svg]:size-(--size-icon-glyph)`); the ones that carry explicit
 * dimensions are drawn inline in text and would otherwise collapse.
 */

const CHEVRON_PATH = 'M9 5l7 7-7 7';
const CROSS_PATH = 'M6 6l12 12M18 6L6 18';

/** Trailing chevron of a navigating row (`CardRow`, `ModeRow`). */
export function RowChevron() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-text-faint"
    >
      <path d={CHEVRON_PATH} />
    </svg>
  );
}

/** Back chevron for screen headers (settings.html `.ib`). */
export function BackGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

/** Dismiss cross: the drill's leave button, the report sheet's close button. */
export function CloseGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={CROSS_PATH} />
    </svg>
  );
}

/**
 * Speaker cone with its two arcs. Inline in a pill (13) or in the home mode
 * list (19), so the size is explicit rather than inherited.
 */
export function SpeakerGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 9.5v5h3.5L13 19V5L7.5 9.5H4z" fill="currentColor" />
      <path
        d="M15.5 8.5a5 5 0 010 7M17.8 6.2a8.2 8.2 0 010 11.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Microphone, optionally struck through. `crossed` is what "no microphone"
 * looks like everywhere: the denied `MicButton`, the muted `VerdictBlock` line.
 */
export function MicGlyph({ size = 18, crossed = false }: { size?: number; crossed?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
      <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" />
      {crossed && <path d="M4 4l16 16" strokeWidth="2.4" />}
    </svg>
  );
}

/** Bar chart — the home screen's stats button. */
export function ChartGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 20V12M12 20V4M19 20v-6" />
    </svg>
  );
}

/** Cogwheel — the home screen's settings button. */
export function GearGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.5 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 005 12a7 7 0 00.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.5-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2z" />
    </svg>
  );
}

/** Struck-through signal fan — the offline chip. */
export function OfflineGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 9a15 15 0 0110.6-4.4M22 9a15 15 0 00-4.8-3.2M6 13a9.5 9.5 0 015.4-2.7M18 13a9.5 9.5 0 00-2-1.6M10 17a4 4 0 014 0M12 21h.01M4 4l16 16" />
    </svg>
  );
}

/** Slider rows — the "settings" icon button (settings.html `.ib`). */
export function SettingsGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  );
}
