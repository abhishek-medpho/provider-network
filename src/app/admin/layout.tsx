import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Toaster } from "@/components/ui/sonner";

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
    // h-screen + overflow-hidden on the outer container locks viewport;
    // sidebar and content area each manage their own scroll independently.
    <div className="h-screen flex bg-background text-foreground overflow-hidden">
      <AdminSidebar
        user={{
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
        }}
        onSignOut={handleSignOut}
      />
      <div className="flex-1 min-w-0 flex flex-col h-full">
        <AdminTopbar />
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
