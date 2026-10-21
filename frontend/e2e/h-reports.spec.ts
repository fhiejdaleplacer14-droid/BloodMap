import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { ACCOUNTS, signIn, toast } from './helpers'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function noViolations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(TAGS).exclude('.leaflet-tile-pane').analyze()
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
}

/** Flow H · Report a problem (decision #94): donor reports a live request → coordinator handles it on Reports. */
test('H · a donor reports a request and the area coordinator dismisses it', async ({ browser }) => {
  const donor = await (await browser.newContext()).newPage()
  await signIn(donor, ACCOUNTS.donor, /\/app$/)
  await donor.goto('/requests?sel=BM-2026-0012')
  await expect(donor.getByRole('heading', { name: 'O+ blood requested' })).toBeVisible()

  await donor.getByRole('button', { name: 'Report a problem' }).click()
  const dialog = donor.getByRole('dialog', { name: 'Report a problem with this request' })
  await dialog.getByRole('button', { name: 'Send report' }).click()
  await expect(dialog.getByText('Choose what’s wrong.')).toBeVisible()
  await dialog.getByRole('radio', { name: 'Details are wrong or outdated' }).click()
  await dialog.getByLabel(/Anything else coordinators should know/).fill('Desk hours on the listing look out of date.')
  await noViolations(donor)
  await dialog.getByRole('button', { name: 'Send report' }).click()
  await expect(toast(donor, 'Report sent')).toBeVisible()

  const coord = await (await browser.newContext()).newPage()
  await signIn(coord, ACCOUNTS.coordinator, /\/coord$/)
  await expect(coord.getByRole('heading', { name: 'Open reports' })).toBeVisible()
  await coord.getByRole('link', { name: /^Reports/ }).first().click()
  await expect(coord.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible()

  const row = coord.getByRole('row', { name: /BM-2026-0012/ })
  await expect(row.getByText('Wrong or outdated details')).toBeVisible()
  // Reporters show by role or reference, never by name.
  await expect(row.getByText('Donor')).toBeVisible()
  await expect(row.getByText('Juan')).toHaveCount(0)

  await row.getByRole('button', { name: 'Handle' }).click()
  const handle = coord.getByRole('dialog', { name: 'Handle report on BM-2026-0012' })
  await expect(handle.getByText('Desk hours on the listing look out of date.')).toBeVisible()
  await handle.getByRole('radio', { name: /^Dismissed/ }).click()
  await handle.getByLabel('Note (optional)').fill('Hours match the desk’s posted schedule.')
  await noViolations(coord)
  await handle.getByRole('button', { name: 'Save outcome' }).click()
  await expect(toast(coord, 'Report handled')).toBeVisible()

  await coord.getByRole('tab', { name: /Handled/ }).click()
  const handled = coord.getByRole('row', { name: /BM-2026-0012/ })
  await expect(handled.getByText('Dismissed')).toBeVisible()
  await expect(handled.getByText('by you')).toBeVisible()
})
