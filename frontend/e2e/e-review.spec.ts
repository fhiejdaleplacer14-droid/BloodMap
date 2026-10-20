import { expect, test } from '@playwright/test'
import { ACCOUNTS, signIn, toast } from './helpers'

/** Flow E · Review a request (46:7): Overview → Review queue → Review detail → Correction → Updated queue. */
test('E · a coordinator sends a request back for correction', async ({ page }) => {
  await signIn(page, ACCOUNTS.coordinator, /\/coord$/)
  await expect(page.getByRole('heading', { name: 'Coordination overview' })).toBeVisible()
  await page.getByRole('link', { name: 'Open review queue' }).click()

  await expect(page.getByRole('heading', { name: 'Review queue' })).toBeVisible()
  await page.getByRole('tab', { name: /Assigned to me/ }).click()
  await page.getByRole('row', { name: /BM-2026-0025/ }).getByRole('link', { name: 'Review' }).click()

  await expect(page.getByRole('heading', { name: 'Review BM-2026-0025' })).toBeVisible()
  await expect(page.getByText('Automated checks')).toBeVisible()
  // Phone-like numbers are masked, even for reviewers.
  await expect(page.getByText(/\d{11}/)).toHaveCount(0)

  await page.getByRole('button', { name: 'Request correction' }).click()
  const dialog = page.getByRole('alertdialog', { name: /Send BM-2026-0025 back for correction/ })
  await dialog.getByRole('button', { name: 'Send for correction' }).click()
  await expect(dialog.getByText(/Tell the submitter what to change/)).toBeVisible()
  await dialog.getByLabel('What needs to change?').fill('Please add the desk’s hours, and remove the phone number from the description.')
  await dialog.getByRole('button', { name: 'Send for correction' }).click()

  await expect(page).toHaveURL(/\/coord\/queue\?tab=mine/)
  await expect(toast(page, 'Sent back for correction')).toBeVisible()
  await page.getByRole('tab', { name: /Needs correction/ }).click()
  await expect(page.getByRole('row', { name: /BM-2026-0025.*Needs correction/ })).toBeVisible()
})
