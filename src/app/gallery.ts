/**
 * The `?gallery` entry point to the component gallery.
 *
 * `included` is the build's answer (`__GALLERY__`), never the browser's: the
 * gallery is a design-review surface, so a build that left it out must not be
 * talkable into opening it — by a query parameter, a stored value, a hostname or
 * anything else that arrives at runtime. The parameter only decides *when* a
 * build that has the gallery shows it.
 */
export function galleryRequested(search: string, included: boolean): boolean {
  return included && new URLSearchParams(search).has('gallery');
}
