import { describe, expect, it } from 'vitest';
import { decimalToWords, fracDigitsToWords, matchText } from '@/engine';

const OPTS = { acceptNoAccents: true };

describe('fracDigitsToWords', () => {
  it('reads 1 digit as a number', () => {
    expect(fracDigitsToWords('5')).toBe('cinco');
  });
  it('reads 2 digits (no leading zero) as a number', () => {
    expect(fracDigitsToWords('45')).toBe('cuarenta y cinco');
  });
  it('keeps a leading zero audible, digit by digit', () => {
    expect(fracDigitsToWords('05')).toBe('cero cinco');
  });
  it('reads 3+ digits digit by digit', () => {
    expect(fracDigitsToWords('456')).toBe('cuatro cinco seis');
  });
});

describe('decimalToWords', () => {
  it('uses "coma" for the canonical form', () => {
    expect(decimalToWords(3, '5').canonical).toBe('tres coma cinco');
  });
  it('reads a 2-digit fraction as a number', () => {
    expect(decimalToWords(3, '45').canonical).toBe('tres coma cuarenta y cinco');
  });

  it('accepts the canonical "coma" form with no note', () => {
    const result = matchText(decimalToWords(3, '5'), 'tres coma cinco', OPTS);
    expect(result.verdict).toBe('correct');
    expect(result.noteKey).toBeUndefined();
  });
  it('accepts the "con" form with a conAccepted note', () => {
    const result = matchText(decimalToWords(3, '5'), 'tres con cinco', OPTS);
    expect(result.verdict).toBe('correct');
    expect(result.noteKey).toBe('conAccepted');
  });
});
