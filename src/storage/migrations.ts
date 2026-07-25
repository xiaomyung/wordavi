export type StorageSnapshot = Record<string, unknown>;
export type Migration = (raw: StorageSnapshot) => StorageSnapshot;

export const schemaVersion = 1;

/**
 * Keyed by the version a migration upgrades *from*. Empty today because
 * schemaVersion 1 is the first shipped shape; later bumps add an entry here
 * and runMigrations walks them in order.
 */
export const migrations: Record<number, Migration> = {};

export function runMigrations(
  snapshot: StorageSnapshot,
  fromVersion: number,
  toVersion: number,
  steps: Record<number, Migration>,
): StorageSnapshot {
  let current = snapshot;
  for (let version = fromVersion; version < toVersion; version += 1) {
    const step = steps[version];
    if (!step) {
      throw new Error(`missing storage migration for version ${version}`);
    }
    current = step(current);
  }
  return current;
}
