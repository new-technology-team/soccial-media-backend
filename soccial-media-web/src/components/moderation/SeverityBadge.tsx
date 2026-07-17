import { AlertTriangle, CircleAlert, ShieldCheck, SignalMedium } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/utils'
import type { Severity } from './types'

const severityConfig: Record<Severity, { label: string; className: string; Icon: LucideIcon }> = {
  low: {
    label: 'Low',
    className: 'border-zinc-200 bg-zinc-100 text-zinc-700',
    Icon: ShieldCheck,
  },
  medium: {
    label: 'Medium',
    className: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    Icon: SignalMedium,
  },
  high: {
    label: 'High',
    className: 'border-orange-200 bg-orange-50 text-orange-800',
    Icon: AlertTriangle,
  },
  critical: {
    label: 'Critical',
    className: 'border-red-200 bg-red-50 text-red-800',
    Icon: CircleAlert,
  },
}

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const config = severityConfig[severity]
  const Icon = config.Icon

  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold', config.className, className)}
      aria-label={`Severity ${config.label}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {config.label}
    </span>
  )
}
