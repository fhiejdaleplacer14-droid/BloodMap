import { expect, test } from '@playwright/test'

/** Flow A · Discover a request (46:7): Landing → Explorer → blood type filter → results → details. */
test('A · a visitor finds an O+ request and opens its details', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Explore Blood Requests' }).first().click()
  await expect(page).toHaveURL(/\/requests/)
  await expect(page.getByRole('heading', { name: 'Blood requests' })).toBeVisible()

  // Blood type filter (popover) → O+ → "Show N requests".
  await page.getByRole('button', { name: /^Blood type/ }).click()
  await page.getByRole('button', { name: 'O positive' }).click()
  await page.getByRole('button', { name: /^Show \d+ requests?$/ }).click()
  await expect(page).toHaveURL(/type=O%2B|type=O\+/)
  await expect(page.getByText('Type: O+')).toBeVisible()

  // Results: every card is O+; the map shows them too (municipality level only).
  const cards = page.locator('#explorer-results a[id^="request-card-"]')
  await expect(cards.first()).toBeVisible()
  for (const card of await cards.all()) await expect(card).toContainText('O+')
  await expect(page.getByRole('region', { name: 'Map of blood requests' })).toBeVisible()
  await expect(page.getByText('OpenStreetMap')).toBeVisible()

  // Request details: coordination details, never a private contact for guests.
  await cards.first().click()
  await expect(page.getByRole('heading', { name: 'O+ blood requested' })).toBeVisible()
  const details = page.locator('article[aria-labelledby="request-detail-title"]')
  await expect(details.getByText('Authorized coordination point')).toBeVisible()
  await expect(details.getByRole('link', { name: 'Log in to view contact' })).toBeVisible()
})
