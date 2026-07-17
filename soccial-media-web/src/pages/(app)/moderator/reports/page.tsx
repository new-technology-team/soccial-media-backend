import { useSearchParams } from 'react-router-dom'
import ModeratorReportWorkspace from '../shared/moderation-workspace'

type ReportType = 'post' | 'comment' | 'message' | 'user'
const VALID_TYPES: ReportType[] = ['post', 'comment', 'message', 'user']

export default function ModeratorReportsPage() {
  const [searchParams] = useSearchParams()
  const typeParam = searchParams.get('type')
  const allowedTypes = typeParam && VALID_TYPES.includes(typeParam as ReportType)
    ? [typeParam as ReportType]
    : undefined

  return (
    <ModeratorReportWorkspace
      title={allowedTypes ? `Báo cáo — ${allowedTypes[0]}` : 'Tất cả báo cáo'}
      description="Xem báo cáo mới, mở chi tiết, thực thi hành động thật và đồng bộ trạng thái realtime."
      allowedTypes={allowedTypes}
    />
  )
}
