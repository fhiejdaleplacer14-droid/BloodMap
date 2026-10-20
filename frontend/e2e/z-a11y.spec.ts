import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { ACCOUNTS, signIn } from './helpers'

/**
 * WCAG 2.2 AA scan (Handoff 55:298) of every screen, light and dark.
 * Read-only: it signs in as each role and only visits pages.
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

type Screen = { path: string; ready: (page: Page) => Promise<void> }
const heading = (name: string | RegExp): Screen['ready'] => (page) => expect(page.getByRole('heading', { name }).first()).toBeVisible()

const SCREENS: Record<'guest' | keyof typeof ACCOUNTS, Screen[]> = {
  guest: [
    { path: '/', ready: heading(/When every connection matters/) },
    { path: '/requests', ready: (p) => expect(p.locator('#explorer-results a[id^="request-card-"]').first()).toBeVisible() },
    { path: '/requests?sel=BM-2026-0012', ready: heading('O+ blood requested') },
    { path: '/requests?sel=BM-2026-0007', ready: heading(/blood requested/) },
    { path: '/login', ready: heading('Welcome back') },
    { path: '/register', ready: heading('Create your account') },
    { path: '/forgot-password', ready: heading('Reset your password') },
  ],
  donor: [
    { path: '/app', ready: heading(/^Good (morning|afternoon|evening)/) },
    { path: '/app/saved', ready: heading('Saved requests') },
    { path: '/app/activity', ready: heading(/activity/i) },
    { path: '/app/notifications', ready: heading('Notifications') },
    { path: '/app/profile', ready: heading(/Profile/) },
  ],
  submitter: [
    { path: '/requests/mine', ready: heading('My requests') },
    { path: '/requests/new', ready: (p) => expect(p.getByLabel('Blood type')).toBeVisible() },
    { path: '/requests/mine/BM-2026-0024', ready: heading('BM-2026-0024') },
  ],
  coordinator: [
    { path: '/coord', ready: heading('Coordination overview') },
    { path: '/coord/queue', ready: heading('Review queue') },
    { path: '/coord/requests/BM-2026-0026', ready: heading('Review BM-2026-0026') },
    { path: '/coord/activity', ready: heading('Activity log') },
  ],
  admin: [
    { path: '/admin', ready: heading('Platform overview') },
    { path: '/admin/users', ready: heading('User management') },
    { path: '/admin/coordinators', ready: heading('Coordinator management') },
    { path: '/admin/audit', ready: heading('Audit logs') },
    { path: '/admin/settings', ready: heading('System settings') },
  ],
}

const LANDS: Record<keyof typeof ACCOUNTS, RegExp> = {
  donor: /\/app$/,
  submitter: /\/requests\/mine$/,
  coordinator: /\/coord$/,
  admin: /\/admin$/,
}

for (const scheme of ['light', 'dark'] as const) {
  for (const [role, screens] of Object.entries(SCREENS) as [keyof typeof SCREENS, Screen[]][]) {
    test(`a11y · ${role} · ${scheme}`, async ({ page }) => {
      test.setTimeout(180_000)
      await page.emulateMedia({ colorScheme: scheme })
      if (role !== 'guest') await signIn(page, ACCOUNTS[role], LANDS[role])

      const problems: string[] = []
      for (const screen of screens) {
        await page.goto(screen.path)
        await screen.ready(page)
        await page.waitForLoadState('networkidle')
        // Map tiles are third-party imagery; markers and controls are still checked.
        const result = await new AxeBuilder({ page }).withTags(TAGS).exclude('.leaflet-tile-pane').analyze()
        for (const v of result.violations) {
          const targets = v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')
          problems.push(`${screen.path} — ${v.id} (${v.impact}, ${v.nodes.length}×): ${v.help} → ${targets}`)
        }
      }
      expect(problems, problems.join('\n')).toEqual([])
    })
  }
}
