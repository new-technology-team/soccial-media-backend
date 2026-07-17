import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

import { cn } from '@/utils'
import type { StatCard } from './types'

const toneClass: Record<StatCard['tone'], string> = {
  pending: 'border-orange-200 bg-orange-50/80 text-orange-900',
  reviewing: 'border-yellow-200 bg-yellow-50/80 text-yellow-900',
  resolved: 'border-emerald-200 bg-emerald-50/80 text-emerald-900',
  critical: 'border-red-200 bg-red-50/80 text-red-900',
  neutral: 'border-slate-200 bg-white text-slate-900',
}

export function ModeratorStats({ cards }: { cards: StatCard[] }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Moderation overview">
      {cards.map((card) => {
        const Icon = card.icon
        const TrendIcon = card.trend.startsWith('-') ? ArrowDownRight : ArrowUpRight

        return (
          <article
            key={card.label}
            className={cn('rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md', toneClass[card.tone])}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{card.label}</p>
                <strong className="mt-2 block text-3xl font-black tracking-normal">{card.value.toLocaleString('vi-VN')}</strong>
              </div>
              <span className="rounded-md bg-white/75 p-2 shadow-sm">
                <Icon className="size-5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 text-xs">
              <span className="rounded-md bg-white/70 px-2 py-1 font-bold">{card.badge}</span>
              <span className="inline-flex items-center gap-1 font-semibold">
                <TrendIcon className="size-3.5" aria-hidden="true" />
                {card.trend}
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 opacity-80">{card.helper}</p>
          </article>
        )
      })}
    </section>
  )
}

