'use client'

import ModeratorReportWorkspace from '../shared/moderation-workspace'

export default function ModeratorHistoryPage() {
  return (
    <ModeratorReportWorkspace
      title="Lịch sử xử lý"
      description="Danh sách báo cáo đã xử lý hoặc từ chối, dùng cho truy vết và audit nội bộ."
      defaultMode="history"
    />
  )
}
