import { expect, test } from '@playwright/test'
import { ACCOUNTS, signIn, toast } from './helpers'

/** Flow F · Administer accounts (46:7): Admin overview → Users → Drawer → Change role → back to users. */
test('F · an administrator makes a donor a coordinator, with a reason', async ({ page }) => {
  await signIn(page, ACCOUNTS.admin, /\/admin$/)
  await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible()
  await page.getByRole('link', { name: 'User Management' }).first().click()

  await expect(page.getByRole('heading', { name: 'User management' })).toBeVisible()
  await page.getByRole('button', { name: 'Account details for Rico Bautista (demo)' }).click()
  const drawer = page.getByRole('dialog', { name: 'Account details' })
  await expect(drawer.getByText('Not visible to administrators')).toBeVisible()
  await drawer.getByRole('button', { name: 'Change role' }).click()

  const dialog = page.getByRole('dialog', { name: 'Change role' })
  await dialog.getByRole('radio', { name: 'Coordinator' }).click()
  await dialog.getByRole('button', { name: 'Save role change' }).click()
  await expect(dialog.getByText('Choose the coordinator’s area.')).toBeVisible()
  await expect(dialog.getByText('Add a reason (at least 3 characters).')).toBeVisible()
  await dialog.getByLabel('Assigned area (coordinators)').selectOption({ label: 'Negros Occidental (North)' })
  await dialog.getByLabel('Reason (saved to audit log)').fill('Approved by NIR coordination lead (e2e)')
  await dialog.getByRole('button', { name: 'Save role change' }).click()

  await expect(toast(page, 'Role updated')).toBeVisible()
  await drawer.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('row', { name: /Rico Bautista \(demo\).*Coordinator/ })).toBeVisible()
  // The change is in the audit log.
  await page.getByRole('link', { name: 'Audit Logs' }).first().click()
  await expect(page.getByRole('row', { name: /user\.role_changed/ }).first()).toBeVisible()
})
