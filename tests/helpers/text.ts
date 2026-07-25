/**
 * Testing-library collapses whitespace before matching, so the engine's thin
 * spaces (`formatNumber`, `formatPrice`) read as plain ones in the DOM query.
 */
export function plainSpaces(text: string): string {
  return text.replace(/\s/g, ' ');
}
