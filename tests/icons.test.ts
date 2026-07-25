import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The app mark is drawn once and shipped three ways: the in-app tile, the shipped
 * SVG (which the tab favicons and the "any" manifest icons are rendered from), and
 * the maskable icon a launcher crops. Only the last one has a rule that cannot be
 * checked by looking at the file — the crop happens on the phone — so it is
 * checked here instead, from the geometry in the source.
 *
 * The PNGs themselves are built from these two SVGs by icons/build.sh.
 */

function read(path: string): string {
  return readFileSync(resolve(__dirname, '..', path), 'utf-8');
}

/** The `scale(n)` of the mark's transform group. */
function markScale(svg: string): number {
  const match = /translate\(32 32\) scale\(([\d.]+)\)/.exec(svg);
  if (match?.[1] === undefined) throw new Error('no mark transform in the icon source');
  return Number(match[1]);
}

/*
 * The glyph's own bounding box on the 64-unit canvas, straight off the two paths:
 * x runs 6 → 58, y runs 2.5 (the acute) → 51.32 (the w's feet).
 */
const GLYPH_W = 52;
const GLYPH_H = 48.82;
const CANVAS = 64;
/** How much of its canvas the mark covers wherever the whole canvas is shown. */
const MARK_FRACTION = 0.625;
/** The share of a maskable canvas the spec guarantees a launcher will show. */
const SAFE_ZONE = 0.8;

/** How much of the canvas the mark covers once the transform has been applied. */
function markFraction(svg: string): { width: number; height: number } {
  const scale = markScale(svg);
  return { width: (GLYPH_W * scale) / CANVAS, height: (GLYPH_H * scale) / CANVAS };
}

describe('app icons', () => {
  const shipped = read('public/favicon.svg');
  const maskable = read('icons/icon-maskable.svg');

  it('draws the shipped mark as a tile: its own rounded corners, mark at 0.625', () => {
    expect(shipped).toMatch(/<rect width="64" height="64" rx="14"/);
    expect(markFraction(shipped).width).toBeCloseTo(MARK_FRACTION, 3);
  });

  it('bleeds the maskable icon to every edge — the corners are the launcher’s', () => {
    expect(maskable).toMatch(/<rect width="64" height="64" fill=/);
    expect(maskable).not.toMatch(/<rect[^>]*\brx=/);
  });

  it('keeps the maskable mark inside the safe zone the launcher guarantees', () => {
    // The spec guarantees only a centred circle of 80% diameter. Measured on the
    // bounding box rather than the glyph, so it is the conservative reading: a
    // mark that passes here has margin whatever shape the launcher cuts.
    const { width, height } = markFraction(maskable);
    const halfDiagonal = Math.sqrt(width ** 2 + height ** 2) / 2;
    expect(halfDiagonal).toBeLessThan(SAFE_ZONE / 2);
  });

  it('reads at the same size as the in-app tile once the crop is applied', () => {
    // 0.5 of the canvas is 0.625 of the safe zone: the framing every other drawing
    // of the mark uses, measured against what is actually shown.
    expect(markFraction(maskable).width / SAFE_ZONE).toBeCloseTo(MARK_FRACTION, 3);
  });

  it('points the apple-touch-icon at an opaque icon — iOS blackens transparency', () => {
    expect(read('index.html')).toMatch(/apple-touch-icon" href="\/icons\/icon-maskable-192\.png"/);
  });
});
