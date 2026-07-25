export function readRawString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeRawString(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeRawKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage unavailable; nothing to clean up
  }
}
