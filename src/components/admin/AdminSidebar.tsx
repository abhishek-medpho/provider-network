"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ListChecks,
  FileText,
  MessageSquare,
  Megaphone,
  Bell,
  Briefcase,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/care-providers", label: "Care Providers", icon: Users },
  { href: "/admin/attributes", label: "Attributes", icon: ListChecks },
  { href: "/admin/forms", label: "Forms", icon: FileText },
  { href: "/admin/messages", label: "Messages", icon: MessageSquare },
  { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/admin/jobs", label: "Jobs", icon: Briefcase },
  { href: "/admin/reminders", label: "Reminders", icon: Bell },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar({
  user,
  onSignOut,
}: {
  user: { name?: string | null; email?: string | null; role?: string | null };
  onSignOut: () => void;
}) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const display = user.name ?? user.email ?? "User";
  const initials = display
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="px-4 h-14 flex items-center border-b">
        <Link href="/admin" className="flex items-center gap-2 group">
          <div className="size-7 rounded-md bg-foreground text-background flex items-center justify-center text-sm font-bold">
            L
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Labstack</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Provider Admin
            </span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* User block */}
      <div className="px-3 py-3 flex items-center gap-2.5">
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">{initials || "U"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{display}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {user.role ?? "Member"}
          </div>
        </div>
        <form action={onSignOut}>
          <button
            type="submit"
            title="Sign out"
            className="size-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="size-4" />
            <span className="sr-only">Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
