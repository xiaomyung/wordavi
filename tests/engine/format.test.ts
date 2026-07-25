import { describe, expect, it } from 'vitest';
import { formatNumber, formatPrice, formatWeight, parseDigitAnswer } from '@/engine';

// U+2009 THIN SPACE — the es-ES grouping separator.
const T = ' ';

describe('formatNumber', () => {
  it('groups thousands with a thin space', () => {
    expect(formatNumber(1000)).toBe(`1${T}000`);
    expect(formatNumber(1234567)).toBe(`1${T}234${T}567`);
  });
  it('leaves sub-thousand numbers ungrouped', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
  });
});

describe('formatPrice', () => {
  it('uses a comma decimal, two cent digits, and a thin space before €', () => {
    expect(formatPrice(4, 75)).toBe(`4,75${T}€`);
    expect(formatPrice(5, 0)).toBe(`5,00${T}€`);
    expect(formatPrice(1234, 5)).toBe(`1${T}234,05${T}€`);
  });
});

describe('formatWeight', () => {
  it('shows grams under a kilo', () => {
    expect(formatWeight(250)).toEqual({ value: '250', unit: 'g' });
    expect(formatWeight(999)).toEqual({ value: '999', unit: 'g' });
  });
  it('shows kilos with a comma decimal and trimmed zeros from a kilo up', () => {
    expect(formatWeight(1000)).toEqual({ value: '1', unit: 'kg' });
    expect(formatWeight(1500)).toEqual({ value: '1,5', unit: 'kg' });
    expect(formatWeight(2000)).toEqual({ value: '2', unit: 'kg' });
    expect(formatWeight(1200)).toEqual({ value: '1,2', unit: 'kg' });
    expect(formatWeight(1250)).toEqual({ value: '1,25', unit: 'kg' });
  });
});

describe('parseDigitAnswer', () => {
  it('reads grouped integers (space or dot separators)', () => {
    expect(parseDigitAnswer('1 500')).toEqual({ intVal: 1500 });
    expect(parseDigitAnswer('1.500')).toEqual({ intVal: 1500 });
    expect(parseDigitAnswer(`1${T}500`)).toEqual({ intVal: 1500 });
    expect(parseDigitAnswer('  42  ')).toEqual({ intVal: 42 });
  });
  it('reads a comma as the decimal separator', () => {
    expect(parseDigitAnswer('2,35')).toEqual({ intVal: 2, fracDigits: '35' });
    expect(parseDigitAnswer('12,99')).toEqual({ intVal: 12, fracDigits: '99' });
    expect(parseDigitAnswer('1.500,50')).toEqual({ intVal: 1500, fracDigits: '50' });
    expect(parseDigitAnswer(',5')).toEqual({ intVal: 0, fracDigits: '5' });
  });
  it('rejects garbage', () => {
    expect(parseDigitAnswer('')).toBeNull();
    expect(parseDigitAnswer('abc')).toBeNull();
    expect(parseDigitAnswer('1,2,3')).toBeNull();
    expect(parseDigitAnswer('-5')).toBeNull();
    expect(parseDigitAnswer('5,')).toBeNull();
  });
});
