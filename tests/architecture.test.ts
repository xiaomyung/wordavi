import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../src');

/**
 * Layer contract: key = top-level dir under src/, value = banned import prefixes.
 * Cross-layer imports must use the @/ alias; relative imports may not leave their layer.
 */
const BANNED: Record<string, string[]> = {
  engine: [
    'react',
    'react-dom',
    '@/session',
    '@/modes',
    '@/services',
    '@/storage',
    '@/i18n',
    '@/components',
    '@/screens',
    '@/app',
  ],
  session: [
    'react',
    'react-dom',
    '@/modes',
    '@/services',
    '@/storage',
    '@/i18n',
    '@/components',
    '@/screens',
    '@/app',
  ],
  storage: [
    'react',
    'react-dom',
    '@/engine',
    '@/session',
    '@/modes',
    '@/services',
    '@/i18n',
    '@/components',
    '@/screens',
    '@/app',
  ],
  services: ['react', 'react-dom', '@/engine', '@/modes', '@/components', '@/screens', '@/app'],
  components: ['@/engine', '@/session', '@/modes', '@/services', '@/storage', '@/screens', '@/app'],
  modes: ['@/screens', '@/services', '@/storage', '@/app'],
  i18n: [
    '@/engine',
    '@/session',
    '@/modes',
    '@/services',
    '@/storage',
    '@/components',
    '@/screens',
  ],
};

const IMPORT_RE =
  /(?:^|\n)\s*(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf-8');
  const specs: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    const spec = match[1] ?? match[2];
    if (spec) specs.push(spec);
  }
  return specs;
}

function layerOf(file: string): string | undefined {
  return relative(SRC, file).split(sep)[0];
}

describe('layer architecture', () => {
  const files = walk(SRC);

  it('bans cross-layer imports per contract', () => {
    const violations: string[] = [];
    for (const file of files) {
      const layer = layerOf(file);
      const banned = layer ? BANNED[layer] : undefined;
      if (!banned) continue;
      for (const spec of importsOf(file)) {
        const hit = banned.find((ban) => spec === ban || spec.startsWith(`${ban}/`));
        if (hit) violations.push(`${relative(SRC, file)} imports "${spec}" (banned: ${hit})`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps relative imports inside their own layer', () => {
    const violations: string[] = [];
    for (const file of files) {
      const layer = layerOf(file);
      if (!layer || !BANNED[layer]) continue;
      for (const spec of importsOf(file)) {
        if (!spec.startsWith('.')) continue;
        const target = resolve(join(file, '..'), spec);
        if (layerOf(`${target}.ts`) !== layer) {
          violations.push(`${relative(SRC, file)} escapes its layer via "${spec}"`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
