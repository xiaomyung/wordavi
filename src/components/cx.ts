export type ClassValue = string | false | null | undefined;

/** Join truthy class fragments into a className string. */
export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
