import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* Source-level guards for src/components/scroll-area.css. happy-dom applies no
   stylesheet and knows nothing about cascade layers, so the rules that make the
   overlay scrollbar an overlay (rather than a second layout box) are asserted
   against the source text; ScrollArea.test.tsx pins the classes and the
   geometry, these pin what the classes are worth. Read from disk rather than
   imported: Vitest stubs CSS imports (and `?raw` with them) to an empty module. */
const css = readFileSync(join(process.cwd(), 'src/components/scroll-area.css'), 'utf8');

/** Comments stripped so prose about a property never satisfies an assertion. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Declarations of a top-level (non-nested) rule, selector line included. */
function declarationsFor(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`missing rule: ${selector}`);
  const end = css.indexOf('}', start);
  return withoutComments(css.slice(start, end));
}

describe('scroll-area.css cascade layers', () => {
  it('declares the layer order before opening the components layer', () => {
    // This file is imported from a component module, so it can be bundled ahead
    // of the Tailwind entry. Layer precedence follows first-declaration order:
    // without the statement, `components` registers first and therefore ranks
    // BELOW `base`, letting Tailwind's preflight reset outrank every rule that
    // draws the rail and the thumb.
    const statement = css.indexOf('@layer properties, theme, base, components, utilities;');
    const block = css.indexOf('@layer components {');
    expect(statement).toBeGreaterThanOrEqual(0);
    expect(block).toBeGreaterThan(statement);
  });

  it('introduces no palette values of its own', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe('scroll-area.css overlay contract', () => {
  it('takes the rail out of flow so showing it can never shift the content', () => {
    const wrap = declarationsFor('.wa-scroll');
    expect(wrap).toContain('position: relative');
    expect(wrap).toContain('min-height: 0');

    const rail = declarationsFor('.wa-scroll-rail');
    expect(rail).toContain('position: absolute');
  });

  it('hides the native bar on both engine families', () => {
    // Firefox honours scrollbar-width; Chromium/WebKit need the pseudo-element.
    expect(declarationsFor('.wa-scroll-view')).toContain('scrollbar-width: none');
    expect(declarationsFor('.wa-scroll-view::-webkit-scrollbar')).toContain('display: none');
  });

  it('never removes the rail from layout, only from view', () => {
    // The thumb geometry is measured from the rail's clientHeight: a
    // display:none rail measures 0, reports "no overflow", and could never
    // come back. Fading is the only hiding this file is allowed to do.
    const rail = declarationsFor('.wa-scroll-rail');
    expect(rail).toContain('opacity: 0');
    expect(rail).not.toContain('display: none');
    expect(rail).not.toContain('visibility: hidden');
  });

  it('passes clicks on the empty rail through to the content underneath', () => {
    expect(declarationsFor('.wa-scroll-rail')).toContain('pointer-events: none');
    expect(declarationsFor('.wa-scroll-rail[data-visible="true"] .wa-scroll-thumb')).toContain(
      'pointer-events: auto',
    );
  });

  it('fades with opacity alone, the one property reduced motion keeps', () => {
    const rail = declarationsFor('.wa-scroll-rail');
    expect(rail).toContain('transition: opacity var(--duration-text)');
    expect(declarationsFor('.wa-scroll-rail[data-visible="true"]')).toContain('opacity: 1');
    // a keyframe fade would be collapsed to ~0ms and snap instead
    expect(css).not.toContain('@keyframes');
  });

  it('draws the thumb as a narrow pill from the tokens', () => {
    const thumb = declarationsFor('.wa-scroll-thumb');
    expect(thumb).toContain('border-radius: var(--radius-pill)');
    expect(thumb).toContain('background: var(--color-scrollbar-thumb)');
    // the grip owns its gesture; without this a drag also scrolls the content
    expect(thumb).toContain('touch-action: none');
    // height/offset are measured and written inline — nothing here may fight them
    expect(thumb).not.toContain('height:');
    expect(thumb).not.toContain('transform:');

    const rail = declarationsFor('.wa-scroll-rail');
    expect(rail).toContain('width: var(--size-scrollbar)');
  });

  it('confirms the grab with the accent while dragging', () => {
    const dragging = declarationsFor('.wa-scroll-thumb[data-dragging="true"]');
    expect(dragging).toContain('background: var(--color-scrollbar-thumb-active)');
    expect(dragging).toContain('cursor: grabbing');
  });
});
