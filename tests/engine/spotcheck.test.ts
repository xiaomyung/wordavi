import { describe, expect, it } from 'vitest';
import {
  decimalToWords,
  matchText,
  numberToWords,
  priceToWords,
  quantityToWords,
  wordsWithApocope,
} from '@/engine';

/** Hand-picked es-ES boundaries spanning all engine modules in one compact smoke. */
describe('engine spot-check', () => {
  it.each([
    [30, 'treinta'],
    [31, 'treinta y uno'],
    [90, 'noventa'],
    [105, 'ciento cinco'],
    [116, 'ciento dieciséis'],
    [715, 'setecientos quince'],
    [999_999, 'novecientos noventa y nueve mil novecientos noventa y nueve'],
    [1_000_001, 'un millón uno'],
    [2_000_001, 'dos millones uno'],
    [21_000, 'veintiún mil'],
    [101_000, 'ciento un mil'],
    [41_000_000, 'cuarenta y un millones'],
    [1_000_000_000, 'mil millones'],
  ])('%i → %s', (n, words) => {
    expect(numberToWords(n)).toBe(words);
  });

  it('apocope forms', () => {
    expect(wordsWithApocope(1)).toBe('un');
    expect(wordsWithApocope(21)).toBe('veintiún');
    expect(wordsWithApocope(31)).toBe('treinta y un');
  });

  it('decimal 3,45 canonical coma', () => {
    expect(decimalToWords(3, '45').canonical).toBe('tres coma cuarenta y cinco');
  });

  it('price 4,75 cashier set', () => {
    const p = priceToWords(4, 75);
    expect(p.canonical).toBe('cuatro con setenta y cinco');
    for (const given of [
      'cuatro euros setenta y cinco',
      'cuatro euros con setenta y cinco',
      'cuatro setenta y cinco',
    ]) {
      expect(matchText(p, given, { acceptNoAccents: true }).verdict).toBe('correct');
    }
  });

  it('quantities', () => {
    expect(quantityToWords({ kind: 'weight', grams: 750 }).canonical).toBe('tres cuartos de kilo');
    const half = quantityToWords({ kind: 'weight', grams: 500 });
    const crossUnit = matchText(half, 'quinientos gramos', { acceptNoAccents: true });
    expect(crossUnit.verdict).toBe('correct');
    expect(crossUnit.noteKey).toBe('crossUnit');
  });

  it('archaic and accent handling', () => {
    const v21 = { canonical: 'veintiuno', variants: [{ text: 'veintiuno' }] };
    expect(matchText(v21, 'veinte y uno', { acceptNoAccents: true }).verdict).toBe('wrong');
    const v16 = { canonical: 'dieciséis', variants: [{ text: 'dieciséis' }] };
    expect(matchText(v16, 'dieciseis', { acceptNoAccents: true }).verdict).toBe('almost');
    expect(matchText(v16, 'dieciseis', { acceptNoAccents: false }).verdict).toBe('wrong');
  });
});
