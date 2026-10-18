import { useLayoutEffect, useRef, useState, type ComponentPropsWithRef, type ReactNode } from 'react'
import { Slot } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { icons, type IconName } from './icons'

export type ButtonVariant = 'brand' | 'primary' | 'secondary' | 'tertiary' | 'destructive'

type ButtonProps = ComponentPropsWithRef<'button'> & {
  /**
   * brand — the single key public discovery CTA per view.
   * primary — default primary action in forms and workspaces.
   * destructive — red fill; inside workspaces red always means destructive.
   */
  variant?: ButtonVariant
  /** Leading 16 px icon. */
  icon?: IconName
  /** Keeps width, sets aria-busy and blocks clicks. */
  loading?: boolean
  /** Render as the child element (e.g. a router <Link>). */
  asChild?: boolean
  children: ReactNode
}

const VARIANTS: Record<ButtonVariant, string> = {
  brand: 'bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-pressed',
  primary: 'bg-inverse text-on-inverse hover:bg-inverse-hover active:bg-inverse-hover',
  secondary:
    'border border-strong bg-surface text-primary hover:bg-subtle active:border-[var(--text-tertiary)] active:bg-subtle',
  tertiary: 'text-primary hover:bg-subtle active:bg-subtle',
  destructive:
    'bg-[var(--status-critical-fg)] text-on-brand hover:bg-brand-hover active:bg-brand-pressed',
}

/** Button (5:153): height 40 · padding 10/16 · radius 8 · gap 8. */
export function Button({
  variant = 'primary',
  icon,
  loading = false,
  disabled,
  asChild = false,
  className,
  children,
  onClick,
  ref,
  ...props
}: ButtonProps) {
  const { t } = useTranslation()
  const innerRef = useRef<HTMLButtonElement | null>(null)
  const [lockedWidth, setLockedWidth] = useState<number>()

  // Loading keeps the resting width so the layout never jumps (49:458).
  useLayoutEffect(() => {
    if (loading && innerRef.current) setLockedWidth(innerRef.current.offsetWidth)
    if (!loading) setLockedWidth(undefined)
  }, [loading])

  const Icon = icon ? icons[icon] : null
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      ref={(node: HTMLButtonElement | null) => {
        innerRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      type={asChild ? undefined : (props.type ?? 'button')}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={loading ? (event) => event.preventDefault() : onClick}
      style={lockedWidth ? { minWidth: lockedWidth } : undefined}
      className={cn(
        'type-label-m inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 transition-colors duration-150 max-lg:min-h-11',
        'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-subtle disabled:text-tertiary',
        VARIANTS[variant],
        loading && 'cursor-progress',
        className,
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? (
            <icons.loader aria-hidden size={16} className="animate-spin" />
          ) : (
            Icon && <Icon aria-hidden size={16} />
          )}
          {loading ? t('actions.loading') : children}
        </>
      )}
    </Comp>
  )
}
