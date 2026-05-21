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

  revalidatePath(`/admin/care-providers/${id}`);
  revalidatePath("/admin/care-providers");
}
