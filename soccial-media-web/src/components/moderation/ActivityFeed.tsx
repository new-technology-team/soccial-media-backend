import { Activity, CheckCircle2, Radio } from 'lucide-react'

type ActivityItem = {
  id: string
  actor: string
  action: string
  time: string
  tone?: 'live' | 'success' | 'neutral'
}

const toneClass: Record<NonNullable<ActivityItem['tone']>, string> = {
  live: 'bg-blue-100 text-blue-700',
  success: 'bg-emerald-100 text-emerald-700',
  neutral: 'bg-slate-100 text-slate-700',
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="activity-feed-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Realtime</p>
          <h2 id="activity-feed-title" className="text-lg font-black text-slate-950">
            Activity stream
          </h2>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
          <Radio className="size-3.5" aria-hidden="true" />
          Live
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {items.map((item) => {
          const Icon = item.tone === 'success' ? CheckCircle2 : Activity
          return (
            <div key={item.id} className="flex gap-3 rounded-md border border-slate-100 bg-slate-50/70 p-3">
              <span className={`mt-0.5 rounded-md p-1.5 ${toneClass[item.tone || 'neutral']}`}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{item.actor}</p>
                <p className="text-sm text-slate-600">{item.action}</p>
                <p className="mt-1 text-xs text-slate-500">{item.time}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

