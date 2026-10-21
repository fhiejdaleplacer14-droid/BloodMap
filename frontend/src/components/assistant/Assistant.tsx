import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ASSISTANT_MAX_CHARS, useAskAssistant, type AssistantAnswer } from '../../lib/api/assistant'
import { errorStatus } from '../../lib/api/client'
import { cn } from '../../lib/cn'
import { useMinWidth } from '../../lib/hooks'
import { IconButton } from '../ui/IconButton'
import { icons } from '../ui/icons'

const HelpChat = icons['help-chat']
const FileText = icons['file-text']
const WifiOff = icons['wifi-off']
const ExternalLink = icons['external-link']

type Turn =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'guide'; answer: AssistantAnswer }
  | { id: number; role: 'error'; question: string; rateLimited: boolean }

/**
 * BloodMap guide (04 · Assistant, 42:3779 → 42:5922; mobile 44:1138).
 * Launcher: ink, fixed bottom-right with a 24 px inset; aria-expanded
 * toggles the guide. From 768 px it is a floating panel that leaves the page
 * usable; below that a 90 % bottom sheet (54:347). The conversation lives in
 * memory only and is cleared on reload.
 */
export function Assistant({ raised = false, hidden = false }: { raised?: boolean; hidden?: boolean }) {
  const { t } = useTranslation('assistant')
  const floating = useMinWidth('md')
  const [open, setOpen] = useState(false)
  const launcherRef = useRef<HTMLButtonElement>(null)

  const launcher = (
    <button
      ref={launcherRef}
      type="button"
      aria-expanded={open}
      aria-controls={open ? 'assistant-panel' : undefined}
      onClick={() => setOpen((value) => !value)}
      className={cn(
        'type-label-m fixed right-6 bottom-6 z-1100 flex items-center gap-2 rounded-lg bg-inverse py-3 pr-4 pl-3 text-on-inverse shadow-floating hover:opacity-90',
        // Above the Bottom Nav (81 px) below 1024 px (12:927).
        raised && 'max-lg:bottom-24',
      )}
    >
      {open ? <icons.x aria-hidden size={20} /> : <HelpChat aria-hidden size={20} />}
      {open ? t('launcher.close') : t('launcher.open')}
    </button>
  )

  const close = () => {
    setOpen(false)
    launcherRef.current?.focus()
  }

  if (hidden) return null

  if (floating) {
    return (
      <>
        {open && (
          <section
            id="assistant-panel"
            role="dialog"
            aria-modal="false"
            aria-labelledby="assistant-title"
            onKeyDown={(event) => event.key === 'Escape' && close()}
            className={cn(
              'fixed right-6 z-1100 flex h-[min(620px,calc(100dvh-160px))] w-100 max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-2xl border border-default bg-surface shadow-overlay',
              raised ? 'bottom-22 max-lg:bottom-40' : 'bottom-22',
            )}
          >
            <Conversation onClose={close} titleId="assistant-title" />
          </section>
        )}
        {launcher}
      </>
    )
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {launcher}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-1200 bg-overlay/48" />
        <Dialog.Content
          id="assistant-panel"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            launcherRef.current?.focus()
          }}
          className="fixed inset-x-0 bottom-0 z-1200 flex h-[90dvh] flex-col overflow-hidden rounded-t-2xl bg-surface shadow-overlay"
        >
          <div aria-hidden className="flex justify-center pt-2">
            <span className="h-1 w-9 rounded-full bg-(--border-strong)" />
          </div>
          <Conversation onClose={() => setOpen(false)} titleId="assistant-title" asDialog />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Conversation({ onClose, titleId, asDialog = false }: { onClose: () => void; titleId: string; asDialog?: boolean }) {
  const { t } = useTranslation('assistant')
  const ask = useAskAssistant()
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [nextId, setNextId] = useState(1)
  const inputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputId = useId()
  const tooLong = draft.length > ASSISTANT_MAX_CHARS

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [turns, ask.isPending])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const send = (question: string, replaceErrorId?: number) => {
    const text = question.trim()
    if (!text || ask.isPending || text.length > ASSISTANT_MAX_CHARS) return
    let id = nextId
    const base = replaceErrorId ? turns.filter((turn) => turn.id !== replaceErrorId) : [...turns, { id: id++, role: 'user' as const, text }]
    setTurns(base)
    setDraft('')
    ask.mutate(text, {
      onSuccess: (answer) => setTurns((current) => [...current, { id: id, role: 'guide', answer }]),
      onError: (error) =>
        setTurns((current) => [...current, { id: id, role: 'error', question: text, rateLimited: errorStatus(error) === 429 }]),
      onSettled: () => inputRef.current?.focus(),
    })
    setNextId(id + 1)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    send(draft)
  }

  const Title = asDialog ? Dialog.Title : 'h2'
  const closeButton = <IconButton icon="x" label={t('close')} onClick={asDialog ? undefined : onClose} />

  return (
    <>
      <header className="flex items-center gap-2.5 border-b border-default py-3 pr-2 pl-4">
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-md bg-inverse text-on-inverse">
          <HelpChat size={16} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <Title {...(asDialog ? {} : { id: titleId })} className="type-label-m text-primary">
            {t('title')}
          </Title>
          <p className="type-body-s truncate text-tertiary">{t('subtitle')}</p>
        </div>
        <IconButton
          icon="trash"
          label={t('clear')}
          disabled={turns.length === 0 || ask.isPending}
          onClick={() => {
            setTurns([])
            inputRef.current?.focus()
          }}
        />
        {asDialog ? <Dialog.Close asChild>{closeButton}</Dialog.Close> : closeButton}
      </header>

      <div role="log" aria-live="polite" aria-label={t('conversation')} className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {turns.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="type-body-m text-primary">{t('greeting')}</p>
            <p className="type-body-s text-secondary">{t('limits')}</p>
            <h3 className="type-overline mt-1 text-tertiary">{t('tryAsking')}</h3>
            <Suggestions items={t('suggestions', { returnObjects: true }) as string[]} onPick={send} />
          </div>
        ) : (
          turns.map((turn) => {
            if (turn.role === 'user') {
              return (
                <div key={turn.id} className="flex justify-end">
                  <p className="type-body-m max-w-[85%] rounded-lg rounded-tr-xs bg-inverse px-3.5 py-2.5 break-words text-on-inverse">
                    <span className="sr-only">{t('you')}: </span>
                    {turn.text}
                  </p>
                </div>
              )
            }
            if (turn.role === 'error') {
              return (
                <div key={turn.id} role="alert" className="flex flex-col gap-2 rounded-lg bg-status-critical px-4 py-3 text-status-critical">
                  <p className="type-label-m flex items-center gap-2">
                    <WifiOff aria-hidden size={16} />
                    {t('error.title')}
                  </p>
                  <p className="type-body-s">{turn.rateLimited ? t('error.rateLimited') : t('error.body')}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => send(turn.question, turn.id)}
                      disabled={ask.isPending}
                      className="type-label-m inline-flex h-9 items-center gap-1.5 rounded-md border border-strong bg-surface px-3 text-primary hover:bg-subtle"
                    >
                      <icons.refresh aria-hidden size={16} />
                      {t('error.retry')}
                    </button>
                    <Link to="/#safety" className="type-label-m inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-primary hover:underline">
                      <ExternalLink aria-hidden size={16} />
                      {t('error.open')}
                    </Link>
                  </div>
                </div>
              )
            }
            const { answer } = turn
            const source = answer.sources[0]
            return (
              <div key={turn.id} className="flex flex-col gap-3">
                {answer.safety_note && (
                  <p className="type-body-s flex gap-2 rounded-lg bg-status-info px-3 py-2.5 text-status-info">
                    <icons.info aria-hidden size={16} className="mt-0.5 shrink-0" />
                    {answer.safety_note}
                  </p>
                )}
                <div className="flex flex-col gap-1.5">
                  <p className="type-label-s flex items-center gap-1.5 text-secondary">
                    <HelpChat aria-hidden size={14} />
                    {t(answer.generated ? 'labelGenerated' : 'label')}
                  </p>
                  <div className="flex flex-col gap-2.5 rounded-lg rounded-tl-xs border border-default bg-surface px-3.5 py-3">
                    <p className="type-body-m whitespace-pre-line text-primary">{answer.answer}</p>
                    {source && (
                      <Link
                        to={source.path}
                        className="type-label-s inline-flex w-fit items-center gap-1.5 rounded-sm bg-subtle px-2 py-1 text-secondary hover:text-primary"
                      >
                        <FileText aria-hidden size={12} />
                        {t('source', { title: source.title })}
                      </Link>
                    )}
                  </div>
                </div>
                {(answer.suggestions.length > 0 || answer.safety_note) && (
                  <Suggestions items={answer.suggestions} onPick={send}>
                    {answer.safety_note && source && (
                      <Link
                        to={source.path}
                        className="type-label-m flex min-h-10 items-center rounded-md border border-default bg-surface px-3 text-primary hover:border-strong"
                      >
                        {t('openSource', { title: source.title.toLowerCase() })}
                      </Link>
                    )}
                  </Suggestions>
                )}
              </div>
            )
          })
        )}
        {ask.isPending && (
          <div aria-busy="true" className="flex flex-col gap-2">
            <span className="flex w-fit gap-1 rounded-lg border border-default px-3 py-2">
              {[0, 1, 2].map((dot) => (
                <span key={dot} aria-hidden className="size-1.5 animate-pulse rounded-full bg-(--text-tertiary)" style={{ animationDelay: `${dot * 150}ms` }} />
              ))}
            </span>
            <p className="type-body-s text-tertiary">{t('searching')}</p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2 border-t border-default px-4 py-3">
        <div className="flex items-center gap-2">
          <label htmlFor={inputId} className="sr-only">
            {t('inputLabel')}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            readOnly={ask.isPending}
            aria-busy={ask.isPending || undefined}
            placeholder={ask.isPending ? t('waiting') : t('placeholder')}
            aria-invalid={tooLong || undefined}
            aria-describedby={tooLong ? `${inputId}-error` : `${inputId}-disclaimer`}
            autoComplete="off"
            className={cn(
              'type-body-m h-10 min-w-0 flex-1 rounded-md border bg-surface px-3 text-primary outline-none placeholder:text-tertiary focus:border-2 focus:border-focus focus:px-2.75 focus:shadow-focus read-only:bg-subtle',
              tooLong ? 'border-status-critical' : 'border-strong',
            )}
          />
          <button
            type="submit"
            aria-label={t('send')}
            disabled={!draft.trim() || ask.isPending || tooLong}
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-inverse text-on-inverse disabled:bg-(--border-strong)"
          >
            <icons.send aria-hidden size={16} />
          </button>
        </div>
        {tooLong && (
          <p id={`${inputId}-error`} className="type-body-s text-status-critical">
            {t('tooLong', { max: ASSISTANT_MAX_CHARS })}
          </p>
        )}
        <p id={`${inputId}-disclaimer`} className="type-body-s flex gap-1.5 text-tertiary">
          <icons.info aria-hidden size={12} className="mt-1 shrink-0" />
          {t('disclaimer')}
        </p>
      </form>
    </>
  )
}

function Suggestions({ items, onPick, children }: { items: string[]; onPick: (question: string) => void; children?: ReactNode }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((question) => (
        <li key={question}>
          <button
            type="button"
            onClick={() => onPick(question)}
            className="type-label-m flex min-h-10 w-full items-center rounded-md border border-default bg-surface px-3 text-left text-primary hover:border-strong"
          >
            {question}
          </button>
        </li>
      ))}
      {children && <li>{children}</li>}
    </ul>
  )
}
