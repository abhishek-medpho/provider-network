import { prisma } from "@/lib/db";
import Link from "next/link";
import { AttributeType } from "@prisma/client";

type SearchParams = Promise<{
  q?: string;
  type?: string;
  archived?: string;
  category?: string;
}>;

export default async function AttributesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, type, archived, category } = await searchParams;

  const where: Parameters<typeof prisma.attribute.findMany>[0] = {
    where: {
      ...(archived === "1"
        ? { NOT: { archivedAt: null } }
        : { archivedAt: null }),
      ...(type ? { type: type as AttributeType } : {}),
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { key: { contains: q, mode: "insensitive" } },
              { label: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ category: "asc" }, { label: "asc" }],
    include: { _count: { select: { profileTypeAttrs: true } } },
  };
  const attributes = await prisma.attribute.findMany(where);
  const allCategories = await prisma.attribute.findMany({
    where: { archivedAt: null, category: { not: null } },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });

  return (
    <div className="px-8 py-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Attributes
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            The atomic data points captured per care provider. Profile types
            bundle these into roles.
          </p>
        </div>
        <Link
          href="/admin/attributes/new"
          className="px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
        >
          + New attribute
        </Link>
      </header>

      <form
        className="mb-6 flex flex-wrap items-center gap-3"
        method="GET"
        action="/admin/attributes"
      >
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search key or label..."
          className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm w-64"
        />

        <select
          name="type"
          defaultValue={type ?? ""}
          className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
        >
          <option value="">All types</option>
          {Object.keys(AttributeType).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          name="category"
          defaultValue={category ?? ""}
          className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
        >
          <option value="">All categories</option>
          {allCategories
            .map((c) => c.category)
            .filter(Boolean)
            .map((c) => (
              <option key={c!} value={c!}>
                {c}
              </option>
            ))}
        </select>

        <select
          name="archived"
          defaultValue={archived ?? "0"}
          className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
        >
          <option value="0">Active only</option>
          <option value="1">Archived only</option>
        </select>

        <button
          type="submit"
          className="px-3 py-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700"
        >
          Apply
        </button>
        {(q || type || category || archived) && (
          <Link
            href="/admin/attributes"
            className="px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
            <tr className="text-left">
              <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                Key
              </th>
              <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                Label
              </th>
              <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                Type
              </th>
              <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                Category
              </th>
              <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                PII
              </th>
              <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                Used in
              </th>
              <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                Flags
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {attributes.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  No attributes match these filters.
                </td>
              </tr>
            )}
            {attributes.map((a) => (
              <tr
                key={a.id}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/admin/attributes/${a.id}`}
                    className="font-mono text-xs text-zinc-700 dark:text-zinc-300 hover:underline"
                  >
                    {a.key}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-zinc-900 dark:text-zinc-50">
                  {a.label}
                </td>
                <td className="px-4 py-2.5">
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {a.type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                  {a.category ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <PiiBadge level={a.piiLevel} />
                </td>
                <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                  {a._count.profileTypeAttrs} role
                  {a._count.profileTypeAttrs === 1 ? "" : "s"}
                </td>
                <td className="px-4 py-2.5 space-x-1.5">
                  {a.isSystem && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      system
                    </span>
                  )}
                  {a.isSearchable && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">
                      searchable
                    </span>
                  )}
                  {a.archivedAt && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                      archived
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">
        Showing {attributes.length} attribute
        {attributes.length === 1 ? "" : "s"}.
      </p>
    </div>
  );
}

function PiiBadge({ level }: { level: string }) {
  if (level === "NONE")
    return <span className="text-xs text-zinc-400">—</span>;
  const colors: Record<string, string> = {
    LOW: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
    MEDIUM:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
    HIGH: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400",
  };
  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded ${colors[level] ?? "bg-zinc-100"}`}
    >
      {level}
    </span>
  );
}
