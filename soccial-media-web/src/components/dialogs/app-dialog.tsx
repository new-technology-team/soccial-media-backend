import { X } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/utils'
import styles from './dialogs.module.css'

type AppDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  eyebrow?: string
  children: ReactNode
  footer?: ReactNode
  icon?: ReactNode
  variant?: 'dialog' | 'sheet'
}

export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  eyebrow,
  children,
  footer,
  icon,
  variant = 'dialog',
}: AppDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content className={cn(styles.content, variant === 'sheet' && styles.sheet)}>
          <div className={styles.panel}>
            <div className={styles.header}>
              {icon}
              {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
              <DialogPrimitive.Title className={styles.title}>{title}</DialogPrimitive.Title>
              {description ? <DialogPrimitive.Description className={styles.description}>{description}</DialogPrimitive.Description> : null}
            </div>
            <div className={styles.body}>{children}</div>
            {footer ? <div className={styles.footer}>{footer}</div> : null}
          </div>
          <DialogPrimitive.Close className={styles.close} aria-label="Đóng">
            <X size={17} />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function DialogButton({
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'destructive' }) {
  return <button className={cn(styles.button, styles[variant])} {...props} />
}

export function DialogIdentity({
  name,
  subtitle,
  avatarUrl,
}: {
  name: string
  subtitle?: string
  avatarUrl?: string | null
}) {
  return (
    <div className={styles.identity}>
      <span className={styles.avatar}>{avatarUrl ? <img src={avatarUrl} alt={name} /> : (name[0] || 'Z').toUpperCase()}</span>
      <span className={styles.identityText}>
        <b>{name}</b>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
    </div>
  )
}
