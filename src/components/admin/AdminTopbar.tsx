"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sticky top bar showing breadcrumbs derived from the URL. Mobile menu button
 * goes here later (sheet-based mobile sidebar).
 */
export function AdminTopbar() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <header className="sticky top-0 z-30 h-14 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70 flex items-center px-4 md:px-6 gap-2">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
        {crumbs.map((c, i) => (
          <div key={c.href} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight className="size-3.5 text-muted-foreground/60" />
            )}
            <Link
              href={c.href}
              className={cn(
                "px-1.5 py-0.5 rounded hover:bg-accent transition-colors",
                i === crumbs.length - 1
                  ? "text-foreground font-medium"
                  : "text-muted-foreground",
              )}
            >
              {c.label}
            </Link>
          </div>
        ))}
      </nav>
    </header>
  );
}

function buildCrumbs(pathname: string): { label: string; href: string }[] {
  const parts = pathname.split("/").filter(Boolean);
  // Always start with Admin
  const out: { label: string; href: string }[] = [
    { label: "Admin", href: "/admin" },
  ];
  let href = "";
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "admin") continue;
    href += `/${parts[i]}`;
    const fullHref = `/admin${href}`;
    out.push({ label: prettify(parts[i]), href: fullHref });
  }
  return out;
}

function prettify(s: string): string {
  if (/^c[a-z0-9]{20,}$/.test(s) || /^[0-9a-f-]{20,}$/i.test(s)) {
    return s.slice(0, 8) + "…";
  }
  return s
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
