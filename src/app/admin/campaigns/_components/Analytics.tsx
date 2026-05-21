import type { CampaignAnalytics } from "@/lib/analytics/campaign";

function pctStr(v: number | null): string {
  if (v === null) return "—";
  return `${Math.round(v * 100)}%`;
}

function minutesToHuman(min: number | null): string {
  if (min === null) return "—";
  if (min < 1) return "<1 min";
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  if (h < 24) {
    const wholeHrs = Math.floor(h);
    const remMin = Math.round((h - wholeHrs) * 60);
    return remMin > 0 ? `${wholeHrs}h ${remMin}m` : `${wholeHrs}h`;
  }
  const d = h / 24;
  return `${d.toFixed(1)}d`;
}

export default function Analytics({ data }: { data: CampaignAnalytics }) {
  return (
    <div className="space-y-6 mb-6">
      <FunnelCard data={data} />

      <div className="grid lg:grid-cols-2 gap-4">
        <RemindersCard data={data} />
        <TimingCard data={data} />
      </div>

      {(data.bySource.length > 1 || data.topFailures.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {data.bySource.length > 1 && <BySourceCard data={data} />}
          {data.topFailures.length > 0 && <FailuresCard data={data} />}
        </div>
      )}
    </div>
  );
}

function FunnelCard({ data }: { data: CampaignAnalytics }) {
  const stages = data.funnel.stages;
  const total = stages[0]?.count ?? 0;
  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Funnel</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          End-to-end: <span className="font-medium text-zinc-900 dark:text-zinc-50">
            {pctStr(data.funnel.e2eConversion)}
          </span>
        </span>
      </div>

      <div className="space-y-2">
        {stages.map((s, i) => {
          const width = total > 0 ? (s.count / total) * 100 : 0;
          return (
            <div key={s.key}>
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {s.label}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {s.count}
                  </span>
                  {i > 0 && (
                    <span className="text-xs text-zinc-400">
                      · {pctStr(s.shareOfTotal)} of total
                    </span>
                  )}
                </div>
                {s.dropFromPrev !== null && s.dropFromPrev > 0 && (
                  <span className="text-xs text-red-600 dark:text-red-400">
                    -{pctStr(s.dropFromPrev)} drop-off
                  </span>
                )}
              </div>
              <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-zinc-900 dark:bg-zinc-100"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RemindersCard({ data }: { data: CampaignAnalytics }) {
  const r = data.reminders;
  const reminderConv =
    r.membersReminded > 0 ? r.convertedAfterReminder / r.membersReminded : null;

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <h2 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
        Reminders
      </h2>
      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-zinc-500 dark:text-zinc-400">Total reminders sent</dt>
        <dd className="text-zinc-900 dark:text-zinc-50 font-medium">
          {r.totalSent}
        </dd>
        <dt className="text-zinc-500 dark:text-zinc-400">Members reminded</dt>
        <dd className="text-zinc-900 dark:text-zinc-50 font-medium">
          {r.membersReminded}
        </dd>
        <dt className="text-zinc-500 dark:text-zinc-400">
          Submitted after reminder
        </dt>
        <dd className="text-zinc-900 dark:text-zinc-50 font-medium">
          {r.convertedAfterReminder}
          {reminderConv !== null && (
            <span className="text-zinc-500 ml-1">
              ({pctStr(reminderConv)})
            </span>
          )}
        </dd>
      </dl>

      {r.distribution.length > 1 && (
        <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wide">
            Distribution
          </div>
          <div className="space-y-1 text-xs">
            {r.distribution.map((d) => (
              <div key={d.count} className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {d.count === 0
                    ? "No reminders"
                    : `${d.count} reminder${d.count === 1 ? "" : "s"}`}
                </span>
                <span className="text-zinc-900 dark:text-zinc-50 font-medium">
                  {d.members}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function TimingCard({ data }: { data: CampaignAnalytics }) {
  const t = data.timing;
  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <h2 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
        Timing
      </h2>
      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-zinc-500 dark:text-zinc-400">
          Time-to-open (median)
        </dt>
        <dd className="text-zinc-900 dark:text-zinc-50 font-medium">
          {minutesToHuman(t.timeToOpenP50Min)}
        </dd>
        <dt className="text-zinc-500 dark:text-zinc-400">Time-to-open (p90)</dt>
        <dd className="text-zinc-900 dark:text-zinc-50">
          {minutesToHuman(t.timeToOpenP90Min)}
        </dd>
        <dt className="text-zinc-500 dark:text-zinc-400">
          Time-to-submit (median, from open)
        </dt>
        <dd className="text-zinc-900 dark:text-zinc-50 font-medium">
          {minutesToHuman(t.timeToSubmitFromOpenP50Min)}
        </dd>
        <dt className="text-zinc-500 dark:text-zinc-400">
          Time-to-submit (p90)
        </dt>
        <dd className="text-zinc-900 dark:text-zinc-50">
          {minutesToHuman(t.timeToSubmitFromOpenP90Min)}
        </dd>
      </dl>

      <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wide">
          Submission tail (of those who submitted)
        </div>
        <div className="space-y-1 text-xs">
          <Bar label="Within 1 hour" value={t.submitWithin1hPct} />
          <Bar label="Within 24 hours" value={t.submitWithin24hPct} />
          <Bar label="Within 72 hours" value={t.submitWithin72hPct} />
        </div>
      </div>
    </section>
  );
}

function Bar({ label, value }: { label: string; value: number | null }) {
  const pctNum = value === null ? 0 : Math.round(value * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-zinc-600 dark:text-zinc-400 w-28 shrink-0">
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div
          className="h-full bg-emerald-500 dark:bg-emerald-400"
          style={{ width: `${pctNum}%` }}
        />
      </div>
      <span className="text-zinc-900 dark:text-zinc-50 font-medium w-10 text-right">
        {value === null ? "—" : `${pctNum}%`}
      </span>
    </div>
  );
}

function BySourceCard({ data }: { data: CampaignAnalytics }) {
  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <h2 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
        By lead source
      </h2>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
            <th className="py-1.5 font-medium">Source</th>
            <th className="py-1.5 font-medium text-right">Members</th>
            <th className="py-1.5 font-medium text-right">Sent</th>
            <th className="py-1.5 font-medium text-right">Opened</th>
            <th className="py-1.5 font-medium text-right">Submitted</th>
            <th className="py-1.5 font-medium text-right">E2E</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {data.bySource.map((row) => (
            <tr key={row.source}>
              <td className="py-1.5 text-zinc-900 dark:text-zinc-50 truncate max-w-[180px]">
                {row.source}
              </td>
              <td className="py-1.5 text-right text-zinc-700 dark:text-zinc-300">
                {row.members}
              </td>
              <td className="py-1.5 text-right text-zinc-700 dark:text-zinc-300">
                {row.sent}
              </td>
              <td className="py-1.5 text-right text-zinc-700 dark:text-zinc-300">
                {row.opened}
              </td>
              <td className="py-1.5 text-right text-zinc-700 dark:text-zinc-300">
                {row.submitted}
              </td>
              <td className="py-1.5 text-right text-zinc-900 dark:text-zinc-50 font-medium">
                {pctStr(row.e2ePct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function FailuresCard({ data }: { data: CampaignAnalytics }) {
  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <h2 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
        Send failures{" "}
        <span className="text-xs text-zinc-500 font-normal">
          ({data.messages.failed} total)
        </span>
      </h2>
      <ul className="space-y-2 text-sm">
        {data.topFailures.map((f, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="font-medium text-zinc-900 dark:text-zinc-50 w-8 shrink-0 text-right">
              {f.count}
            </span>
            <span className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {f.error}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
