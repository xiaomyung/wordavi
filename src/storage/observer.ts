import type { StorageObserver, StorageObserverEvent } from './types';

let observer: StorageObserver | null = null;

export function setStorageObserver(next: StorageObserver | null): void {
  observer = next;
}

export function reportObserver(event: StorageObserverEvent): void {
  observer?.(event);
}
