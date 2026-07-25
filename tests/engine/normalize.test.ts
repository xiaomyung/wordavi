import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { hasAccentDifference, normalizeAnswer, stripAccents } from '@/engine';

describe('normalizeAnswer', () => {
  it('lowercases, collapses whitespace, and trims', () => {
    expect(normalizeAnswer('  Cien   MIL ')).toBe('cien mil');
    expect(normalizeAnswer('mil\t\n  novecientos')).toBe('mil novecientos');
  });

  it('strips leading and trailing punctuation and symbols', () => {
    expect(normalizeAnswer('¿veintiuno?')).toBe('veintiuno');
    expect(normalizeAnswer('veintiuno.')).toBe('veintiuno');
    expect(normalizeAnswer('¡cien!')).toBe('cien');
    expect(normalizeAnswer('cuatro con setenta y cinco €')).toBe('cuatro con setenta y cinco');
  });

  it('keeps accents intact (accent-sensitive form)', () => {
    expect(normalizeAnswer('Dieciséis')).toBe('dieciséis');
    expect(normalizeAnswer('dieciseis')).toBe('dieciseis');
    expect(normalizeAnswer('Dieciséis')).not.toBe(normalizeAnswer('dieciseis'));
  });

  it('treats precomposed (NFC) and decomposed (NFD) accents as equal', () => {
    const composed = 'dieciséis';
    const decomposed = composed.normalize('NFD');
    expect(decomposed).not.toBe(composed); // genuinely different code points
    expect(normalizeAnswer(decomposed)).toBe(normalizeAnswer(composed));
    expect(normalizeAnswer(decomposed)).toBe('dieciséis');
  });

  it('preserves ñ as a distinct letter: "año" is never "ano"', () => {
    expect(normalizeAnswer('AÑO')).toBe('año');
    expect(normalizeAnswer('año')).not.toBe(normalizeAnswer('ano'));
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const once = normalizeAnswer(s);
        expect(normalizeAnswer(once)).toBe(once);
      }),
    );
  });
});

describe('stripAccents', () => {
  it('folds vowel accents', () => {
    expect(stripAccents('dieciséis')).toBe('dieciseis');
    expect(stripAccents('veintidós')).toBe('veintidos');
    expect(stripAccents('millón')).toBe('millon');
  });

  it('preserves ñ / Ñ rather than turning them into n / N', () => {
    expect(stripAccents('año')).toBe('año');
    expect(stripAccents('AÑO')).toBe('AÑO');
    expect(stripAccents('año')).not.toBe('ano');
  });

  it('handles decomposed (NFD) ñ input', () => {
    const decomposed = 'año'.normalize('NFD');
    expect(stripAccents(decomposed)).toBe('año');
  });
});

describe('hasAccentDifference', () => {
  it('is true when strings differ only by accents', () => {
    expect(hasAccentDifference('dieciseis', 'dieciséis')).toBe(true);
    expect(hasAccentDifference('veintidos', 'veintidós')).toBe(true);
  });

  it('is false when the strings are identical after normalisation', () => {
    expect(hasAccentDifference('cien', 'cien')).toBe(false);
    expect(hasAccentDifference('Cien ', ' cien')).toBe(false);
  });

  it('is false when the strings differ by more than accents', () => {
    expect(hasAccentDifference('uno', 'dos')).toBe(false);
    expect(hasAccentDifference('año', 'ano')).toBe(false); // ñ vs n is a real difference
  });
});
