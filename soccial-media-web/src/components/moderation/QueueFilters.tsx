import { Search } from 'lucide-react'

import type { QueueStatus, ReportType, Severity } from './types'

export type QueueFilterState = {
  search: string
  severity: Severity | 'all'
  type: ReportType | 'all'
  status: QueueStatus | 'all'
  sort: 'priority' | 'newest'
}

type Props = {
  value: QueueFilterState
  onChange: (next: QueueFilterState) => void
}

export function QueueFilters({ value, onChange }: Props) {
  const update = <K extends keyof QueueFilterState>(key: K, nextValue: QueueFilterState[K]) => {
    onChange({ ...value, [key]: nextValue })
  }

  return (
    <div className="grid gap-2 border-b border-slate-200 pb-3 lg:grid-cols-[1fr_repeat(4,150px)]" aria-label="Report filters">
      <label className="relative min-w-0">
        <span className="sr-only">Search reports</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          value={value.search}
          onChange={(event) => update('search', event.target.value)}
          className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="Search reports"
          aria-label="Search reports"
        />
      </label>
      <select
        value={value.severity}
        onChange={(event) => update('severity', event.target.value as QueueFilterState['severity'])}
        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        aria-label="Filter by severity"
      >
        <option value="all">All severity</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select
        value={value.type}
        onChange={(event) => update('type', event.target.value as QueueFilterState['type'])}
        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        aria-label="Filter by report type"
      >
        <option value="all">All types</option>
        <option value="post">Posts</option>
        <option value="user">Users</option>
        <option value="message">Messages</option>
        <option value="comment">Comments</option>
      </select>
      <select
        value={value.status}
        onChange={(event) => update('status', event.target.value as QueueFilterState['status'])}
        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        aria-label="Filter by status"
      >
        <option value="all">All status</option>
        <option value="pending">Pending</option>
        <option value="reviewing">Reviewing</option>
        <option value="action_taken">Action Taken</option>
        <option value="resolved">Resolved</option>
        <option value="appeal">Appeal</option>
      </select>
      <select
        value={value.sort}
        onChange={(event) => update('sort', event.target.value as QueueFilterState['sort'])}
        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        aria-label="Sort reports"
      >
        <option value="priority">Priority</option>
        <option value="newest">Newest</option>
      </select>
    </div>
  )
}

