import { expect, test } from '@playwright/test'
import { ACCOUNTS, signIn, toast } from './helpers'

/** Flow C · Save a request (46:211 → 46:613): Log in → Dashboard → Explorer → Details → Saved requests. */
test('C · a donor saves a request and finds it in Saved requests', async ({ page }) => {
  await signIn(page, ACCOUNTS.donor, /\/app$/)
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening), Juan/ })).toBeVisible()

  await page.getByRole('link', { name: 'Explore Requests' }).first().click()
  await expect(page).toHaveURL(/\/requests/)
  const card = page.locator('#request-card-BM-2026-0016')
  await expect(card).toBeVisible()
  await card.click()
  await expect(page.getByRole('heading', { name: 'A+ blood requested' })).toBeVisible()

  // Signed in: the desk contact shows where the facility allows it.
  await expect(page.getByRole('link', { name: 'Log in to view contact' })).toHaveCount(0)

  // The sticky bar's button (the header has an icon twin with the same name).
  await page.getByRole('button', { name: 'Save request', exact: true }).last().click()
  await expect(toast(page, 'Request saved')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove from saved' }).first()).toBeVisible()

  await page.goto('/app/saved')
  await expect(page.getByRole('heading', { name: 'Saved requests' })).toBeVisible()
  await expect(page.getByRole('row', { name: /BM-2026-0016/ })).toBeVisible()
})
