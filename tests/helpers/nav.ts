/**
 * `navigator` is read-only in happy-dom, so a suite that needs to fake a
 * capability (share, clipboard, vibrate, onLine, the iOS sniff inputs) has to
 * redefine the property. `configurable: true` lets the next test redefine it
 * again — every caller is expected to put the property back in `afterEach`.
 */
export function setNavProp(name: string, value: unknown): void {
  Object.defineProperty(navigator, name, { value, configurable: true, writable: true });
}
