import { expect, type Page } from '@playwright/test'

/** Demo accounts from DemoSeeder (all share one password). */
export const ACCOUNTS = {
  donor: 'juan.demo@example.org',
  submitter: 'ana.desk@example.org',
  coordinator: 'm.coord@example.org',
  admin: 'admin@example.org',
} as const
export const DEMO_PASSWORD = 'BloodMap-demo-2026!'

export async function signIn(page: Page, email: string, landsOn: RegExp) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(landsOn)
}

/** A toast, matched by its exact title. */
export function toast(page: Page, title: string) {
  return page.getByText(title, { exact: true }).first()
}
