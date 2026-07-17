import { CheckCircle2 } from 'lucide-react'

import { QueueFilters, type QueueFilterState } from './QueueFilters'
import { ReportCard } from './ReportCard'
import type { ModerationReport } from './types'

type Props = {
  reports: ModerationReport[]
  filters: QueueFilterState
  onFiltersChange: (next: QueueFilterState) => void
}

export function ModerationQueue({ reports, filters, onFiltersChange }: Props) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="moderation-queue-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Review Queue</p>
          <h2 id="moderation-queue-title" className="text-lg font-black text-slate-950">
            Moderation queue
          </h2>
        </div>
        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-700">{reports.length} visible</span>
      </div>

      <QueueFilters value={filters} onChange={onFiltersChange} />

      {reports.length ? (
        <div className="mt-3 grid gap-3">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-700" aria-hidden="true" />
          <h3 className="mt-3 text-base font-black text-emerald-950">Không có báo cáo cần xử lý</h3>
          <p className="mt-1 text-sm text-emerald-800">Hệ thống đang ổn định, không có nội dung vi phạm mới trong bộ lọc hiện tại.</p>
        </div>
      )}
    </section>
  )
}

