import { AlertOctagon, ShieldAlert } from 'lucide-react'

import { cn } from '@/utils'

type AlertItem = {
  id: string
  title: string
  detail: string
  level: 'critical' | 'warning' | 'info'
}

const levelClass: Record<AlertItem['level'], string> = {
  critical: 'border-red-200 bg-red-50 text-red-950',
  warning: 'border-orange-200 bg-orange-50 text-orange-950',
  info: 'border-blue-200 bg-blue-50 text-blue-950',
}

export function AlertPanel({ alerts }: { alerts: AlertItem[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="alert-center-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-700">Alert Center</p>
          <h2 id="alert-center-title" className="text-lg font-black text-slate-950">
            Risk signals
          </h2>
        </div>
        <ShieldAlert className="size-5 text-red-700" aria-hidden="true" />
      </div>
      <div className="mt-4 grid gap-3">
        {alerts.map((alert) => (
          <article key={alert.id} className={cn('rounded-lg border p-3', levelClass[alert.level])}>
            <div className="flex gap-2">
              <AlertOctagon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-black">{alert.title}</h3>
                <p className="mt-1 text-xs leading-5 opacity-85">{alert.detail}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

