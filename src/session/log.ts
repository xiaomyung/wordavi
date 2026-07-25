/**
 * Session logging is injected by the caller — the session layer never imports the
 * real logger (that lives in `@/services`, a banned import). The app wires the
 * real logger at bootstrap:
 *
 *   import { log } from '@/services/log';
 *   import { setSessionLogger } from '@/session';
 *   setSessionLogger((level, msg, data) => log[level]('session', msg, data));
 *
 * Session code calls `slog()` on every meaningful state transition (round
 * start/finish, answer verdicts, SRS updates, wrongQueue changes, streak/goal
 * changes). When no logger is wired, calls are no-ops.
 */

export type SessionLogLevel = 'debug' | 'info';
export type SessionLogger = (level: SessionLogLevel, msg: string, data?: unknown) => void;

let sessionLogger: SessionLogger | null = null;

export function setSessionLogger(fn: SessionLogger | null): void {
  sessionLogger = fn;
}

export function slog(level: SessionLogLevel, msg: string, data?: unknown): void {
  if (sessionLogger === null) return;
  if (data === undefined) {
    sessionLogger(level, msg);
  } else {
    sessionLogger(level, msg, data);
  }
}
