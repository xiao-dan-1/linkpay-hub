import {
  type PropsWithChildren,
  useEffect,
  useRef,
} from 'react'

export function ModalFrame({
  open,
  title,
  dismissible = true,
  onDismiss,
  children,
}: PropsWithChildren<{
  open: boolean
  title: string
  dismissible?: boolean
  onDismiss: () => void
}>) {
  const modalRef = useRef<HTMLElement | null>(null)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => {
      modalRef.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, button')?.focus()
    })
    const onKeyDown = (event: KeyboardEvent) => {
      if (dismissible && event.key === 'Escape') onDismissRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [dismissible, open])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onDismissRef.current()
      }}
    >
      <section ref={modalRef} className="modal key-modal" role="dialog" aria-modal="true" aria-label={title}>
        {children}
      </section>
    </div>
  )
}
