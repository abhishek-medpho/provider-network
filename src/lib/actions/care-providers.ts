"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { CareProviderStatus, type Prisma } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user;
}

export async function setCareProviderStatus(
  id: string,
  newStatus: string,
  reason?: string,
) {
  const user = await requireAdmin();
  if (!(newStatus in CareProviderStatus)) {
    throw new Error(`Unknown status: ${newStatus}`);
  }
  const provider = await prisma.careProvider.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!provider) throw new Error("Not found");

  await prisma.$transaction([
    prisma.careProvider.update({
      where: { id },
      data: {
        status: newStatus as CareProviderStatus,
        blockedReason:
          newStatus === "BLOCKED" ? (reason ?? "Blocked by admin") : null,
      },
    }),
    prisma.careProviderEvent.create({
      data: {
        careProviderId: id,
        type: "STATUS_CHANGED",
        payload: {
          from: provider.status,
          to: newStatus,
          by: user.id,
          reason: reason ?? null,
        } as Prisma.InputJsonValue,
      },
    }),
  ]);

  // Fire a transactional message for status transitions the user cares
  // about. Best-effort + non-blocking — the admin's status-change action
  // still completes if the message send fails (e.g. WhatsApp offline).
  const transactionalCode = transactionalCodeForStatus(newStatus);
  if (transactionalCode) {
    void (async () => {
      try {
        const { sendTransactional } = await import(
          "@/lib/dispatch/transactional"
        );
        await sendTransactional({
          careProviderId: id,
          templateCode: transactionalCode,
          vars: { reason: reason ?? "" },
        });
      } catch (err) {
        console.error(
          `[setCareProviderStatus] transactional send failed for ${id} → ${newStatus}:`,
          err,
        );
      }
    })();
  }

  revalidatePath(`/admin/care-providers/${id}`);
  revalidatePath("/admin/care-providers");
}

/**
 * Map a target status to the transactional template code we should fire.
 * Returns null for transitions that don't warrant a provider-facing
 * message (e.g. moving someone LEAD → ENGAGED is internal bookkeeping).
 */
function transactionalCodeForStatus(status: string): string | null {
  switch (status) {
    case "VERIFIED":
    case "ACTIVE":
      return "profile_activated";
    case "REJECTED":
      return "profile_rejected";
    default:
      return null;
  }
}
