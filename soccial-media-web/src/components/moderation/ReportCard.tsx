import { Clock3, MessageSquareWarning, Sparkles } from 'lucide-react'

import { cn } from '@/utils'
import { SeverityBadge } from './SeverityBadge'
import type { ModerationReport } from './types'

const statusLabel: Record<ModerationReport['status'], string> = {
  pending: 'Pending',
  reviewing: 'Reviewing',
  action_taken: 'Action Taken',
  resolved: 'Resolved',
  appeal: 'Appeal',
}

const typeLabel: Record<ModerationReport['type'], string> = {
  post: 'Post',
  user: 'Account',
  message: 'Message',
  comment: 'Comment',
}

const statusClass: Record<ModerationReport['status'], string> = {
  pending: 'bg-orange-100 text-orange-800',
  reviewing: 'bg-yellow-100 text-yellow-800',
  action_taken: 'bg-blue-100 text-blue-800',
  resolved: 'bg-emerald-100 text-emerald-800',
  appeal: 'bg-fuchsia-100 text-fuchsia-800',
}

export function ReportCard({ report }: { report: ModerationReport }) {
  const critical = report.severity === 'critical'

  return (
    <article
      className={cn(
        'rounded-lg border bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow-md focus-within:ring-2 focus-within:ring-blue-100',
        critical ? 'border-red-300 shadow-red-100' : 'border-slate-200'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={report.severity} />
            <span className={cn('rounded-md px-2 py-1 text-xs font-semibold', statusClass[report.status])}>{statusLabel[report.status]}</span>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{typeLabel[report.type]}</span>
          </div>
          <h3 className="mt-3 line-clamp-1 text-sm font-bold text-slate-950">{report.subject}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{report.reason}</p>
        </div>
        <div className="text-right">
          <span className="block text-xs font-semibold uppercase text-slate-500">Priority</span>
          <strong className={cn('text-xl', critical ? 'text-red-700' : 'text-slate-900')}>P{report.priority}</strong>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-blue-600" aria-hidden="true" />
          AI {report.aiScore}%
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5 text-slate-500" aria-hidden="true" />
          {report.createdAt}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MessageSquareWarning className="size-3.5 text-slate-500" aria-hidden="true" />
          {report.reporter || 'Community report'}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500">Assignee: {report.assignee || 'Unassigned'}</span>
        <div className="flex gap-2">
          <button className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-100">
            Review
          </button>
          <button className="rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200">
            Take action
          </button>
        </div>
      </div>
    </article>
  )
}

