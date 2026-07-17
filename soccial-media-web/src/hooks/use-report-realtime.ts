import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { connectSocket } from '@/services/socket'
import { toast } from '@/hooks/use-toast'
import type { User } from '@/types'

type ReportRow = Record<string, unknown>

const reportIdOf = (report: ReportRow | undefined | null) => String(report?.reportId || report?.id || '')

export function useReportRealtime({
  token,
  user,
  setReports,
}: {
  token: string | null
  user: User | null
  setReports: Dispatch<SetStateAction<ReportRow[]>>
}) {
  useEffect(() => {
    if (!token || !user?.id || (user.role !== 'admin' && user.role !== 'moderator')) return

    const socket = connectSocket(token, user.id)

    const upsertReport = (report: ReportRow) => {
      const id = reportIdOf(report)
      if (!id) return
      setReports((prev) => {
        const exists = prev.some((item) => reportIdOf(item) === id)
        if (!exists) return [report, ...prev]
        return prev.map((item) => (reportIdOf(item) === id ? { ...item, ...report } : item))
      })
    }

    const onCreated = (payload: { report?: ReportRow }) => {
      if (!payload?.report) return
      upsertReport(payload.report)
      toast({ title: 'Báo cáo mới', description: `Report #${reportIdOf(payload.report)} vừa được gửi.` })
    }

    const onUpdated = (payload: { report?: ReportRow }) => {
      if (!payload?.report) return
      upsertReport(payload.report)
      toast({ title: 'Báo cáo đã cập nhật', description: `Report #${reportIdOf(payload.report)} đã thay đổi trạng thái.` })
    }

    const onAssigned = (payload: { report?: ReportRow }) => {
      if (!payload?.report) return
      upsertReport(payload.report)
      toast({ title: 'Bạn được phân công báo cáo', description: `Report #${reportIdOf(payload.report)} đã được giao cho bạn.` })
    }

    socket.on('report:created', onCreated)
    socket.on('report:updated', onUpdated)
    socket.on('report:assigned', onAssigned)

    return () => {
      socket.off('report:created', onCreated)
      socket.off('report:updated', onUpdated)
      socket.off('report:assigned', onAssigned)
    }
  }, [setReports, token, user])
}
