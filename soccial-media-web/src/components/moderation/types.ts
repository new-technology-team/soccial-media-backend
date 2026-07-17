import type { LucideIcon } from 'lucide-react'

export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type QueueStatus = 'pending' | 'reviewing' | 'action_taken' | 'resolved' | 'appeal'
export type ReportType = 'post' | 'user' | 'message' | 'comment'

export type ModerationReport = {
  id: string
  type: ReportType
  status: QueueStatus
  severity: Severity
  priority: number
  reason: string
  aiScore: number
  createdAt: string
  subject: string
  reporter?: string
  assignee?: string
}

export type StatCard = {
  label: string
  value: number
  badge: string
  trend: string
  helper: string
  tone: 'pending' | 'reviewing' | 'resolved' | 'critical' | 'neutral'
  icon: LucideIcon
}

