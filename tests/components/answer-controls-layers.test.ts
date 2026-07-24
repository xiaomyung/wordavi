import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* Source-level guards for src/components/answer-controls.css. jsdom/happy-dom
   never applies this stylesheet (no cascade-layer support), so the rules that
   draw the mic/speaker circles are asserted against the source text instead —
   the DOM specs in MicButton/SpeakerButton pin the classes, these pin what the
   classes are worth. Read from disk rather than imported: Vitest stubs CSS
   imports (and `?raw` with them) to an empty module. */
const css = readFileSync(join(process.cwd(), 'src/components/answer-controls.css'), 'utf8');

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

describe('answer-controls.css cascade layers', () => {
  it('declares the layer order before opening the components layer', () => {
    // This file is imported from component modules, so it can be bundled ahead
    // of the Tailwind entry. Layer precedence follows first-declaration order:
    // without the statement, `components` registers first and therefore ranks
    // BELOW `base`, letting Tailwind's preflight (`button { background-color:
    // transparent; border-radius: 0 }`) strip the fill and radius off every
    // .wa-* button — the mic and speaker circles disappear.
    const statement = css.indexOf('@layer properties, theme, base, components, utilities;');
    const block = css.indexOf('@layer components {');
    expect(statement).toBeGreaterThanOrEqual(0);
    expect(block).toBeGreaterThan(statement);
  });

  it('introduces no palette values of its own', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe('answer-controls.css circles', () => {
  it('draws the mic as a filled accent circle with a 4px shelf and glaze', () => {
    const mic = declarationsFor('.wa-mic');
    expect(mic).toContain('width: var(--size-mic)');
    expect(mic).toContain('height: var(--size-mic)');
    expect(mic).toContain('border-radius: 50%');
    expect(mic).toContain('background: var(--color-accent)');
    expect(mic).toContain('color: var(--color-on-accent)');
    expect(mic).toContain('0 4px 0 var(--color-accent-shelf)');
    expect(mic).toContain('inset 0 1.5px 0 var(--color-shelf-glint)');
  });

  it('sinks the mic onto its shelf while held', () => {
    // shares its rule with [data-state="holding"]; :active is the tail selector
    const pressed = declarationsFor('.wa-mic:active');
    expect(pressed).toContain('translateY(3px)');
    expect(pressed).toContain('0 1px 0 var(--color-accent-shelf)');
  });

  it('keeps the circle when the mic is denied, only muting it', () => {
    const denied = declarationsFor('.wa-mic[data-state="denied"]');
    expect(denied).toContain('background: var(--color-disabled-bg)');
    expect(denied).toContain('color: var(--color-text-muted)');
    // no size/radius override: the muted circle stays a circle
    expect(denied).not.toContain('border-radius');
    expect(denied).not.toContain('width');
  });

  it('draws the speaker as a filled accent circle with the shelf token', () => {
    const speaker = declarationsFor('.wa-speaker');
    expect(speaker).toContain('width: var(--size-speaker)');
    expect(speaker).toContain('height: var(--size-speaker)');
    expect(speaker).toContain('border-radius: 50%');
    expect(speaker).toContain('background: var(--color-accent)');
    expect(speaker).toContain('color: var(--color-on-accent)');
    expect(speaker).toContain('box-shadow: var(--shadow-shelf)');
  });

  it('sizes the holding rings off the 148px wrap, not the button', () => {
    // A ring sized to --size-mic hugs the circle and reads as no ring at all;
    // stretching it across the wrap is what makes the radar ping legible.
    const wrap = declarationsFor('.wa-mic-wrap');
    expect(wrap).toContain('width: calc(var(--size-mic) + 3rem)');

    const ring = declarationsFor('.wa-mic-ring');
    expect(ring).toContain('inset: 0');
    expect(ring).not.toContain('width:');
    expect(ring).not.toContain('height:');
    expect(ring).toContain('border: 2px solid var(--color-accent)');
    expect(ring).toContain('border-radius: 50%');
    expect(ring).toContain('wa-ring-pulse 1.6s');
  });

  it('centres the rings on the button by stretching, never by translate', () => {
    // The classic off-centre bug: centre with translate(-50%, -50%), then let a
    // keyframe set `transform: scale()` — the scale replaces the translate and
    // the ring drifts. Stretching to all four edges of the square wrap needs no
    // translate at all, so scale() can never clobber the centring.
    const wrap = declarationsFor('.wa-mic-wrap');
    expect(wrap).toContain('position: relative');
    expect(wrap).toContain('align-items: center');
    expect(wrap).toContain('justify-content: center');
    // square wrap: same expression for both axes, so its centre is the button's
    expect(wrap).toContain('width: calc(var(--size-mic) + 3rem)');
    expect(wrap).toContain('height: calc(var(--size-mic) + 3rem)');

    const ring = declarationsFor('.wa-mic-ring');
    expect(ring).toContain('position: absolute');
    expect(ring).toContain('transform-origin: center');
    expect(ring).not.toContain('margin');
    expect(ring).not.toContain('translate');
  });

  it('sweeps the rings outward and fades them to nothing', () => {
    const frames = withoutComments(
      css.slice(css.indexOf('@keyframes wa-ring-pulse'), css.indexOf('.wa-mic-ring {')),
    );
    // starts just outside the button, ends flush with the wrap (never beyond,
    // so no ancestor scroll container can clip it)
    expect(frames).toContain('scale(0.7)');
    expect(frames).toContain('scale(1)');
    expect(frames).toContain('opacity: 0.6');
    expect(frames).toContain('opacity: 0;');
    // scale is the ONLY transform: nothing to overwrite the centring
    expect(frames).not.toContain('translate');
    expect(declarationsFor('.wa-mic-ring--delayed')).toContain('animation-delay: 0.5s');
  });
});
