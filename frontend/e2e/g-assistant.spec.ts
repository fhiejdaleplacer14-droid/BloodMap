import { expect, test } from '@playwright/test'

/** Flow G · Use the AI assistant (46:7): Explorer → Assistant (empty) → Suggested question → Answer with source → Close. */
test('G · a visitor asks the guide and gets an answer with its source', async ({ page }) => {
  await page.goto('/requests')
  const launcher = page.getByRole('button', { name: 'Ask the guide' })
  await expect(launcher).toHaveAttribute('aria-expanded', 'false')
  await launcher.click()

  const panel = page.getByRole('dialog', { name: 'BloodMap guide' })
  await expect(panel.getByText('Try asking')).toBeVisible()
  await panel.getByRole('button', { name: 'What do the request statuses mean?' }).click()

  const log = panel.getByRole('log')
  await expect(log.getByText(/Statuses describe where a request is in review/)).toBeVisible()
  await expect(log.getByRole('link', { name: 'From: Help › Request statuses' })).toBeVisible()

  // Eligibility questions get the fixed safety note, never an assessment.
  await panel.getByLabel('Your question').fill('I got a tattoo last month. Can I still donate?')
  await panel.getByRole('button', { name: 'Send' }).click()
  await expect(log.getByText(/I can’t assess whether you can donate/)).toBeVisible()

  await page.getByRole('button', { name: 'Close guide' }).click()
  await expect(panel).toBeHidden()
  await expect(page.getByRole('button', { name: 'Ask the guide' })).toHaveAttribute('aria-expanded', 'false')
})
