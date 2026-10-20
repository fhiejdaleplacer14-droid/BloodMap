import { expect, test } from '@playwright/test'

/** Flow B · Register (46:7): Log in → Registration → inline validation → check inbox → Log in. */
test('B · a visitor registers and is told to check their inbox', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()

  // Inline validation before anything is sent.
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Enter your full name.')).toBeVisible()
  await expect(page.getByText('You need to accept to create an account.')).toBeVisible()

  const email = `e2e.${Date.now()}@example.org`
  const password = `Bm-e2e-${Date.now()}-Strong!`
  await page.getByLabel('Full name').fill('E2E Donor')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill('different-Password-1!')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Passwords don’t match.')).toBeVisible()

  await page.getByLabel('Confirm password').fill(password)
  await page.getByRole('checkbox', { name: /I agree to the Terms of use/ }).check()
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible()
  // The address is shown masked (j••••@example.org), so match the domain only.
  await expect(page.getByText(/@example.org/)).toBeVisible()
  await page.getByRole('link', { name: 'Continue to sign in' }).click()
  await expect(page).toHaveURL(/\/login/)
})
