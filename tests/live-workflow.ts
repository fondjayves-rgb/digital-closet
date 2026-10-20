// Opt-in live verification through the existing local UI/API and separately running worker.
// No HTTP mocks, no schema changes, no production-account access, no saved auth traces.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { chromium, expect, type Browser } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { readConfig } from '../apps/api/src/config.js';
import { validateRecommendations, type Garment, type Recommendations, type SavedOutfit } from '../packages/shared/src/index.js';

const config = readConfig();
const base = process.env.LIVE_WEB_ORIGIN || config.webOrigin;
const apiBase = `${base}/api`; // Exercises Vite's real proxy, not an in-process test API.
const report: { startedAt: string; finishedAt?: string; liveProviders: boolean; checks: { name: string; passed: boolean; status?: number; code?: string; operation?: string }[]; cleanup?: boolean } = { startedAt: new Date().toISOString(), liveProviders: true, checks: [] };
let operation = '';
const safeCode = (value: unknown) => typeof value === 'string' && /^[a-z0-9_]{1,80}$/i.test(value) ? value : undefined;
class CheckFailure extends Error { constructor(public status?: number, public code?: string) { super('Live verification failed; private details withheld.'); } }
async function step<T>(name: string, action: () => Promise<T>): Promise<T> {
  console.info(`CHECK: ${name}`);
  try { const value = await action(); report.checks.push({ name, passed: true }); console.info(`PASS: ${name}`); return value; }
  catch (error) { const e = error as { status?: number; code?: string }; report.checks.push({ name, passed: false, status: e.status, code: safeCode(e.code), ...(operation ? { operation } : {}) }); console.info(`FAIL: ${name}${e.status ? ` (HTTP ${e.status})` : ''}${safeCode(e.code) ? ` [${safeCode(e.code)}]` : ''}${operation ? ` at ${operation}` : ''}`); throw new CheckFailure(e.status, safeCode(e.code)); }
}
async function api<T>(path: string, token: string, body?: unknown, method = body ? 'POST' : 'GET', expected = 200): Promise<T> {
  const form = body instanceof FormData;
  const response = await fetch(`${apiBase}${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body && !form ? { 'Content-Type': 'application/json' } : {}) }, body: body ? form ? body : JSON.stringify(body) : undefined, signal: AbortSignal.timeout(100000) });
  if (response.status !== expected) throw new CheckFailure(response.status);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
function client(key: string) { return createClient(config.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } }); }
function provider<R extends { data: unknown; error: { status?: number; code?: string } | null }>(result: R): NonNullable<R['data']> {
  if (result.error) throw new CheckFailure(result.error.status, safeCode(result.error.code));
  if (result.data === null || result.data === undefined) throw new CheckFailure();
  return result.data as NonNullable<R['data']>;
}

async function main() {
  if (process.env.WARDROBE_VERIFY_LIVE !== 'yes') { console.info('Live verification not run. Set WARDROBE_VERIFY_LIVE=yes to create temporary test users, use the configured services, and clean up only those users.'); process.exitCode = 1; return; }
  if (!config.supabaseUrl || !config.publishableKey || !config.secretKey || !config.openaiKey || !config.model) { console.info('Live verification not run: complete apps/api/.env first.'); process.exitCode = 1; return; }
  const admin = client(config.secretKey);
  const accounts: { id: string; email: string; password: string; token: string; db: SupabaseClient }[] = [];
  let browser: Browser | undefined;
  try {
    await step('Local frontend/API proxy is configured for live services', async () => {
      const response = await fetch(`${apiBase}/setup`); assert.equal(response.status, 200);
      const setup = await response.json() as { ready: boolean; aiReady: boolean; workerConfigured: boolean };
      assert.ok(setup.ready && setup.aiReady && setup.workerConfigured);
    });
    await step('Create two temporary confirmed accounts and perform real password sign-in', async () => {
      for (let i = 0; i < 2; i++) {
        const email = `wardrobe-verify-${randomUUID()}@example.test`; const password = `${randomUUID()}Aa!9`;
        const created = provider(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
        assert.ok(created.user);
        const db = client(config.publishableKey);
        const account = { id: created.user.id, email, password, token: '', db }; accounts.push(account);
        const login = provider(await db.auth.signInWithPassword({ email, password })); assert.ok(login.session); account.token = login.session.access_token;
        const profile = await api<{ id: string }>('/profile', account.token); assert.equal(profile.id, account.id);
      }
    });
    const [alice, bob] = accounts;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Chicago' });
    const page = await context.newPage(); const pageErrors: string[] = [];
    // No console/network payloads, trace recording or storage-state files are retained.
    page.on('pageerror', () => pageErrors.push('Uncaught browser error'));
    await step('Real browser sign-in and protected dashboard', async () => {
      await page.goto(base); await page.getByLabel('Email address').fill(alice.email); await page.getByLabel('Password', { exact: true }).fill(alice.password);
      await page.getByRole('button', { name: 'Step inside' }).click();
      await expect(page.getByRole('heading', { name: 'Hello, possibility.' })).toBeVisible({ timeout: 30000 });
      await expect(page.locator('.global-error')).toHaveCount(0);
    });
    const source = new URL('../references/MENS-CAPSULE-WARDROBE-_-CURRENTLY-POPULAR-01.webp', import.meta.url);
    const sourcePath = (await import('node:url')).fileURLToPath(source);
    const crops = [
      { name: 'LIVE TEST reference white tee', category: 'tops', color: 'white', left: 95, top: 143, width: 103, height: 110 },
      { name: 'LIVE TEST reference camp shirt', category: 'tops', color: 'light gray', left: 208, top: 110, width: 92, height: 110 },
      { name: 'LIVE TEST reference cream sweater', category: 'tops', color: 'cream', left: 442, top: 142, width: 108, height: 110 },
      { name: 'LIVE TEST reference jeans', category: 'bottoms', color: 'blue', left: 332, top: 557, width: 63, height: 165 },
      { name: 'LIVE TEST reference sneaker', category: 'shoes', color: 'white', left: 239, top: 768, width: 94, height: 40 },
    ];
    const firstPhoto = await sharp(sourcePath).extract(crops[0]).png().toBuffer();
    const first = await step('Browser uploads a real reference image into a private pending draft', async () => {
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'My Closet' }).click();
      await page.getByRole('button', { name: 'Add a garment', exact: true }).last().click();
      await page.locator('dialog input[type=file]').setInputFiles({ name: 'authorized-reference.png', mimeType: 'image/png', buffer: firstPhoto });
      const upload = page.waitForResponse(r => r.url().endsWith('/api/items') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Upload & review' }).click();
      const response = await upload; if (response.status() !== 201) throw new CheckFailure(response.status());
      const item = await response.json() as Garment; assert.equal(item.user_id, alice.id); assert.equal(item.status, 'pending');
      await expect(page.getByLabel('Garment name')).toBeVisible(); return item;
    });
    await step('Private Storage download/signing and account isolation', async () => {
      assert.ok(first.photoUrl);
      assert.equal((await fetch(first.photoUrl!)).status, 200);
      assert.notEqual((await fetch(`${config.supabaseUrl}/storage/v1/object/public/garment-photos/${first.photo_path}`)).status, 200);
      const access = await bob.db.storage.from('garment-photos').download(first.photo_path!); assert.ok(access.error);
      const sign = await bob.db.storage.from('garment-photos').createSignedUrl(first.photo_path!, 300); assert.ok(sign.error || !sign.data?.signedUrl);
      assert.equal((await fetch(`${apiBase}/items/${first.id}`, { headers: { Authorization: `Bearer ${bob.token}` } })).status, 404);
      const rows = provider(await bob.db.from('wardrobe_items').select('id').eq('id', first.id)); assert.equal(rows.length, 0);
    });
    await step('Separate worker consumes the persistent job and OpenAI returns validated tags', async () => {
      const queued = page.waitForResponse(r => r.url().endsWith(`/items/${first.id}/analyze`) && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Suggest tags with AI' }).click();
      const response = await queued; if (response.status() !== 202) throw new CheckFailure(response.status());
      const deadline = Date.now() + 100000;
      let succeeded = false;
      while (Date.now() < deadline) {
        const state = await api<{ job: { status: string; attempts: number } | null; suggestion: unknown; item: Garment }>(`/items/${first.id}`, alice.token);
        assert.equal(state.item.status, 'pending');
        if (state.job?.status === 'succeeded') { assert.ok(state.suggestion); succeeded = true; break; }
        // Stop promptly on a real model failure, avoiding repeated paid diagnostic calls.
        if (state.job && ['retry', 'failed', 'cancelled'].includes(state.job.status)) throw new CheckFailure(undefined, `worker_${state.job.status}`);
        await delay(1500);
      }
      assert.ok(succeeded); await expect(page.getByText('AI tags are ready for your review', { exact: false })).toBeVisible({ timeout: 15000 });
    });
    await step('Human tag approval is required and persists through the browser/API', async () => {
      operation = 'fill_review_name'; await page.getByLabel('Garment name').fill(crops[0].name);
      operation = 'select_review_category'; await page.getByRole('dialog').getByRole('combobox').first().selectOption('tops');
      operation = 'fill_review_color'; await page.getByLabel('Main color').fill('white');
      const confirmed = page.waitForResponse(r => r.url().endsWith(`/items/${first.id}/confirm`) && r.request().method() === 'PATCH');
      operation = 'submit_review'; await page.getByRole('button', { name: 'Confirm & add to my closet' }).click();
      operation = 'confirm_api_response'; const response = await confirmed; if (response.status() !== 200) throw new CheckFailure(response.status());
      operation = 'review_dialog_closes'; await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 15000 });
      operation = 'confirmed_record_readback';
      const state = await api<{ item: Garment }>(`/items/${first.id}`, alice.token); assert.equal(state.item.status, 'confirmed'); assert.equal(state.item.name, crops[0].name);
      operation = '';
    });
    await step('Prepare four additional clearly labelled reference fixtures for three complete outfits', async () => {
      for (const fixture of crops.slice(1)) {
        const bytes = await sharp(sourcePath).extract(fixture).png().toBuffer(); const form = new FormData();
        form.append('photo', new Blob([new Uint8Array(bytes)], { type: 'image/png' }), 'authorized-reference.png');
        const item = await api<Garment>('/items', alice.token, form, 'POST', 201);
        await api(`/items/${item.id}/confirm`, alice.token, { name: fixture.name, category: fixture.category, color: fixture.color, pattern: 'solid', attributes: [] }, 'PATCH');
      }
    });
    await step('Live OpenAI produces three distinct owned-inventory suggestions through the browser', async () => {
      await page.reload(); await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Outfits', exact: true }).click();
      await page.getByRole('button', { name: 'Suggest with AI' }).click();
      const generated = page.waitForResponse(r => r.url().endsWith('/api/outfits/suggest') && r.request().method() === 'POST', { timeout: 100000 });
      await page.getByRole('dialog').getByRole('button', { name: 'Find my outfits', exact: true }).click();
      const response = await generated; if (response.status() !== 200) throw new CheckFailure(response.status());
      const inventory = await api<{ items: Garment[] }>('/items', alice.token);
      const value = validateRecommendations(await response.json() as Recommendations, inventory.items, alice.id); assert.equal(value.suggestions.length, 3);
      await expect(page.locator('.suggestion-card')).toHaveCount(3);
    });
    const savedId = await step('Save a suggested outfit atomically and reject foreign garment associations', async () => {
      const saved = page.waitForResponse(r => r.url().endsWith('/api/outfits') && r.request().method() === 'POST');
      await page.getByRole('dialog').getByRole('button', { name: 'Save this outfit' }).first().click();
      const response = await saved; if (response.status() !== 201) throw new CheckFailure(response.status());
      const { id } = await response.json() as { id: string };
      const result = await api<{ outfits: SavedOutfit[] }>('/outfits', alice.token); const outfit = result.outfits.find(o => o.id === id); assert.ok(outfit); assert.ok(outfit.outfit_items.length >= 3);
      const payload = { title: outfit.title, explanation: outfit.explanation, occasion: outfit.occasion, style: outfit.style, season: outfit.season, garmentIds: outfit.outfit_items.map(i => i.item_id) };
      await api('/outfits', bob.token, payload, 'POST', 400);
      const direct = await bob.db.rpc('save_outfit', { payload }); assert.ok(direct.error);
      const association = await bob.db.from('outfit_items').insert({ outfit_id: id, item_id: first.id, user_id: bob.id }); assert.ok(association.error);
      return id;
    });
    await step('Explicit browser wear recording, feedback and persisted history', async () => {
      await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.locator('.saved-outfit-card').first().click();
      const worn = page.waitForResponse(r => r.url().endsWith('/api/wear-logs') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'I wore this outfit' }).click();
      if ((await worn).status() !== 201) throw new CheckFailure((await worn).status());
      await page.getByLabel('5 stars', { exact: true }).check(); const feedback = page.waitForResponse(r => r.url().endsWith(`/outfits/${savedId}/feedback`) && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Save feedback' }).click(); if ((await feedback).status() !== 200) throw new CheckFailure((await feedback).status());
      await page.keyboard.press('Escape'); await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Outfits', exact: true }).click(); await page.getByRole('button', { name: 'Wear history', exact: true }).click();
      await expect(page.locator('.history-row')).toHaveCount(1);
      const logs = await api<{ logs: { outfit_id: string }[] }>('/wear-logs', alice.token); assert.equal(logs.logs[0].outfit_id, savedId);
      assert.equal((await api<{ logs: unknown[] }>('/wear-logs', bob.token)).logs.length, 0);
    });
    await step('Browser sign-out removes protected screens and stays signed out after reload', async () => {
      await page.getByRole('button', { name: 'Open account preferences' }).click(); await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Welcome to your wardrobe.' })).toBeVisible({ timeout: 15000 });
      await page.reload(); await expect(page.getByRole('heading', { name: 'Welcome to your wardrobe.' })).toBeVisible(); assert.equal(pageErrors.length, 0);
    });
  } catch { process.exitCode = 1; }
  finally {
    await browser?.close();
    let cleaned = true;
    for (const account of accounts) {
      try {
        // Discover only this run's account paths, including drafts from partial uploads.
        const result = await admin.from('wardrobe_items').select('photo_path').eq('user_id', account.id);
        if (result.error) throw new CheckFailure();
        const paths = result.data.map(r => r.photo_path as string); assert.ok(paths.every(path => path.startsWith(`${account.id}/`)));
        if (paths.length) provider(await admin.storage.from('garment-photos').remove(paths));
        // Explicit child cleanup avoids concurrent Auth FK cascades interacting with
        // the garment-deletion trigger that invalidates saved outfits.
        provider(await admin.from('outfits').delete().eq('user_id', account.id));
        provider(await admin.from('wardrobe_items').delete().eq('user_id', account.id));
        await account.db.auth.signOut(); provider(await admin.auth.admin.deleteUser(account.id));
        const remaining = provider(await admin.from('profiles').select('id').eq('id', account.id)); assert.equal(remaining.length, 0);
      } catch { cleaned = false; }
    }
    report.cleanup = cleaned; report.finishedAt = new Date().toISOString();
    if (!cleaned) { console.info('FAIL: Temporary test-data cleanup needs review.'); process.exitCode = 1; }
    else console.info('PASS: Temporary accounts, photos and application records cleaned up.');
    await mkdir('docs', { recursive: true }); await writeFile('docs/live-workflow-results.json', JSON.stringify(report, null, 2) + '\n');
    console.info('Sanitized verification results saved to docs/live-workflow-results.json.');
  }
}
main().catch(() => { console.error('Live verification stopped; private provider details withheld.'); process.exitCode = 1; });
