import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/** WCAG 2.2 AA scan of the phone-only screens (10 · Mobile), light and dark. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function scan(page: Page, label: string, problems: string[]) {
  await page.waitForLoadState('networkidle')
  const result = await new AxeBuilder({ page }).withTags(TAGS).exclude('.leaflet-tile-pane').analyze()
  for (const v of result.violations) {
    problems.push(`${label} — ${v.id} (${v.impact}, ${v.nodes.length}×): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
  }
}

for (const scheme of ['light', 'dark'] as const) {
  test(`a11y · phone · ${scheme}`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.emulateMedia({ colorScheme: scheme })
    const problems: string[] = []

    await page.goto('/requests')
    await expect(page.locator('#explorer-results a[id^="request-card-"]').first()).toBeVisible()
    await scan(page, 'explorer list', problems)

    await page.getByRole('button', { name: /^Filters/ }).click()
    await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible()
    await scan(page, 'filters sheet', problems)
    await page.getByRole('button', { name: 'Close' }).click()

    await page.getByRole('button', { name: 'Ask the guide' }).click()
    await expect(page.getByRole('dialog', { name: 'BloodMap guide' })).toBeVisible()
    await scan(page, 'guide sheet', problems)
    await page.keyboard.press('Escape')

    await page.getByRole('radio', { name: 'Map' }).click()
    await expect(page.getByRole('region', { name: 'Requests in view' })).toBeVisible()
    await scan(page, 'map + sheet', problems)

    await page.goto('/requests?sel=BM-2026-0012')
    await expect(page.getByRole('heading', { name: 'O+ blood requested' })).toBeVisible()
    await scan(page, 'request details', problems)

    expect(problems, problems.join('\n')).toEqual([])
  })
}
