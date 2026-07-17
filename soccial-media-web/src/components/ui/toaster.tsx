'use client'

import { useToast } from '@/hooks/use-toast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'
import { cn } from '@/utils'
import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from 'lucide-react'

const icons = {
  success: { icon: <CheckCircle2 className="h-4 w-4" />, tone: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  error: { icon: <AlertCircle className="h-4 w-4" />, tone: 'bg-rose-100 text-rose-700 ring-rose-200' },
  warning: { icon: <TriangleAlert className="h-4 w-4" />, tone: 'bg-amber-100 text-amber-700 ring-amber-200' },
  info: { icon: <Info className="h-4 w-4" />, tone: 'bg-sky-100 text-sky-700 ring-sky-200' },
  loading: { icon: <Loader2 className="h-4 w-4 animate-spin" />, tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider duration={4000} swipeDirection="right">
      {toasts.map(function ({ id, title, description, action, type, variant, ...props }) {
        const toastType =
          type ||
          (variant === 'success'
            ? 'success'
            : variant === 'destructive'
              ? 'error'
              : variant === 'warning'
                ? 'warning'
                : variant === 'loading'
                  ? 'loading'
                  : 'info')
        const tone = icons[toastType]
        return (
          <Toast key={id} variant={variant || toastType} {...props}>
            <div className={cn('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1', tone.tone)}>
              {tone.icon}
            </div>
            <div className="grid min-w-0 gap-1 pr-2">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
