/**
 * Layout primitives for the gallery only. Deliberately plain — anything that
 * frames a specimen must never be mistaken for the specimen: gallery chrome is
 * dashed and muted, real components are not.
 */
import type { ReactNode } from 'react';

export interface SectionProps {
  /** Anchor target; must match an entry in `GALLERY_SECTIONS`. */
  id: string;
  /** Component names, exactly as exported — the gallery test matches on these. */
  title: string;
  /** Which design-handoff file(s) to open side by side. */
  compare: string;
  children: ReactNode;
}

export function Section({ id, title, compare, children }: SectionProps) {
  return (
    <section id={id} className="flex flex-col gap-4">
      <header className="flex flex-col gap-1 border-border border-b pb-2">
        <h2 className="font-bold font-display text-text text-title">{title}</h2>
        <p className="font-semibold text-caption text-text-muted">{compare}</p>
      </header>
      {children}
    </section>
  );
}

/** A labelled specimen group. */
export function Case({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-extrabold text-text-faint text-tick uppercase tracking-widest">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Horizontal specimen row that wraps rather than clipping. */
export function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

/** Vertical stack of `Case`s inside a section. */
export function Stack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-5">{children}</div>;
}

/** Instruction to the human doing the smokecheck (states you must trigger). */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-input border border-border-strong border-dashed px-3 py-2 font-semibold text-caption text-text-muted">
      {children}
    </p>
  );
}

/** Gallery-only trigger (replay an animation, advance a demo). Dashed on purpose. */
export function DemoButton({ onPress, children }: { onPress: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="inline-flex min-h-touch shrink-0 cursor-pointer items-center gap-1.5 rounded-pill border border-border-strong border-dashed bg-transparent px-3.5 font-bold text-caption text-text-muted"
    >
      {children}
    </button>
  );
}

/** Controlled specimens that must not accept input. */
export function noop(): void {
  /* frozen specimen */
}
