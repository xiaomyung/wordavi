import { describe, expect, it } from 'vitest';
import { galleryRequested } from '@/app/gallery';

describe('galleryRequested', () => {
  it('opens the gallery when the query asks and the build has one', () => {
    expect(galleryRequested('?gallery=1', true)).toBe(true);
    // The value is never read — the parameter's presence is the whole request.
    expect(galleryRequested('?gallery', true)).toBe(true);
    expect(galleryRequested('?seed=31&gallery=0', true)).toBe(true);
  });

  it('ignores the query in a build that carries no gallery', () => {
    expect(galleryRequested('?gallery=1', false)).toBe(false);
    expect(galleryRequested('?gallery', false)).toBe(false);
  });

  it('leaves an ordinary visit on its way to the app', () => {
    expect(galleryRequested('', true)).toBe(false);
    expect(galleryRequested('?seed=31', true)).toBe(false);
  });
});
