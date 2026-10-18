export type ToastTone = 'success' | 'info' | 'warning' | 'error'

export type ToastItem = {
  id: number
  tone: ToastTone
  title: string
  message?: string
}

type Listener = () => void

/** Max 3 stacked (8:334); the oldest drops off first. */
const MAX_TOASTS = 3

let toasts: ToastItem[] = []
let nextId = 1
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((listener) => listener())
}

export const toastStore = {
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getSnapshot: () => toasts,
  dismiss(id: number) {
    toasts = toasts.filter((item) => item.id !== id)
    emit()
  },
}

/** Show a toast. Error toasts persist until dismissed; others auto-dismiss after 5 s. */
export function toast(input: Omit<ToastItem, 'id'>): number {
  const id = nextId++
  toasts = [...toasts, { ...input, id }].slice(-MAX_TOASTS)
  emit()
  return id
}
