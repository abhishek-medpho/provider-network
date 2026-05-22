import { auth, signOut } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Overview", icon: "▣" },
  { href: "/admin/care-providers", label: "Care Providers", icon: "👥" },
  { href: "/admin/attributes", label: "Attributes", icon: "◧" },
  { href: "/admin/profile-types", label: "Profile Types", icon: "▢" },
  { href: "/admin/forms", label: "Forms", icon: "▤" },
  { href: "/admin/messages", label: "Messages", icon: "✉" },
  { href: "/admin/campaigns", label: "Campaigns", icon: "▶" },
  { href: "/admin/reminders", label: "Reminders", icon: "🔔" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/admin");

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex">
      <aside className="w-60 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col">
        <div className="px-5 py-5 border-b border-zinc-200 dark:border-zinc-800">
          <Link href="/admin" className="block">
            <div className="font-semibold text-zinc-900 dark:text-zinc-50">
              Care Provider
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Platform · Admin
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
            >
              <span className="text-xs w-4 text-center text-zinc-400">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-zinc-200 dark:border-zinc-800">
          <div className="px-3 py-2">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
              {session.user.name ?? session.user.email}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {session.user.role}
            </div>
          </div>
          <form action={handleSignOut}>
            <button
              type="submit"
              className="w-full text-left px-3 py-2 rounded-md text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
