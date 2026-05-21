import { prisma } from "@/lib/db";
import Link from "next/link";
import { CareProviderStatus } from "@prisma/client";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  profileType?: string;
  pincode?: string;
}>;

const STATUS_COLORS: Record<string, string> = {
  LEAD: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
  ENGAGED: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  PROFILED:
    "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400",
  PENDING_VERIFICATION:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  VERIFIED:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
  ACTIVE:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
  PAUSED: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400",
  BLOCKED: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400",
  OPTED_OUT: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400",
  REJECTED: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400",
};

export default async function CareProvidersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, status, profileType, pincode } = await searchParams;

  const providers = await prisma.careProvider.findMany({
    where: {
      ...(status ? { status: status as CareProviderStatus } : {}),
      ...(profileType ? { profileTypeId: profileType } : {}),
      ...(pincode ? { pincodeHome: pincode } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      profileType: { select: { code: true, label: true } },
      leadBatch: { select: { name: true } },
      _count: { select: { campaignMemberships: true, events: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
  });

  const profileTypes = await prisma.profileType.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true },
  });

  // Status counts (over the whole table, regardless of filters — feels right
  // for an overview-y header bar)
  const statusCountsRaw = await prisma.careProvider.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const statusCounts: Record<string, number> = {};
  for (const r of statusCountsRaw) statusCounts[r.status] = r._count._all;

  return (
    <div className="px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Care Providers
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Everyone in the system. Status moves LEAD → ENGAGED → PROFILED →
          PENDING_VERIFICATION → VERIFIED → ACTIVE as they fill the form and
          we approve them.
        </p>
      </header>

      {/* Status pills */}
      <div className="flex flex-wrap gap-1.5 mb-6 text-xs">
        {Object.keys(CareProviderStatus).map((s) => (
          <Link
            key={s}
            href={`/admin/care-providers?status=${s}`}
            className={`px-2 py-1 rounded ${
              status === s
                ? "bg-zinc-900 text-white"
                : STATUS_COLORS[s] ?? "bg-zinc-100"
            }`}
          >
            {s} <span className="opacity-60">· {statusCounts[s] ?? 0}</span>
          </Link>
        ))}
        {status && (
          <Link
            href="/admin/care-providers"
            className="px-2 py-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            Clear
          </Link>
        )}
      </div>

      {/* Filters */}
      <form
        className="mb-6 flex flex-wrap items-center gap-3"
        method="GET"
        action="/admin/care-providers"
      >
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name, phone, email..."
          className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm w-64"
        />
        <select
          name="profileType"
          defaultValue={profileType ?? ""}
          className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
        >
          <option value="">All roles</option>
          {profileTypes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="pincode"
          defaultValue={pincode ?? ""}
          placeholder="Pincode..."
          className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm w-32"
        />
        {status && (
          <input type="hidden" name="status" value={status} />
        )}
        <button
          type="submit"
          className="px-3 py-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700"
        >
          Apply
        </button>
      </form>

      {/* Table */}
      {providers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-10 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No care providers match these filters.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                  Name
                </th>
                <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                  Phone
                </th>
                <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                  Role
                </th>
                <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                  Status
                </th>
                <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                  Pincode
                </th>
                <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                  Source
                </th>
                <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                  Campaigns
                </th>
                <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {providers.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/care-providers/${p.id}`}
                      className="text-zinc-900 dark:text-zinc-50 hover:underline font-medium"
                    >
                      {p.name ?? <span className="text-zinc-400">—</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {p.phone}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                    {p.profileType?.label ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-xs uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        STATUS_COLORS[p.status] ?? ""
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                    {p.pincodeHome ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {p.leadBatch?.name ?? p.source ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                    {p._count.campaignMemberships}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(p.updatedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">
        {providers.length === 200
          ? "Showing first 200 — refine filters"
          : `${providers.length} provider${providers.length === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}
