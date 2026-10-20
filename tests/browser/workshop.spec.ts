import { test, expect, type Page } from '@playwright/test';
import { fixture } from './fixtures';

const nav = (page: Page) => page.getByRole('navigation', { name: (page.viewportSize()?.width || 1440) <= 640 ? 'Mobile navigation' : 'Main navigation' });

test('Workshop collections survive keyboard Enter submission without blurring the field', async ({ page }) => {
  await fixture(page);
  await nav(page).getByRole('button', { name: 'My Closet', exact: true }).click();
  await page.getByRole('button', { name: 'Add without photo', exact: true }).click();
  await page.getByLabel('Item name', { exact: true }).fill('Keyboard collection fixture');
  await page.getByLabel('I reviewed these details and confirm this item is in my wardrobe.').check();
  const collections = page.getByLabel('Collections (comma separated)');
  await collections.fill('Work, Daily, Work');
  const sent = page.waitForRequest(req => req.url().endsWith('/api/items/manual') && req.method() === 'POST');
  await collections.press('Enter');
  expect((await sent).postDataJSON().collections).toEqual(['Work', 'Daily']);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Review Keyboard collection fixture', exact: true }).click();
  await expect(page.getByLabel('Collections (comma separated)')).toHaveValue('Work, Daily');
});

test('Workshop removing a replacement target cancels replacement and permits another selection', async ({ page }) => {
  await fixture(page);
  await nav(page).getByRole('button', { name: 'Outfits', exact: true }).click();
  await page.getByRole('button', { name: 'Build an outfit', exact: true }).click();
  await page.locator('.picker-item').filter({ hasText: 'Test shirt' }).click();
  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel replacement', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Test shirt', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel replacement', exact: true })).toHaveCount(0);
  await page.locator('.picker-item').filter({ hasText: 'Test trousers' }).click();
  await expect(page.locator('.selected-items')).toContainText('Test trousers');
});
