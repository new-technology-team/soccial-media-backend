'use client'

import ModeratorReportWorkspace from '../shared/moderation-workspace'

export default function ModeratorCommentsPage() {
  return (
    <ModeratorReportWorkspace
      title="Bình luận bị báo cáo"
      description="Theo dõi báo cáo bình luận, mở chi tiết, và thực thi đúng vào bình luận bị vi phạm."
      allowedTypes={['comment']}
    />
  )
}
