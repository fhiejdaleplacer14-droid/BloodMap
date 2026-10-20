import { expect, test } from '@playwright/test'

/** Flow A on a phone (10 · Mobile): filters sheet, results ⇄ map with bottom sheet, details. */
test('A · phone: filter in the sheet, switch list ⇄ map, open details', async ({ page }) => {
  await page.goto('/requests')
  await page.getByRole('button', { name: /^Filters/ }).click()
  await page.getByRole('button', { name: 'O positive' }).click()
  await expect(page.getByText('1 selected')).toBeVisible()
  await page.getByRole('button', { name: /^Show \d+ requests?$/ }).click()
  await expect(page.getByRole('button', { name: 'Filters · 1' })).toBeVisible()

  // Map with the bottom sheet peeking; the attribution stays visible above it.
  await page.getByRole('radio', { name: 'Map' }).click()
  const sheet = page.getByRole('region', { name: 'Requests in view' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText(/requests? in view/)).toBeVisible()
  await expect(page.getByText('OpenStreetMap')).toBeInViewport()
  await sheet.getByRole('button', { name: 'Show more of the list' }).click()
  await expect(sheet.locator('a[id^="request-card-"]').first()).toBeVisible()

  // Back to the list, then details with the phone header and sticky actions.
  await page.getByRole('radio', { name: 'List' }).click()
  await page.locator('#explorer-results a[id^="request-card-"]').first().click()
  await expect(page.getByText('Request details', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save request', exact: true }).last()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Log in for contact' })).toBeVisible()
})
