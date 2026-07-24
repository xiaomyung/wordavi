import { describe, expect, it } from 'vitest';
import type { AcceptedAnswer } from '@/engine';
import { matchText } from '@/engine';

function single(text: string): AcceptedAnswer {
  return { canonical: text, variants: [{ text }] };
}

describe('matchText — exact accent-sensitive match', () => {
  it('returns correct for an exact normalised match', () => {
    expect(matchText(single('veintiuno'), 'veintiuno', { acceptNoAccents: true })).toEqual({
      verdict: 'correct',
      matchedText: 'veintiuno',
    });
  });

  it('is forgiving about surrounding case, whitespace, and punctuation', () => {
    expect(
      matchText(single('ciento uno'), '  Ciento   Uno. ', { acceptNoAccents: false }).verdict,
    ).toBe('correct');
  });

  it('accepts an exact match with accents typed correctly', () => {
    expect(matchText(single('dieciséis'), 'Dieciséis', { acceptNoAccents: false }).verdict).toBe(
      'correct',
    );
  });
});

describe('matchText — accent handling', () => {
  it('a missing accent is "almost" with an accent note when accents are forgiven', () => {
    expect(matchText(single('dieciséis'), 'dieciseis', { acceptNoAccents: true })).toEqual({
      verdict: 'almost',
      matchedText: 'dieciséis',
      noteKey: 'accent',
    });
  });

  it('a missing accent is "wrong" in strict mode', () => {
    expect(matchText(single('dieciséis'), 'dieciseis', { acceptNoAccents: false })).toEqual({
      verdict: 'wrong',
    });
  });

  it('points matchedText at the canonical form, not the matched variant', () => {
    const accepted: AcceptedAnswer = {
      canonical: 'veintidós',
      variants: [{ text: 'veintidós' }, { text: 'veintidos coma cero' }],
    };
    expect(matchText(accepted, 'veintidos', { acceptNoAccents: true })).toEqual({
      verdict: 'almost',
      matchedText: 'veintidós',
      noteKey: 'accent',
    });
  });
});

describe('matchText — hard rejections (grammar, not spelling)', () => {
  it('rejects the archaic "veinte y uno" for 21', () => {
    expect(matchText(single('veintiuno'), 'veinte y uno', { acceptNoAccents: true }).verdict).toBe(
      'wrong',
    );
  });

  it('rejects the archaic "diez y seis" for 16 even with accents forgiven', () => {
    expect(matchText(single('dieciséis'), 'diez y seis', { acceptNoAccents: true }).verdict).toBe(
      'wrong',
    );
  });

  it('rejects an unrelated answer', () => {
    expect(matchText(single('cien'), 'doscientos', { acceptNoAccents: true }).verdict).toBe(
      'wrong',
    );
  });
});

describe('matchText — multi-variant accepted sets with notes', () => {
  const price: AcceptedAnswer = {
    canonical: 'cuatro con setenta y cinco',
    variants: [
      { text: 'cuatro con setenta y cinco' },
      { text: 'cuatro euros con setenta y cinco' },
      { text: 'cuatro coma setenta y cinco', note: 'conAccepted' },
      { text: 'cuatro setenta y cinco', note: 'colloquial' },
    ],
  };

  it('matches the canonical variant with no note', () => {
    expect(matchText(price, 'cuatro con setenta y cinco', { acceptNoAccents: true })).toEqual({
      verdict: 'correct',
      matchedText: 'cuatro con setenta y cinco',
    });
  });

  it('matches a plain (note-less) variant as correct', () => {
    expect(matchText(price, 'cuatro euros con setenta y cinco', { acceptNoAccents: true })).toEqual(
      { verdict: 'correct', matchedText: 'cuatro euros con setenta y cinco' },
    );
  });

  it('carries the variant note on a noted match (still verdict correct)', () => {
    expect(matchText(price, 'cuatro coma setenta y cinco', { acceptNoAccents: true })).toEqual({
      verdict: 'correct',
      matchedText: 'cuatro coma setenta y cinco',
      noteKey: 'conAccepted',
    });
    expect(matchText(price, 'cuatro setenta y cinco', { acceptNoAccents: true })).toEqual({
      verdict: 'correct',
      matchedText: 'cuatro setenta y cinco',
      noteKey: 'colloquial',
    });
  });

  it('prefers an exact (accent-sensitive) variant over an accent-folded one', () => {
    const accepted: AcceptedAnswer = {
      canonical: 'veintiséis',
      variants: [{ text: 'veintiséis' }],
    };
    // exact wins => correct, not almost
    expect(matchText(accepted, 'veintiséis', { acceptNoAccents: true }).verdict).toBe('correct');
  });
});
