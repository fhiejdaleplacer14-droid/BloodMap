import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BloodTypeTag } from '../../components/domain/BloodTypeTag'
import { Freshness } from '../../components/domain/Freshness'
import { Logo } from '../../components/domain/Logo'
import { RequestCard } from '../../components/domain/RequestCard'
import { RequestTable, type RequestRow } from '../../components/domain/RequestTable'
import { SkeletonRequestCard } from '../../components/domain/SkeletonRequestCard'
import { StatusBadge } from '../../components/domain/StatusBadge'
import { UrgencyTag } from '../../components/domain/UrgencyTag'
import { AppSidebar } from '../../components/layout/AppSidebar'
import { BottomNav } from '../../components/layout/BottomNav'
import { MobileTopBar } from '../../components/layout/MobileTopBar'
import { PublicHeader } from '../../components/layout/PublicHeader'
import { Avatar } from '../../components/ui/Avatar'
import { Button, type ButtonVariant } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Checkbox'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { DateField, TimeField } from '../../components/ui/DateTimeField'
import { EmptyState } from '../../components/ui/EmptyState'
import { FilterChip } from '../../components/ui/FilterChip'
import { IconButton } from '../../components/ui/IconButton'
import { Pagination } from '../../components/ui/Pagination'
import { RadioGroup } from '../../components/ui/RadioGroup'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { SelectField } from '../../components/ui/SelectField'
import { Switch } from '../../components/ui/Switch'
import { Tab, Tabs, TabsList } from '../../components/ui/Tabs'
import { TextField } from '../../components/ui/TextField'
import { toast, type ToastTone } from '../../components/ui/toast'
import { Tooltip } from '../../components/ui/Tooltip'
import { formatDate, formatTime } from '../../lib/datetime'
import { BLOOD_TYPES, REQUEST_STATUSES, URGENCIES, displayBloodType, type PublicRequest } from '../../lib/request'
import type { resources } from '../../i18n/resources'
import { DevThemeSwitch } from './DevThemeSwitch'

type SampleKey = keyof (typeof resources)['en']['dev']['components']['sample']

/** Fixed clock so relative times match the Figma frames ("Updated 2 h ago"). */
const NOW = new Date('2026-10-15T07:40:00Z')

const BASE: PublicRequest = {
  id: 'BM-2026-0012',
  blood_type: 'O+',
  units_requested: 2,
  needed_by: '2026-10-18',
  urgency: 'within_72h',
  status: 'active',
  location: { municipality: 'San Carlos City', province: 'Negros Occidental', point: [123.42, 10.48], precision: 'municipality' },
  coordination_point: { id: 7, name: 'San Carlos Blood Services Desk (demo)', hours: 'Mon–Sat 08:00–17:00' },
  contact: null,
  public_summary: '',
  published_at: '2026-10-15T01:02:00Z',
  updated_at: '2026-10-15T05:40:00Z',
  expires_at: '2026-10-18T09:00:00Z',
  is_demo: true,
  can: { save: true, report: true },
}

const ROWS: RequestRow[] = [
  { id: 'BM-2026-0012', blood_type: 'O+', municipality: 'San Carlos City', created_at: '2026-10-15T01:02:00Z', expires_at: '2026-10-18T09:00:00Z', status: 'pending_review', updated_at: '2026-10-15T05:40:00Z' },
  { id: 'BM-2026-0019', blood_type: 'A-', municipality: 'Dumaguete City', created_at: '2026-10-14T03:00:00Z', expires_at: '2026-10-16T01:00:00Z', status: 'active', updated_at: '2026-10-15T07:00:00Z' },
  { id: 'BM-2026-0004', blood_type: 'AB-', municipality: 'Kabankalan City', created_at: '2026-10-10T02:00:00Z', expires_at: null, status: 'closed', updated_at: '2026-10-13T04:00:00Z' },
]

const BUTTON_VARIANTS: ButtonVariant[] = ['brand', 'primary', 'secondary', 'tertiary', 'destructive']
const TOASTS: ToastTone[] = ['success', 'info', 'warning', 'error']

function Showcase({ id, title, nodes, children }: { id: string; title: string; nodes: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <h2 id={`${id}-title`} className="type-h2 text-primary">
          {title}
        </h2>
        <span className="type-mono-s text-tertiary">{nodes}</span>
      </div>
      <div className="flex flex-col gap-6 rounded-lg border border-default bg-surface p-6">{children}</div>
    </section>
  )
}

function Row({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-4 ${className}`}>{children}</div>
}

export function ComponentsPage() {
  const { t, i18n } = useTranslation('dev')
  const { t: tn } = useTranslation('nav')
  const { t: ts } = useTranslation('states')
  const { t: tc } = useTranslation()
  const { t: tr } = useTranslation('request')
  const s = (key: SampleKey, options?: Record<string, unknown>) => t(`components.sample.${key}`, options)

  const [checked, setChecked] = useState<boolean | 'indeterminate'>(true)
  const [radio, setRadio] = useState('on')
  const [switchOn, setSwitchOn] = useState(true)
  const [pressed, setPressed] = useState<string[]>(['O+'])
  const [applied, setApplied] = useState(['Type O+', 'Type O−', 'San Carlos City'])
  const [view, setView] = useState<'list' | 'map'>('list')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<'close' | 'correction' | 'approve' | null>(null)
  const [selectedRow, setSelectedRow] = useState('BM-2026-0012')

  const cards: Array<{ request: PublicRequest; selected?: boolean }> = [
    { request: { ...BASE, public_summary: s('summary1') } },
    {
      request: {
        ...BASE,
        id: 'BM-2026-0019',
        blood_type: 'A-',
        urgency: 'within_24h',
        location: { ...BASE.location, municipality: 'Dumaguete City', province: 'Negros Oriental' },
        public_summary: s('summary2'),
        updated_at: '2026-10-15T07:00:00Z',
        expires_at: '2026-10-16T01:00:00Z',
      },
    },
    { request: { ...BASE, public_summary: s('summary1') }, selected: true },
    {
      request: {
        ...BASE,
        id: 'BM-2026-0007',
        blood_type: 'B+',
        status: 'expired',
        location: { ...BASE.location, municipality: 'Bacolod City' },
        updated_at: '2026-10-12T04:00:00Z',
        expires_at: '2026-10-14T09:00:00Z',
      },
    },
    {
      request: {
        ...BASE,
        id: 'BM-2026-0004',
        blood_type: 'AB-',
        status: 'closed',
        location: { ...BASE.location, municipality: 'Kabankalan City' },
        updated_at: '2026-10-13T04:00:00Z',
      },
    },
  ]

  const sections = Object.entries(t('components.sections', { returnObjects: true }) as Record<string, string>)

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-10 p-8 lg:p-16">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <p className="type-overline text-tertiary">03 — Components</p>
          <h1 className="type-display-48 text-primary">{t('components.title')}</h1>
          <p className="type-body-l max-w-[1000px] text-secondary">{t('components.intro')}</p>
        </div>
        <DevThemeSwitch />
      </header>

      <nav aria-label={t('components.nav')}>
        <ul className="flex flex-wrap gap-2">
          {sections.map(([key, label]) => (
            <li key={key}>
              <a href={`#${key}`} className="type-label-s rounded-sm bg-subtle px-2 py-1 text-secondary hover:text-primary">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="flex flex-col gap-12">
        <Showcase id="buttons" title={t('components.sections.buttons')} nodes="5:153 · 6:501">
          {BUTTON_VARIANTS.map((variant) => (
            <Row key={variant}>
              <span className="type-mono-s w-24 text-tertiary">{variant}</span>
              <Button variant={variant} icon={variant === 'destructive' ? 'trash' : undefined}>
                {variant === 'destructive' ? s('closeRequest') : s('button')}
              </Button>
              <Button variant={variant} icon={variant === 'destructive' ? 'trash' : undefined} disabled>
                {variant === 'destructive' ? s('closeRequest') : s('button')}
              </Button>
              <Button variant={variant} loading>
                {s('button')}
              </Button>
            </Row>
          ))}
          <Row>
            <span className="type-mono-s w-24 text-tertiary">icon button</span>
            <IconButton icon="more" label={tc('actions.more')} />
            <IconButton icon="more" label={tc('actions.more')} disabled />
            <IconButton icon="more" label={tc('actions.more')} variant="outline" />
            <IconButton icon="more" label={tc('actions.more')} variant="outline" disabled />
          </Row>
        </Showcase>

        <Showcase id="status" title={t('components.sections.status')} nodes="5:202 · 5:222 · 5:264">
          <Row>
            {REQUEST_STATUSES.map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </Row>
          <Row>
            {URGENCIES.map((urgency) => (
              <UrgencyTag key={urgency} urgency={urgency} />
            ))}
          </Row>
          <Row>
            {BLOOD_TYPES.map((type) => (
              <BloodTypeTag key={type} type={type} />
            ))}
          </Row>
          <Row>
            {BLOOD_TYPES.map((type) => (
              <BloodTypeTag key={type} type={type} size="sm" />
            ))}
          </Row>
        </Showcase>

        <Showcase id="fields" title={t('components.sections.fields')} nodes="6:220 · 6:374">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <TextField label={s('email')} type="email" placeholder={s('emailPlaceholder')} helperText={s('emailHelper')} />
            <TextField label={s('email')} type="email" defaultValue="demo.donor@example.org" helperText={s('emailHelper')} />
            <TextField label={s('email')} type="email" defaultValue="demo.donor@example.org" error={s('emailError')} />
            <TextField label={s('email')} type="email" placeholder={s('emailPlaceholder')} helperText={s('emailHelper')} disabled />
            <TextField label={s('password')} type="password" placeholder={s('passwordPlaceholder')} helperText={s('passwordHelper')} autoComplete="new-password" />
            <TextField label={s('password')} type="password" defaultValue="correct-horse-1" helperText={s('passwordHelper')} autoComplete="new-password" />
            <TextField label={s('search')} type="search" placeholder={s('searchPlaceholder')} helperText={s('searchHelper')} />
            <TextField label={s('search')} type="search" defaultValue="San Carlos City" helperText={s('searchHelper')} />
            <SelectField label={s('bloodType')} placeholder={s('anyBloodType')} helperText={tc('field.optional')} defaultValue="">
              {BLOOD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {displayBloodType(type)}
                </option>
              ))}
            </SelectField>
            <SelectField label={s('bloodType')} placeholder={s('anyBloodType')} error={s('selectError')} defaultValue="O+">
              {BLOOD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {displayBloodType(type)}
                </option>
              ))}
            </SelectField>
            <DateField label={s('neededBy')} helperText={s('neededByHelper')} defaultValue="2026-10-18" />
            <TimeField label={s('timeWindow')} helperText={tc('field.optional')} defaultValue="08:00" />
          </div>
        </Showcase>

        <Showcase id="choice" title={t('components.sections.choice')} nodes="6:433 · 6:459">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-3">
              <Checkbox label={s('privacy')} checked={checked} onCheckedChange={setChecked} />
              <Checkbox label={s('privacy')} checked="indeterminate" />
              <Checkbox label={s('privacy')} />
              <Checkbox label={s('privacy')} checked disabled />
            </div>
            <RadioGroup
              label={s('radioGroup')}
              value={radio}
              onValueChange={setRadio}
              options={[
                { value: 'on', label: s('privacy') },
                { value: 'off', label: s('privacy') },
                { value: 'disabled', label: s('privacy'), disabled: true },
              ]}
            />
            <div className="flex flex-col gap-3">
              <Switch label={s('emailMe')} checked={switchOn} onCheckedChange={setSwitchOn} />
              <Switch label={s('emailMe')} />
              <Switch label={s('emailMe')} checked disabled />
            </div>
          </div>
        </Showcase>

        <Showcase id="chips" title={t('components.sections.chips')} nodes="5:281">
          <Row>
            {BLOOD_TYPES.map((type) => (
              <FilterChip
                key={type}
                label={displayBloodType(type)}
                pressed={pressed.includes(type)}
                onPressedChange={(on) => setPressed((list) => (on ? [...list, type] : list.filter((x) => x !== type)))}
              />
            ))}
          </Row>
          <Row>
            {applied.map((label) => (
              <FilterChip key={label} label={label} onRemove={() => setApplied((list) => list.filter((x) => x !== label))} />
            ))}
          </Row>
        </Showcase>

        <Showcase id="navigation" title={t('components.sections.navigation')} nodes="8:185 · 8:202 · 8:204">
          <Tabs defaultValue="queue">
            <TabsList>
              <Tab value="queue" count={12}>
                {s('reviewQueue')}
              </Tab>
              <Tab value="other" count={3}>
                {s('reviewQueue')}
              </Tab>
            </TabsList>
          </Tabs>
          <SegmentedControl
            label={s('viewLabel')}
            value={view}
            onValueChange={setView}
            segments={[
              { value: 'list', label: s('list'), icon: 'list' },
              { value: 'map', label: s('map'), icon: 'map' },
            ]}
          />
          <Pagination meta={{ current_page: page, last_page: 5, per_page: 10, total: 42 }} onPageChange={setPage} />
        </Showcase>

        <Showcase id="feedback" title={t('components.sections.feedback')} nodes="8:282 · 8:280 · 8:334 · 8:345">
          <Row>
            <Tooltip content={s('tooltip')}>
              <Button variant="secondary">{s('tooltip')}</Button>
            </Tooltip>
            <Avatar initials="DU" size="sm" />
            <Avatar initials="DU" size="md" />
            <Avatar initials="DU" size="lg" />
          </Row>
          <Row>
            {TOASTS.map((tone) => (
              <Button
                key={tone}
                variant="secondary"
                onClick={() => toast({ tone, title: s('toastTitle'), message: s('toastMessage') })}
              >
                {s('showToast', { tone })}
              </Button>
            ))}
          </Row>
          <Row>
            <Freshness updatedAt="2026-10-15T05:40:00Z" now={NOW} />
            <Freshness updatedAt="2026-10-14T05:40:00Z" now={NOW} />
            <Freshness updatedAt="2026-10-11T05:40:00Z" now={NOW} />
          </Row>
        </Showcase>

        <Showcase id="dialogs" title={t('components.sections.dialogs')} nodes="10:464">
          <Row>
            <Button variant="secondary" onClick={() => setDialog('close')}>
              {s('openDialog', { name: s('closeRequest') })}
            </Button>
            <Button variant="secondary" onClick={() => setDialog('correction')}>
              {s('openDialog', { name: s('sendForCorrection') })}
            </Button>
            <Button variant="secondary" onClick={() => setDialog('approve')}>
              {s('openDialog', { name: s('approve') })}
            </Button>
          </Row>
          <ConfirmDialog
            open={dialog === 'close'}
            onOpenChange={(open) => !open && setDialog(null)}
            tone="critical"
            icon="lock"
            title={s('closeTitle')}
            description={s('closeBody')}
            confirmLabel={s('closeRequest')}
            confirmVariant="destructive"
            confirmIcon="trash"
            onConfirm={() => setDialog(null)}
          />
          <ConfirmDialog
            open={dialog === 'correction'}
            onOpenChange={(open) => !open && setDialog(null)}
            tone="warning"
            icon="pencil"
            title={s('correctionTitle')}
            description={s('correctionBody')}
            confirmLabel={s('sendForCorrection')}
            requireReason={{
              label: s('correctionLabel'),
              placeholder: s('correctionPlaceholder'),
              helperText: s('correctionHelper'),
              requiredMessage: s('correctionRequired'),
            }}
            onConfirm={() => setDialog(null)}
          />
          <ConfirmDialog
            open={dialog === 'approve'}
            onOpenChange={(open) => !open && setDialog(null)}
            tone="success"
            icon="check-circle"
            title={s('approveTitle')}
            description={s('approveBody')}
            confirmLabel={s('approve')}
            onConfirm={() => setDialog(null)}
          />
        </Showcase>

        <Showcase id="states" title={t('components.sections.states')} nodes="10:545 · 10:547">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <EmptyState icon="search" title={ts('noResults.title')} description={ts('noResults.body')} actions={<Button variant="secondary">{ts('noResults.action')}</Button>} />
            <EmptyState icon="bookmark" title={ts('noSaved.title')} description={ts('noSaved.body')} actions={<Button>{ts('noSaved.action')}</Button>} />
            <EmptyState icon="wifi-off" tone="critical" title={ts('networkError.title')} description={ts('networkError.body')} actions={<Button>{ts('networkError.action')}</Button>} />
            <EmptyState
              icon="map"
              tone="warning"
              title={ts('mapUnavailable.title')}
              description={ts('mapUnavailable.body')}
              actions={
                <>
                  <Button variant="secondary">{ts('mapUnavailable.listOnly')}</Button>
                  <Button variant="tertiary">{ts('mapUnavailable.retry')}</Button>
                </>
              }
            />
            <EmptyState
              icon="hourglass"
              title={ts('requestUnavailable.title')}
              description={ts('requestUnavailable.body', {
                date: formatDate('2026-10-14T09:00:00Z', i18n.language),
                time: formatTime('2026-10-14T09:00:00Z', i18n.language),
              })}
              actions={<Button>{ts('requestUnavailable.action')}</Button>}
            />
          </div>
          <div aria-busy="true" className="max-w-[392px]">
            <SkeletonRequestCard />
          </div>
        </Showcase>

        <Showcase id="cards" title={t('components.sections.cards')} nodes="9:487">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map(({ request, selected }) => (
              <RequestCard key={`${request.id}-${selected}`} request={request} to={`/dev/components#cards`} selected={selected} now={NOW} />
            ))}
          </div>
        </Showcase>

        <Showcase id="table" title={t('components.sections.table')} nodes="9:489 · 9:585">
          <RequestTable
            caption={s('tableCaption')}
            rows={ROWS}
            now={NOW}
            selectedId={selectedRow}
            onRowClick={setSelectedRow}
            renderActions={(row) => <IconButton icon="more" label={tr('table.rowActions', { id: row.id })} className="size-8" />}
          />
        </Showcase>

        <Showcase id="brand" title={t('components.sections.brand')} nodes="10:383">
          <Row>
            <Logo />
            <span className="rounded-lg bg-inverse px-5 py-4">
              <Logo tone="inverse" />
            </span>
            <Logo tone="mono" />
            <Logo variant="mark" />
            <Logo variant="tile" />
            <Logo size="sm" />
          </Row>
        </Showcase>

        <Showcase id="shell" title={t('components.sections.shell')} nodes="12:512 · 12:582 · 12:908 · 8:272">
          <div className="overflow-hidden rounded-lg border border-default">
            <PublicHeader
              links={[
                { to: '/dev/components', label: tn('public.findRequests') },
                { to: '/dev/how-it-works', label: tn('public.howItWorks') },
                { to: '/dev/safety', label: tn('public.safety') },
                { to: '/dev/about', label: tn('public.about') },
              ]}
              actions={
                <>
                  <Button variant="tertiary">{tn('public.logIn')}</Button>
                  <Button variant="brand" icon="search">
                    {tn('public.findARequest')}
                  </Button>
                </>
              }
            />
          </div>
          <div className="flex flex-wrap items-start gap-6">
            <div className="w-[390px] overflow-hidden rounded-lg border border-default">
              <MobileTopBar actions={<IconButton icon="menu" label={tc('actions.menu')} tooltip={false} />} />
            </div>
            <div className="w-[390px] overflow-hidden rounded-lg border border-default">
              <MobileTopBar
                variant="back"
                title={s('requestDetails')}
                onBack={() => undefined}
                actions={
                  <>
                    <IconButton icon="bookmark" label={tc('actions.save')} tooltip={false} />
                    <IconButton icon="more" label={tc('actions.more')} tooltip={false} />
                  </>
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-6">
            <div className="h-[640px] overflow-hidden rounded-lg border border-default">
              <AppSidebar
                roleLabel={tn('role.donor')}
                roleIcon="user"
                items={[
                  { to: '/dev/components', label: s('overview'), icon: 'home', end: true },
                  { to: '/dev/explore', label: s('explore'), icon: 'search' },
                  { to: '/dev/saved', label: s('saved'), icon: 'bookmark', count: 3 },
                  { to: '/dev/activity', label: s('activity'), icon: 'activity' },
                  { to: '/dev/notifications', label: s('notifications'), icon: 'bell', count: 2 },
                  { to: '/dev/profile', label: s('profile'), icon: 'user' },
                ]}
                helpItem={{ to: '/dev/help', label: tn('sidebar.help'), icon: 'help-chat' }}
                user={{ name: s('account'), email: 'juan.demo@example.org', initials: 'JD' }}
                onSignOut={() => undefined}
              />
            </div>
            <div className="w-[390px] overflow-hidden rounded-lg border border-default">
              <BottomNav
                items={[
                  { to: '/dev/components', label: s('homeShort'), icon: 'home', end: true },
                  { to: '/dev/explore', label: s('exploreShort'), icon: 'search' },
                  { to: '/dev/saved', label: s('savedShort'), icon: 'bookmark' },
                  { to: '/dev/alerts', label: s('alertsShort'), icon: 'bell' },
                  { to: '/dev/profile', label: s('profileShort'), icon: 'user' },
                ]}
              />
            </div>
          </div>
        </Showcase>
      </main>
    </div>
  )
}
