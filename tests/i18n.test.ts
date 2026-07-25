import { describe, expect, it } from 'vitest';
import en from '@/i18n/resources/en.json';
import es from '@/i18n/resources/es.json';
import ru from '@/i18n/resources/ru.json';

type Tree = { [key: string]: string | Tree };

const resources: Record<string, Tree> = { ru, en, es };

/**
 * i18next v4 plural keys: one JSON entry per CLDR category, suffixed with the
 * `pluralSeparator` (`_`). `home.streak_n_one` / `_few` / `_many` are three
 * spellings of ONE logical key — parity is checked on the base name, and the
 * per-language category set is checked separately below (Russian needs
 * one/few/many where English and Spanish need one/other).
 */
const PLURAL_SUFFIX_RE = /_(zero|one|two|few|many|other)$/;

const REQUIRED_PLURAL_FORMS: Record<string, readonly string[]> = {
  ru: ['one', 'few', 'many'],
  en: ['one', 'other'],
  es: ['one', 'other'],
};

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out[path] = value;
    } else {
      Object.assign(out, flatten(value, path));
    }
  }
  return out;
}

const flat: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(resources).map(([lang, tree]) => [lang, flatten(tree)]),
);

function baseKeyOf(key: string): string {
  return key.replace(PLURAL_SUFFIX_RE, '');
}

function pluralFormOf(key: string): string | null {
  return PLURAL_SUFFIX_RE.exec(key)?.[1] ?? null;
}

/** Logical key -> every raw (possibly plural-suffixed) key that spells it. */
function familiesOf(entries: Record<string, string>): Map<string, string[]> {
  const families = new Map<string, string[]>();
  for (const key of Object.keys(entries)) {
    const base = baseKeyOf(key);
    const bucket = families.get(base);
    if (bucket) bucket.push(key);
    else families.set(base, [key]);
  }
  return families;
}

function placeholdersOf(value: string): string[] {
  return [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1] ?? '').sort();
}

/** Union of the placeholders used by every variant of a logical key. */
function familyPlaceholders(entries: Record<string, string>, keys: readonly string[]): string[] {
  const all = new Set<string>();
  for (const key of keys) {
    for (const placeholder of placeholdersOf(entries[key] ?? '')) all.add(placeholder);
  }
  return [...all].sort();
}

describe('i18n resources', () => {
  it('have identical logical key sets across languages', () => {
    const [baseLang, ...otherLangs] = Object.keys(flat);
    if (!baseLang) throw new Error('no resources loaded');
    const baseKeys = new Set(familiesOf(flat[baseLang] ?? {}).keys());

    for (const lang of otherLangs) {
      const keys = new Set(familiesOf(flat[lang] ?? {}).keys());
      const missingInLang = [...baseKeys].filter((key) => !keys.has(key));
      const missingInBase = [...keys].filter((key) => !baseKeys.has(key));

      expect({ lang, missingInLang, missingInBase }).toEqual({
        lang,
        missingInLang: [],
        missingInBase: [],
      });
    }
  });

  it('spells every plural family with the categories its language needs', () => {
    const pluralBases = new Set<string>();
    for (const entries of Object.values(flat)) {
      for (const key of Object.keys(entries)) {
        if (pluralFormOf(key) !== null) pluralBases.add(baseKeyOf(key));
      }
    }

    const problems: Array<{ lang: string; key: string; forms: string[]; required: string[] }> = [];
    for (const [lang, entries] of Object.entries(flat)) {
      const required = REQUIRED_PLURAL_FORMS[lang] ?? [];
      const families = familiesOf(entries);
      for (const base of pluralBases) {
        const forms = (families.get(base) ?? [])
          .map((key) => pluralFormOf(key))
          .filter((form): form is string => form !== null)
          .sort();
        const expected = [...required].sort();
        if (JSON.stringify(forms) !== JSON.stringify(expected)) {
          problems.push({ lang, key: base, forms, required: expected });
        }
      }
    }

    expect(problems).toEqual([]);
  });

  it('use matching interpolation placeholders for every key across languages', () => {
    const langs = Object.keys(flat);
    const [baseLang, ...otherLangs] = langs;
    if (!baseLang) throw new Error('no resources loaded');
    const baseEntries = flat[baseLang] ?? {};
    const baseFamilies = familiesOf(baseEntries);

    const mismatches: Array<{ key: string; lang: string; expected: string[]; actual: string[] }> =
      [];

    for (const [key, variants] of baseFamilies) {
      const expected = familyPlaceholders(baseEntries, variants);
      for (const lang of otherLangs) {
        const entries = flat[lang] ?? {};
        const actual = familyPlaceholders(entries, familiesOf(entries).get(key) ?? []);
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          mismatches.push({ key, lang, expected, actual });
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('keeps every variant of a plural family on the same placeholders', () => {
    const mismatches: Array<{ lang: string; key: string; variants: string[] }> = [];
    for (const [lang, entries] of Object.entries(flat)) {
      for (const [base, variants] of familiesOf(entries)) {
        if (variants.length < 2) continue;
        const sets = variants.map((key) => JSON.stringify(placeholdersOf(entries[key] ?? '')));
        if (new Set(sets).size > 1) mismatches.push({ lang, key: base, variants });
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('keeps the release_hint honesty override in every language', () => {
    const banned = /запис|record|grab/i;
    for (const [lang, tree] of Object.entries(flat)) {
      const value = tree['drill.release_hint'];
      expect(value, `missing drill.release_hint for ${lang}`).toBeTruthy();
      expect(banned.test(value ?? ''), `${lang}: "${value}"`).toBe(false);
    }
  });
});
