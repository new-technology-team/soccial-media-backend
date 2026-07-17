'use client'

import ModeratorReportWorkspace from '../shared/moderation-workspace'

export default function ModeratorMessagesPage() {
  return (
    <ModeratorReportWorkspace
      title="Tin nhắn bị báo cáo"
      description="Quản lý báo cáo tin nhắn riêng, xem chi tiết và thực thi hành động thật trên target message."
      allowedTypes={['message']}
    />
  )
}
