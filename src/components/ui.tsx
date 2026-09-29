// The app's small design system. Reusable primitives used across every page so
// screens stop being styled independently — spacing, color, and type stay
// consistent, and status/priority are the only place color carries meaning.
import type { ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-surface p-4 ${className}`}>{children}</div>;
}

export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[11px] font-semibold uppercase tracking-wide text-muted ${className}`}>{children}</p>;
}

const TONE_CLASSES = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-surface-muted text-muted",
  accent: "bg-accent text-background",
} as const;

export function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof TONE_CLASSES;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

// The "●━━●━━○━━○  2/4 blocks · 32 min remaining" persistent progress indicator
// used in Today/OA/Blind sessions — the user should always know where they are,
// how much remains, and that there's a next step.
export function SessionProgress({
  total,
  doneCount,
  minutesRemaining,
}: {
  total: number;
  doneCount: number;
  minutesRemaining: number;
}) {
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`h-1.5 w-7 rounded-full ${i < doneCount ? "bg-accent" : "bg-border-strong"}`} />
        ))}
      </div>
      <span>
        {doneCount}/{total} blocks
      </span>
      <span aria-hidden>·</span>
      <span>{minutesRemaining} min remaining</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong p-6 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

// A single labeled "why" line — used everywhere a block/decision needs to justify
// itself. Kept compact and always visible rather than hidden in tiny gray text,
// per the coaching-not-dashboard product identity.
export function Rationale({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted px-3 py-2">
      <SectionLabel>Why this</SectionLabel>
      <p className="mt-1 text-sm text-foreground/80">{children}</p>
    </div>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
