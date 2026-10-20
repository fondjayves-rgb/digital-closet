import { test, expect, type Page } from '@playwright/test';
import { fixture } from './fixtures';

const nav = (page: Page) => page.getByRole('navigation', { name: (page.viewportSize()?.width || 1440) <= 640 ? 'Mobile navigation' : 'Main navigation' });
async function go(page: Page, name: string) { await nav(page).getByRole('button', { name, exact: true }).click(); }
async function createLook(page: Page) {
  await go(page, 'Outfits'); await page.getByRole('button', { name: 'Build an outfit', exact: true }).click();
  await page.getByLabel('Outfit name', { exact: true }).fill('PHASE2 TEST look');
  await page.locator('.picker-item').filter({ hasText: 'Test shirt' }).click();
  await page.getByLabel('I confirm these reviewed items form my finished outfit.').check();
  await page.getByRole('button', { name: 'Save finished outfit', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.saved-outfit-card').click();
}

test('Phase2 overlapping Favorites keep each in-flight card disabled until its own request settles', async ({ page }) => {
  await fixture(page); await go(page, 'My Closet');
  const releases: (() => void)[] = [];
  const gates = [0,1].map(() => new Promise<void>(resolve => releases.push(resolve)));
  let calls = 0;
  await page.route('**/api/items/*/favorite', async route => { const n = calls++; if (n < 2) await gates[n]; await route.fallback(); });
  const a = page.getByRole('button', { name: 'Favorite Test shirt', exact: true });
  const b = page.getByRole('button', { name: 'Favorite Test trousers', exact: true });
  try {
    await a.click(); await expect(a).toBeDisabled(); await b.click();
    await expect(b).toBeDisabled(); await expect(a).toBeDisabled();
    releases[0](); await expect(page.getByRole('button', { name: 'Unfavorite Test shirt', exact: true })).toBeEnabled();
    await expect(b).toBeDisabled(); releases[1]();
    await expect(page.getByRole('button', { name: 'Unfavorite Test trousers', exact: true })).toBeEnabled();
    expect(calls).toBe(2);
  } finally { for (const release of releases) release(); }
});

test('Phase2 account constraints, confirmation notice, invalid credentials and busy duplicate recovery use isolated Auth', async ({ page }) => {
  await fixture(page); await go(page, 'Settings'); await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  const email = page.getByLabel('Email address'), password = page.getByLabel('Password', { exact: true });
  await expect(password).toHaveAttribute('type', 'password'); await expect(password).toHaveAttribute('autocomplete', 'new-password');
  await expect(email).toHaveAttribute('maxlength', '254'); await expect(password).toHaveAttribute('maxlength', '128');
  let signups = 0;
  await page.route('https://wardrobe-browser-test.invalid/auth/v1/signup**', async route => { signups++; await route.fulfill({ json: { id: '33333333-3333-4333-8333-333333333333', email: 'phase2@example.test', aud: 'authenticated' } }); });
  const submit = page.getByRole('button', { name: 'Create your wardrobe', exact: true });
  await email.fill(''); await password.fill(''); await submit.click(); expect(signups).toBe(0);
  await email.fill('invalid-email'); await password.fill('12345678'); await submit.click(); expect(signups).toBe(0);
  await email.fill('phase2@example.test'); await password.fill('1234567'); await submit.click(); expect(signups).toBe(0);
  await password.fill('12345678'); await submit.click();
  await expect(page.getByRole('status')).toContainText('Check your email'); expect(signups).toBe(1);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await password.fill('x'.repeat(129)); await expect(password).toHaveValue('x'.repeat(128)); await submit.click(); await expect.poll(() => signups).toBe(2);
  const longEmail = 'a'.repeat(64) + '@' + 'b'.repeat(63) + '.' + 'c'.repeat(63) + '.' + 'd'.repeat(59) + '.x';
  expect(longEmail.length).toBe(254); await email.fill(longEmail + 'x'); await expect(email).toHaveValue(longEmail);
  expect(await email.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(true); await submit.click(); await expect.poll(() => signups).toBe(3);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(password).toHaveAttribute('autocomplete', 'current-password');
  await email.fill('phase2@example.test'); await password.fill('fixture-only-password');
  let attempts = 0; let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('https://wardrobe-browser-test.invalid/auth/v1/token**', async route => {
    if (++attempts === 1) { await gate; await route.fulfill({ status: 400, json: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } }); }
    else await route.fallback();
  });
  await page.getByRole('button', { name: 'Step inside', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Please wait', exact: false })).toBeDisabled(); await password.press('Enter'); expect(attempts).toBe(1);
  release(); await expect(page.getByRole('alert')).toContainText('Invalid login credentials');
  await page.getByRole('button', { name: 'Step inside', exact: true }).click(); await expect(nav(page)).toBeVisible(); expect(attempts).toBe(2);
});

test('Phase2 sign-out error retains session and retry removes protected views', async ({ page }) => {
  await fixture(page); await go(page, 'Settings'); let fail = true;
  await page.route('https://wardrobe-browser-test.invalid/auth/v1/logout**', async route => { if (fail) await route.fulfill({ status: 500, json: { msg: 'Isolated logout failure' } }); else await route.fallback(); });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Isolated logout failure'); await expect(nav(page)).toBeVisible();
  fail = false; await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to your wardrobe.' })).toBeVisible(); await expect(nav(page)).toHaveCount(0);
});

test('Phase2 manual picker enforces zero one twenty and twenty-one selections with replacement and reconfirmation', async ({ page }) => {
  const controls = await fixture(page);
  for (let n = 0; n < 18; n++) controls.items.push({ ...controls.items[0], id: crypto.randomUUID(), name: `PHASE2 TEST extra ${n}` });
  await page.getByRole('button', { name: 'Refresh wardrobe', exact: true }).click(); await expect(page.getByRole('button', { name: 'Refresh wardrobe', exact: true })).toBeEnabled();
  await go(page, 'Outfits'); await page.getByRole('button', { name: 'Build an outfit', exact: true }).click();
  const save = page.getByRole('button', { name: 'Save finished outfit', exact: true }); await expect(save).toBeDisabled();
  await page.getByLabel('Outfit name', { exact: true }).fill('PHASE2 TEST twenty');
  const picker = page.locator('.picker-item'); await expect(picker).toHaveCount(21);
  for (let n = 0; n < 20; n++) await picker.nth(n).click();
  await expect(page.locator('.selected-items li')).toHaveCount(20); await expect(picker.nth(20)).toBeDisabled();
  await page.getByLabel('I confirm these reviewed items form my finished outfit.').check();
  await page.getByRole('button', { name: 'Replace', exact: true }).first().click(); await expect(picker.nth(20)).toBeEnabled(); await picker.nth(20).click();
  await expect(page.locator('.selected-items li')).toHaveCount(20); await expect(page.getByLabel('I confirm these reviewed items form my finished outfit.')).not.toBeChecked();
  await page.getByRole('button', { name: 'Remove Test trousers', exact: true }).click(); await expect(page.locator('.selected-items li')).toHaveCount(19);
  await picker.nth(0).click(); await expect(page.locator('.selected-items li')).toHaveCount(20);
  await page.getByLabel('I confirm these reviewed items form my finished outfit.').check(); await save.click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.saved-outfit-card').click(); await expect(page.locator('.garment-names li')).toHaveCount(20);
});

test('Phase2 every feedback rating and maximum note persist on reopen while invalid wear dates and duplicate day are rejected', async ({ page }) => {
  await fixture(page); await createLook(page);
  await expect(page.getByRole('button', { name: 'Save feedback', exact: true })).toBeDisabled();
  const date = page.getByLabel('Date worn'); await date.fill(''); await page.getByRole('button', { name: 'I wore this outfit', exact: true }).click();
  expect(await date.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
  await date.fill('2999-01-01'); await page.getByRole('button', { name: 'I wore this outfit', exact: true }).click();
  expect(await date.evaluate((el: HTMLInputElement) => el.validity.rangeOverflow)).toBe(true);
  const maximum = await date.getAttribute('max'); await date.fill(maximum!); await page.getByRole('button', { name: 'I wore this outfit', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Wear recorded' })).toBeVisible();
  await page.getByRole('button', { name: 'I wore this outfit', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('already exists');
  for (let n = 1; n <= 5; n++) {
    await page.getByLabel(n === 1 ? '1 star' : `${n} stars`, { exact: true }).check();
    await page.getByLabel('A note for next time').fill('x'.repeat(501)); await expect(page.getByLabel('A note for next time')).toHaveValue('x'.repeat(500));
    await page.getByRole('button', { name: 'Save feedback', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'feedback has been saved' })).toBeVisible();
    await page.keyboard.press('Escape'); await page.locator('.saved-outfit-card').click();
    await expect(page.getByLabel(n === 1 ? '1 star' : `${n} stars`, { exact: true })).toBeChecked(); await expect(page.getByLabel('A note for next time')).toHaveValue('x'.repeat(500));
  }
});

test('Phase2 destructive confirmations retain on cancel, retry failure, preserve wardrobe and expose unavailable looks in history', async ({ page }) => {
  const controls = await fixture(page); await createLook(page);
  await page.getByRole('button', { name: 'I wore this outfit', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'Wear recorded' })).toBeVisible();
  await page.getByLabel('5 stars', { exact: true }).check(); await page.getByRole('button', { name: 'Save feedback', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'feedback has been saved' })).toBeVisible(); await page.keyboard.press('Escape');
  await go(page, 'My Closet'); await page.getByRole('button', { name: 'Review Test shirt', exact: true }).click();
  await page.getByRole('button', { name: 'Delete garment', exact: true }).click(); await page.getByRole('button', { name: 'Keep garment', exact: true }).click(); expect(controls.items.length).toBe(3);
  await page.getByRole('button', { name: 'Delete garment', exact: true }).click(); let failItem = true;
  await page.route('**/api/items/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', async route => { if (route.request().method() === 'DELETE' && failItem) await route.fulfill({ status: 503, json: { error: 'Photo deletion failed. Please retry.' } }); else await route.fallback(); });
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Photo deletion failed'); expect(controls.items.length).toBe(3);
  failItem = false; await page.getByRole('button', { name: 'Delete permanently', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); expect(controls.items.length).toBe(2);
  await go(page, 'Outfits'); await page.getByRole('button', { name: 'Wear history', exact: true }).click(); await expect(page.locator('.history-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'View outfit', exact: true }).click(); await expect(page.getByRole('button', { name: 'I wore this outfit', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Delete saved outfit', exact: true }).click(); await page.getByRole('button', { name: 'Keep it', exact: true }).click();
  await page.getByRole('button', { name: 'Delete saved outfit', exact: true }).click(); let failLook = true;
  await page.route('**/api/outfits/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', async route => { if (route.request().method() === 'DELETE' && failLook) await route.fulfill({ status: 503, json: { error: 'Outfit deletion unavailable.' } }); else await route.fallback(); });
  await page.getByRole('button', { name: 'Delete outfit', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Outfit deletion unavailable');
  failLook = false; await page.getByRole('button', { name: 'Delete outfit', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.history-row')).toHaveCount(0); expect(controls.items.length).toBe(2);
});

test('Phase2 analysis checking queued processing retry failure correction and explicit proposal reapply stay under human review', async ({ page }) => {
  test.setTimeout(60000); await fixture(page); await go(page, 'My Closet');
  let status = 'none'; let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let first = true;
  const itemId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const tags = { category: 'tops', color: 'ivory', pattern: 'solid', attributes: ['collar'] };
  await page.route(`**/api/items/${itemId}`, async route => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    if (first) { first = false; await gate; }
    await route.fulfill({ json: { job: status === 'none' ? null : { id: 'phase2-job', item_id: itemId, status, attempts: status === 'failed' ? 3 : status === 'retry' ? 2 : 1, last_error: status === 'failed' ? 'Isolated analysis failure' : null }, suggestion: status === 'succeeded' ? tags : null } });
  });
  await page.route(`**/api/items/${itemId}/analyze`, async route => { status = status === 'failed' ? 'succeeded' : 'queued'; await route.fulfill({ status: 202, json: { id: 'phase2-job', item_id: itemId, status, attempts: 1, last_error: null } }); });
  await page.getByRole('button', { name: 'Add a garment', exact: true }).last().click();
  await page.getByLabel('Garment photo').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64') });
  await page.getByRole('button', { name: 'Upload & review', exact: true }).click(); await expect(page.getByText('Checking analysis', { exact: false })).toBeVisible();
  release(); await page.getByRole('button', { name: 'Suggest tags with AI', exact: true }).click(); await expect(page.getByText('In the analysis queue', { exact: false })).toBeVisible();
  status = 'processing'; await expect(page.getByText('Looking at your garment', { exact: false })).toBeVisible({ timeout: 7000 });
  status = 'retry'; await expect(page.getByText('Analysis will retry shortly', { exact: false })).toBeVisible({ timeout: 7000 });
  status = 'failed'; await expect(page.getByRole('button', { name: 'Retry analysis', exact: true })).toBeVisible({ timeout: 7000 });
  await page.getByLabel('Garment name').fill('PHASE2 TEST corrected'); await page.getByLabel('Category', { exact: true }).selectOption('bottoms'); await page.getByLabel('Main color').fill('teal');
  await page.getByRole('button', { name: 'Retry analysis', exact: true }).click(); await expect(page.getByRole('button', { name: 'Apply AI tags again', exact: true })).toBeVisible();
  await expect(page.getByLabel('Category', { exact: true })).toHaveValue('bottoms'); await expect(page.getByLabel('Main color')).toHaveValue('teal');
  await page.getByRole('button', { name: 'Apply AI tags again', exact: true }).click(); await expect(page.getByLabel('Category', { exact: true })).toHaveValue('tops'); await expect(page.getByLabel('Main color')).toHaveValue('ivory');
  await expect(page.getByLabel('Garment name')).toHaveValue('PHASE2 TEST corrected'); await page.getByRole('button', { name: 'Confirm & add to my closet', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
});
