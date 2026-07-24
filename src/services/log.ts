import { pushError, readRawString, STORAGE_KEYS, writeRawString } from '@/storage';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  t: number;
  level: LogLevel;
  ns: string;
  msg: string;
  data?: unknown;
}

const RING_CAP = 400;
const MAX_SERIALIZED_BYTES = 64 * 1024;
const PERSIST_DEBOUNCE_MS = 1000;
const DEFAULT_SERIALIZE_CHARS = 1800;
const MAX_DATA_CHARS = 2000;

function isLogLevel(value: unknown): value is LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error';
}

function isLogEntry(value: unknown): value is LogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.t === 'number' &&
    isLogLevel(record.level) &&
    typeof record.ns === 'string' &&
    typeof record.msg === 'string'
  );
}

function loadInitialBuffer(): LogEntry[] {
  const raw = readRawString(STORAGE_KEYS.log);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLogEntry).slice(-RING_CAP);
  } catch {
    return [];
  }
}

let buffer: LogEntry[] = loadInitialBuffer();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function safeSerialize(data: unknown): unknown {
  try {
    const json = JSON.stringify(data, jsonReplacer);
    if (json === undefined) return String(data);
    if (json.length > MAX_DATA_CHARS) {
      return `${json.slice(0, MAX_DATA_CHARS)}…(truncated)`;
    }
    return JSON.parse(json) as unknown;
  } catch {
    return String(data);
  }
}

function mirrorToConsole(entry: LogEntry): void {
  const prefix = `[${entry.ns}]`;
  const args: unknown[] =
    entry.data === undefined ? [prefix, entry.msg] : [prefix, entry.msg, entry.data];
  switch (entry.level) {
    case 'debug':
      console.debug(...args);
      break;
    case 'info':
      console.info(...args);
      break;
    case 'warn':
      console.warn(...args);
      break;
    case 'error':
      console.error(...args);
      break;
  }
}

export function persistLogNow(): void {
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  let toWrite = buffer;
  let json = JSON.stringify(toWrite);
  while (json.length > MAX_SERIALIZED_BYTES && toWrite.length > 1) {
    toWrite = toWrite.slice(1);
    json = JSON.stringify(toWrite);
  }
  writeRawString(STORAGE_KEYS.log, json);
}

function schedulePersist(): void {
  if (persistTimer !== null) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistLogNow();
  }, PERSIST_DEBOUNCE_MS);
}

function record(level: LogLevel, ns: string, msg: string, data?: unknown): void {
  const entry: LogEntry =
    data === undefined
      ? { t: Date.now(), level, ns, msg }
      : { t: Date.now(), level, ns, msg, data: safeSerialize(data) };
  buffer.push(entry);
  if (buffer.length > RING_CAP) {
    buffer = buffer.slice(-RING_CAP);
  }
  if (import.meta.env.DEV) {
    mirrorToConsole(entry);
  }
  schedulePersist();
}

export const log = {
  debug(ns: string, msg: string, data?: unknown): void {
    record('debug', ns, msg, data);
  },
  info(ns: string, msg: string, data?: unknown): void {
    record('info', ns, msg, data);
  },
  warn(ns: string, msg: string, data?: unknown): void {
    record('warn', ns, msg, data);
  },
  error(ns: string, msg: string, data?: unknown): void {
    record('error', ns, msg, data);
  },
};

export function getRecentLog(n: number = RING_CAP): LogEntry[] {
  return buffer.slice(-n);
}

export function serializeLog(maxChars: number = DEFAULT_SERIALIZE_CHARS): string {
  const picked: LogEntry[] = [];
  let total = 2;
  for (let i = buffer.length - 1; i >= 0; i -= 1) {
    const entry = buffer[i];
    if (!entry) continue;
    const piece = JSON.stringify(entry);
    const additional = piece.length + (picked.length > 0 ? 1 : 0);
    if (total + additional > maxChars && picked.length > 0) break;
    picked.unshift(entry);
    total += additional;
  }
  return JSON.stringify(picked);
}

export function clearLog(): void {
  buffer = [];
  persistLogNow();
}

function toMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  try {
    return JSON.stringify(reason) ?? String(reason);
  } catch {
    return String(reason);
  }
}

function toStack(reason: unknown): string | undefined {
  return reason instanceof Error ? reason.stack : undefined;
}

function recordCapturedError(
  message: string,
  source: string,
  stack: string | undefined,
  data: unknown,
): void {
  log.error('app', message, data);
  if (stack === undefined) {
    pushError({ t: Date.now(), message, source });
  } else {
    pushError({ t: Date.now(), message, source, stack });
  }
}

export function installGlobalErrorCapture(): () => void {
  const onError = (event: ErrorEvent): void => {
    const message = event.message || 'window error';
    recordCapturedError(message, 'window.onerror', toStack(event.error), {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  };

  const onRejection = (event: PromiseRejectionEvent): void => {
    const message = toMessage(event.reason);
    recordCapturedError(message, 'unhandledrejection', toStack(event.reason), {
      reason: safeSerialize(event.reason),
    });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
