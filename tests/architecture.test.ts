import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
  // Screens are composed BY the app, never the other way round: everything a
  // screen needs from the app layer arrives as a prop.
  screens: ['@/app'],
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

/**
 * The file an import specifier names, or undefined for anything outside `src/`
 * (a package, a stylesheet, an asset). Mirrors the `@/` alias and the extension
 * order the bundler resolves in.
 */
function resolveImport(from: string, spec: string): string | undefined {
  let base: string;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(join(from, '..'), spec);
  else return undefined;

  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return undefined;
}

/**
 * The first import cycle in the graph, as the chain that closes it, or null when
 * there is none. A cycle is what no per-file rule can see: every edge in it is
 * legal on its own, and it is only the loop that makes the modules impossible to
 * reason about — or to load, once one of them runs code at import time.
 */
function findCycle(files: readonly string[]): string[] | null {
  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  function visit(file: string): string[] | null {
    if (onStack.has(file)) return [...stack.slice(stack.indexOf(file)), file];
    if (visited.has(file)) return null;
    visited.add(file);
    stack.push(file);
    onStack.add(file);
    for (const spec of importsOf(file)) {
      const target = resolveImport(file, spec);
      if (target === undefined) continue;
      const cycle = visit(target);
      if (cycle) return cycle;
    }
    stack.pop();
    onStack.delete(file);
    return null;
  }

  for (const file of files) {
    const cycle = visit(file);
    if (cycle) return cycle.map((path) => relative(SRC, path));
  }
  return null;
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

  it('has no import cycle', () => {
    // The claim docs/architecture/layers.md makes for this test: a per-file rule
    // cannot see a loop, so the whole graph is walked at once.
    expect(findCycle(files)).toBeNull();
  });
});
