'use client'

import { useParams } from 'react-router-dom'

import ModeratorReportWorkspace from '../../shared/moderation-workspace'

export default function ModeratorReportDetailPage() {
  const params = useParams()
  const reportId = Number(params.id || 0)

  return (
    <ModeratorReportWorkspace
      title="Chi tiết báo cáo"
      description="Mở đúng report để kiểm tra nội dung, xem lịch sử và thực thi hành động kiểm duyệt phù hợp."
      initialReportId={reportId || null}
    />
  )
}
