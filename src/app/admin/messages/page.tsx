import { prisma } from "@/lib/db";
import Link from "next/link";
import { MessageTemplateKind } from "@prisma/client";

type SearchParams = Promise<{
  q?: string;
  kind?: string;
  active?: string;
  profileType?: string;
}>;

const KIND_COLORS: Record<string, string> = {
  INVITE: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  REMINDER:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  CONFIRMATION:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
  ACTIVATION:
    "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400",
  REJECTION: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400",
  CUSTOM: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
};

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, kind, active, profileType } = await searchParams;

  const templates = await prisma.messageTemplate.findMany({
    where: {
      ...(active === "0" ? { active: false } : active === "1" ? { active: true } : {}),
      ...(kind ? { kind: kind as MessageTemplateKind } : {}),
      ...(profileType
        ? profileType === "_none"
          ? { profileTypeId: null }
          : { profileTypeId: profileType }
        : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { body: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { profileType: { select: { code: true, label: true } } },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  const profileTypes = await prisma.profileType.findMany({
    where: { active: true },
    select: { id: true, label: true, code: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="px-8 py-8">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Message Templates
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            WhatsApp copy used for invites, reminders, and confirmations.
            Variables like <code className="text-xs px-1 rounded bg-zinc-100 dark:bg-zinc-800">{`{{name}}`}</code> are
            substituted at send time.
          </p>
        </div>
        <Link
          href="/admin/messages/new"
          className="px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
        >
          + New template
        </Link>
      </header>

      <form
        className="mb-6 flex flex-wrap items-center gap-3"
        method="GET"
        action="/admin/messages"
      >
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search code, name, body..."
          className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm w-64"
        />
        <select
          name="kind"
          defaultValue={kind ?? ""}
          className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
        >
          <option value="">All kinds</option>
          {Object.keys(MessageTemplateKind).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <select
          name="profileType"
          defaultValue={profileType ?? ""}
          className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
        >
          <option value="">Any scope</option>
          <option value="_none">Global (no scope)</option>
          {profileTypes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          name="active"
          defaultValue={active ?? ""}
          className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
        >
          <option value="">All</option>
          <option value="1">Active</option>
          <option value="0">Inactive</option>
        </select>
        <button
          type="submit"
          className="px-3 py-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700"
        >
          Apply
        </button>
        {(q || kind || profileType || active) && (
          <Link
            href="/admin/messages"
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
                Code
              </th>
              <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                Name
              </th>
              <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                Kind
              </th>
              <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                Lang
              </th>
              <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                Scope
              </th>
              <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                Variables
              </th>
              <th className="px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-400">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {templates.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  No templates match these filters.
                </td>
              </tr>
            )}
            {templates.map((t) => (
              <tr
                key={t.id}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/admin/messages/${t.id}`}
                    className="font-mono text-xs text-zinc-700 dark:text-zinc-300 hover:underline"
                  >
                    {t.code}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-zinc-900 dark:text-zinc-50">
                  {t.name}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${KIND_COLORS[t.kind] ?? KIND_COLORS.CUSTOM}`}
                  >
                    {t.kind}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                  {t.language}
                </td>
                <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                  {t.profileType ? t.profileType.label : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {t.variables.length === 0 && (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                    {t.variables.slice(0, 4).map((v) => (
                      <code
                        key={v}
                        className="font-mono text-[10px] px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      >
                        {v}
                      </code>
                    ))}
                    {t.variables.length > 4 && (
                      <span className="text-xs text-zinc-400">
                        +{t.variables.length - 4}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {t.active ? (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                      active
                    </span>
                  ) : (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                      inactive
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">
        {templates.length} template{templates.length === 1 ? "" : "s"}.
      </p>
    </div>
  );
}
