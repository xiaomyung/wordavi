import { describe, expect, it } from 'vitest';
import en from '@/i18n/resources/en.json';
import es from '@/i18n/resources/es.json';
import ru from '@/i18n/resources/ru.json';

type Tree = { [key: string]: string | Tree };

const resources: Record<string, Tree> = { ru, en, es };

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

function placeholdersOf(value: string): string[] {
  return [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1] ?? '').sort();
}

describe('i18n resources', () => {
  it('have identical key sets across languages', () => {
    const [baseLang, ...otherLangs] = Object.keys(flat);
    if (!baseLang) throw new Error('no resources loaded');
    const baseKeys = new Set(Object.keys(flat[baseLang] ?? {}));

    for (const lang of otherLangs) {
      const keys = new Set(Object.keys(flat[lang] ?? {}));
      const missingInLang = [...baseKeys].filter((key) => !keys.has(key));
      const missingInBase = [...keys].filter((key) => !baseKeys.has(key));

      expect({ lang, missingInLang, missingInBase }).toEqual({
        lang,
        missingInLang: [],
        missingInBase: [],
      });
    }
  });

  it('use matching interpolation placeholders for every key across languages', () => {
    const langs = Object.keys(flat);
    const [baseLang, ...otherLangs] = langs;
    if (!baseLang) throw new Error('no resources loaded');
    const baseEntries = flat[baseLang] ?? {};

    const mismatches: Array<{ key: string; lang: string; expected: string[]; actual: string[] }> =
      [];

    for (const key of Object.keys(baseEntries)) {
      const expected = placeholdersOf(baseEntries[key] ?? '');
      for (const lang of otherLangs) {
        const value = flat[lang]?.[key];
        const actual = placeholdersOf(value ?? '');
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          mismatches.push({ key, lang, expected, actual });
        }
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
