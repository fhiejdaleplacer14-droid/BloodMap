import { expect, test } from '@playwright/test'
import { ACCOUNTS, signIn } from './helpers'

/** Flow D · Submit a request (46:7): My requests → Step 1 → Step 2 → Step 3 privacy review → Pending review. */
test('D · a facility submitter creates and submits a request for review', async ({ page }) => {
  await signIn(page, ACCOUNTS.submitter, /\/requests\/mine$/)
  await expect(page.getByRole('heading', { name: 'My requests' })).toBeVisible()
  await page.getByRole('link', { name: 'Create request', exact: true }).click()

  // Step 1 · Request information
  await expect(page.getByRole('heading', { name: 'Create blood request' })).toBeVisible()
  await page.getByLabel('Blood type').selectOption('B+')
  await page.getByLabel('Units requested').fill('2')
  const neededBy = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
  await page.getByLabel('Needed by').fill(neededBy)
  await page.getByLabel('Desk opens').fill('08:00')
  await page.getByLabel('Desk closes').fill('17:00')
  await page.getByLabel('Request category').selectOption('scheduled_procedure')
  await page.getByLabel('Short public description').fill('2 units requested for a scheduled procedure. Coordinate through the facility’s blood services desk.')
  await page.getByRole('button', { name: 'Continue to coordination' }).click()

  // Step 2 · Coordination (the draft is saved on the way)
  await expect(page).toHaveURL(/step=2&id=BM-\d{4}-\d{4}/)
  await expect(page.getByLabel('Authorized coordination point')).toBeVisible()
  await page.getByRole('radio', { name: /Signed-in users only/ }).check()
  await page.getByRole('button', { name: 'Continue to review' }).click()

  // Step 3 · Review and privacy check
  await expect(page.getByRole('heading', { name: 'Review and submit' })).toBeVisible()
  await expect(page.getByText('No street address or exact coordinates')).toBeVisible()
  await expect(page.getByText('No patient name or diagnosis detected in the description')).toBeVisible()
  await page.getByRole('button', { name: 'Submit for review' }).click()
  await expect(page.getByText('Confirm the details before you submit.')).toBeVisible()
  await page.getByRole('checkbox', { name: /I confirm these details were confirmed with the facility/ }).check()
  await page.getByRole('button', { name: 'Submit for review' }).click()

  // Pending review
  await expect(page.getByRole('heading', { name: 'Request submitted' })).toBeVisible()
  const id = (await page.locator('text=/BM-\\d{4}-\\d{4}/').first().textContent())?.match(/BM-\d{4}-\d{4}/)?.[0]
  expect(id).toBeTruthy()
  await page.getByRole('link', { name: 'Back to my requests' }).click()
  await expect(page.getByRole('row', { name: new RegExp(`${id}.*Pending review`) })).toBeVisible()
})
