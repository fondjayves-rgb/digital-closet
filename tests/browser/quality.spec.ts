import { test, expect, type Page } from '@playwright/test';
import { fixture } from './fixtures';

const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const nav = (page: Page) => page.getByRole('navigation', { name: (page.viewportSize()?.width ?? 1440) <= 640 ? 'Mobile navigation' : 'Main navigation' });
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
}

test('responsive closet, readable text, keyboard focus and dialog focus restoration', async ({ page }, info) => {
  await fixture(page); await nav(page).getByRole('button', { name: 'My Closet' }).click();
  await expect(page.locator('.garment-card')).toHaveCount(3); await noOverflow(page);
  const metrics = await page.locator('.garment-grid').evaluate(el => {
    const lum = (rgb: number[]) => rgb.slice(0, 3).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
    const rgb = (color: string) => (color.match(/[\d.]+/g) || []).map(Number);
    const text = Array.from(document.querySelectorAll<HTMLElement>('.garment-copy>p:last-child,.garment-copy h3,.category-tabs button,.page-heading .muted')).filter(e => e.getBoundingClientRect().width > 0);
    return { columns: getComputedStyle(el).gridTemplateColumns.split(' ').length, text: text.map(e => {
      let parent: HTMLElement | null = e; let bg = [250, 249, 246];
      while (parent) { const color = rgb(getComputedStyle(parent).backgroundColor); if (color.length >= 3 && (color.length < 4 || color[3] === 1)) { bg = color; break; } parent = parent.parentElement; }
      const a = lum(rgb(getComputedStyle(e).color)), b = lum(bg);
      return { size: parseFloat(getComputedStyle(e).fontSize), contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    }) };
  });
  expect(metrics.columns).toBeGreaterThanOrEqual(2);
  for (const metric of metrics.text) { expect(metric.size).toBeGreaterThanOrEqual(12); expect(metric.contrast).toBeGreaterThanOrEqual(4.5); }
  if ((page.viewportSize()?.width ?? 0) <= 640) {
    expect(await page.getByLabel('Search your closet').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    expect(await nav(page).getByRole('button', { name: 'Today', exact: true }).evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  }
  await page.getByLabel('Sort garments').focus(); await page.keyboard.press('Tab'); await expect(page.getByLabel('Brand', { exact:true })).toBeFocused();
  const first = page.locator('.garment-open').first(); await first.focus(); await expect(first).toBeFocused();
  expect(await first.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter'); await expect(page.getByRole('dialog')).toBeVisible();
  for (let i = 0; i < 10; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true); }
  await noOverflow(page); await page.keyboard.press('Escape'); await expect(first).toBeFocused();
  await page.screenshot({ path: `docs/screenshots/quality-closet-${info.project.name}.png`, fullPage: true });
});

test('refresh shows progress and recovers unavailable photos', async ({ page }) => {
  const controls = await fixture(page); await nav(page).getByRole('button', { name: 'My Closet' }).click();
  let release!: () => void; let hold = true; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/items', async route => { if (route.request().method() === 'GET' && hold) await gate; await route.fallback(); });
  const refresh = page.getByRole('button', { name: 'Refresh wardrobe', exact: true });
  await refresh.click(); await expect(refresh).toBeDisabled(); await expect(refresh.locator('svg')).toHaveClass(/spin/);
  hold = false; release(); await expect(refresh).toBeEnabled();
  const original = controls.items[0].photoUrl; controls.items[0].photoUrl = 'data:image/png;base64,invalid';
  await refresh.click(); await expect(page.getByText('Photo unavailable. Use “Refresh wardrobe” to try again.')).toBeVisible();
  controls.items[0].photoUrl = original; await refresh.click();
  await expect(page.getByText('Photo unavailable. Use “Refresh wardrobe” to try again.')).toHaveCount(0); await noOverflow(page);
});

test('upload rejects replacement files and recovers from upload/status failures without losing edits', async ({ page }) => {
  await fixture(page); await nav(page).getByRole('button', { name: 'My Closet' }).click();
  await page.getByRole('button', { name: 'Add a garment', exact: true }).last().click();
  const input = page.getByLabel('Garment photo');
  await input.setInputFiles({ name: 'valid.png', mimeType: 'image/png', buffer: photo });
  await expect(page.getByRole('button', { name: 'Upload & review' })).toBeEnabled();
  await input.setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('not a photo') });
  await expect(page.getByRole('alert')).toContainText('JPEG, PNG, or WebP');
  await expect(page.getByRole('button', { name: 'Upload & review' })).toBeDisabled();
  await expect(page.getByAltText('Selected garment preview')).toHaveCount(0);
  await input.setInputFiles({ name: 'valid.png', mimeType: 'image/png', buffer: photo });
  let uploadFailed = false;
  await page.route('**/api/items', async route => {
    if (route.request().method() === 'POST' && !uploadFailed) { uploadFailed = true; await route.fulfill({ status: 503, json: { error: 'Photo upload unavailable. Please retry.' } }); return; }
    await route.fallback();
  });
  let statusFailed = true;
  await page.route('**/api/items/dddddddd-dddd-4ddd-8ddd-dddddddddddd', async route => {
    if (statusFailed) { await route.fulfill({ status: 503, json: { error: 'Analysis status unavailable.' } }); return; }
    await route.fallback();
  });
  await page.getByRole('button', { name: 'Upload & review' }).click(); await expect(page.getByRole('alert')).toContainText('Photo upload unavailable');
  await expect(page.getByAltText('Selected garment preview')).toBeVisible(); await noOverflow(page);
  await page.getByRole('button', { name: 'Upload & review' }).click(); await expect(page.getByRole('button', { name: 'Retry status check' })).toBeVisible();
  await page.getByLabel('Garment name').fill('My corrected shirt'); statusFailed = false; await page.getByRole('button', { name: 'Retry status check' }).click();
  await expect(page.getByText('Analysis status unavailable.', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Garment name')).toHaveValue('My corrected shirt');
  await expect(page.getByLabel('Category', { exact: true })).toHaveValue('');
  await page.getByLabel('Category', { exact: true }).selectOption('tops'); await page.getByLabel('Main color').fill('ivory'); await page.getByLabel('Garment name').fill('   ');
  await page.getByRole('button', { name: 'Confirm & add to my closet' }).click();
  await expect(page.getByLabel('Garment name')).toHaveAttribute('aria-invalid', 'true'); await expect(page.getByText('Enter a name for this garment.')).toBeVisible();
  await page.getByLabel('Garment name').fill('My corrected shirt'); await noOverflow(page);
  await page.getByRole('button', { name: 'Confirm & add to my closet' }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('initial connection failure is distinct from an empty closet and has a working retry', async ({ page }) => {
  const controls = await fixture(page, { failInitial: true });
  await expect(page.getByRole('heading', { name: 'Your wardrobe could not be loaded.' })).toBeVisible();
  await expect(page.locator('.stats-row')).toHaveCount(0);
  controls.recover(); await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Test.' })).toBeVisible(); await expect(page.locator('.global-error')).toHaveCount(0);
});

test('empty screens, planner validation and outfit request retry are recoverable', async ({ page }, info) => {
  await fixture(page, { empty: true }); await nav(page).getByRole('button', { name: 'My Closet' }).click();
  await expect(page.getByRole('button', { name: 'Add your first garment' })).toBeVisible(); await noOverflow(page);
  await nav(page).getByRole('button', { name: 'Outfits', exact: true }).click(); await page.getByRole('button', { name: 'Wear history', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Good outfits deserve another day.' })).toBeVisible();
  await fixture(page); await nav(page).getByRole('button', { name: 'Outfits', exact: true }).click();
  await page.getByRole('button', { name: 'Suggest with AI' }).click();
  await page.getByLabel('What’s the occasion?').fill('   '); await page.getByRole('dialog').getByRole('button', { name: 'Find my outfits', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Enter an occasion');
  await page.getByLabel('What’s the occasion?').fill('Everyday');
  let fail = true;
  await page.route('**/api/outfits/suggest', async route => { if (fail) { fail = false; await route.fulfill({ status: 503, json: { error: 'Outfit planning temporarily unavailable. Try again.' } }); } else await route.fallback(); });
  await page.getByRole('dialog').getByRole('button', { name: 'Find my outfits', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
  await page.getByRole('dialog').getByRole('button', { name: 'Find my outfits', exact: true }).click(); await expect(page.locator('.suggestion-card')).toHaveCount(1); await noOverflow(page);
  await expect(page.locator('.result-heading h3')).toBeFocused();
  await page.locator('.suggestion-card').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `docs/screenshots/quality-outfits-${info.project.name}.png` });
});
