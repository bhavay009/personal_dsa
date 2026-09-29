"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The six-pillar product IA: TODAY / ROADMAP / PATTERNS / REVIEW / PROGRESS /
// SIMULATE. This is the whole primary nav — everything else (practice log,
// college, skills, resume, exams...) is real but secondary, so it lives under
// "More" instead of competing with the journey for attention.
const NAV_ITEMS: { href: string; label: string; match: (pathname: string) => boolean }[] = [
  { href: "/today", label: "Today", match: (p) => p.startsWith("/today") },
  { href: "/roadmap", label: "Roadmap", match: (p) => p.startsWith("/roadmap") },
  { href: "/patterns", label: "Patterns", match: (p) => p.startsWith("/patterns") },
  { href: "/revise", label: "Review", match: (p) => p.startsWith("/revise") },
  { href: "/mastery", label: "Progress", match: (p) => p.startsWith("/mastery") },
  { href: "/simulate", label: "Simulate", match: (p) => p.startsWith("/simulate") || p.startsWith("/blind") || p.startsWith("/oa") },
];

export const BOTTOM_NAV_ITEMS = NAV_ITEMS.slice(0, 5);

const MORE_LINKS = [
  { href: "/problems", label: "Practice log" },
  { href: "/exams", label: "Exams" },
  { href: "/library", label: "Library" },
  { href: "/college", label: "College" },
  { href: "/skills", label: "Skills" },
  { href: "/projects", label: "Projects" },
  { href: "/interview", label: "Interview" },
  { href: "/resume", label: "Resume" },
  { href: "/applications", label: "Applications" },
  { href: "/insights", label: "Insights" },
];

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`shrink-0 border-b-2 py-1 text-sm transition-colors ${
        active ? "border-accent font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

export function NavBar() {
  const pathname = usePathname();
  const inMore = MORE_LINKS.some((l) => pathname.startsWith(l.href));

  return (
    <nav className="border-b border-border">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-6 px-4 py-3">
        <Link href="/" className="flex shrink-0 flex-col leading-none">
          <span className={`text-sm font-semibold ${pathname === "/" ? "text-foreground" : "text-foreground/90"}`}>PrepOS</span>
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-muted">DSA Coach</span>
        </Link>

        <div className="hidden shrink-0 items-center gap-5 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} active={item.match(pathname)} />
          ))}
        </div>

        <details className="group relative ml-auto shrink-0">
          <summary className={`cursor-pointer list-none text-sm ${inMore ? "font-semibold text-foreground" : "text-muted hover:text-foreground"}`}>
            More
          </summary>
          <div className="absolute right-0 z-10 mt-2 flex w-48 flex-col gap-1 rounded-lg border border-border bg-surface p-2 shadow-md">
            {MORE_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded px-2 py-1.5 text-sm ${pathname.startsWith(l.href) ? "bg-surface-muted font-semibold" : "text-foreground/70 hover:bg-surface-muted"}`}
              >
                {l.label}
              </Link>
            ))}
            <a href="/api/export" download className="rounded px-2 py-1.5 text-sm text-foreground/70 hover:bg-surface-muted">
              Export data
            </a>
          </div>
        </details>
      </div>
    </nav>
  );
}

// Mobile primary navigation — a real bottom bar, not the desktop nav squeezed
// into a smaller space. Simulate is deliberately left out, same as the spec's
// mobile IA: the five-item journey stays on screen, Simulate lives in "More".
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface md:hidden">
      <div className="mx-auto flex max-w-2xl items-stretch">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${
                active ? "font-semibold text-foreground" : "text-muted"
              }`}
            >
              <span className={`h-1 w-1 rounded-full ${active ? "bg-accent" : "bg-transparent"}`} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
