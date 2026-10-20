// Opt-in hosted verification. Only disposable accounts are mutated; no model calls.
// Run: npx.cmd tsx --env-file=apps/api/.env tests/verify-inventory-update-live.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../apps/api/src/app.js';
import { readConfig } from '../apps/api/src/config.js';
import { inventorySchema } from '../packages/shared/src/index.js';

const config = readConfig();
const app = createApp(); // Real Auth, user-token database/Storage, application routes.
const client = (key: string) => createClient(config.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = client(config.secretKey);
const users: { id: string; db: SupabaseClient; token: string }[] = [];
const photoPaths: string[] = [];
const report: { checkedAt: string; boundary: string; checks: { name: string; passed: boolean; status?: number; code?: string }[]; cleanup?: boolean } = {
  checkedAt: new Date().toISOString(), boundary: 'Live Supabase Auth, database, private Storage and actual Express routes. No browser, email-delivery or OpenAI calls.', checks: [],
};
function checked<R extends { data: unknown; error: { status?: number; code?: string } | null }>(result: R): NonNullable<R['data']> {
  if (result.error) throw result.error;
  assert.ok(result.data !== null && result.data !== undefined);
  return result.data as NonNullable<R['data']>;
}
async function step<T>(name: string, action: () => Promise<T>): Promise<T> {
  try { const value = await action(); report.checks.push({ name, passed: true }); console.info(`PASS: ${name}`); return value; }
  catch (error) {
    const e = error as { status?: number; code?: string };
    const code = e.code && /^[a-z0-9_]{1,80}$/i.test(e.code) ? e.code : undefined;
    report.checks.push({ name, passed: false, status: e.status, code }); console.info(`FAIL: ${name}${code ? ` [${code}]` : ''}`);
    throw new Error('Verification failed; private response details withheld.');
  }
}
const auth = (index = 0) => ({ Authorization: `Bearer ${users[index].token}` });
const itemInput = (patch: Record<string, unknown> = {}) => inventorySchema.parse({ name: 'LIVE UPDATE TEST text record', category: 'tops', color: null, pattern: 'unknown', attributes: [], ...patch });
async function manual(patch: Record<string, unknown> = {}, index = 0) {
  const response = await request(app).post('/api/items/manual').set(auth(index)).send({ ...itemInput(patch), confirmed: true });
  assert.equal(response.status, 201); return response.body as { id: string; photo_path: string | null; status: string; quantity: number | null; color: string | null };
}
const look = (ids: string[]) => ({ title: 'LIVE UPDATE TEST finished look', occasion: 'Training', style: 'Comfort', season: 'all-season', explanation: 'Explicit technical verification; no AI claim.', garmentIds: ids, confirmedComplete: true });
function status(response: { status: number }, expected: number, operation: string) {
  if (response.status !== expected) throw { code: `${operation}_HTTP_${response.status}_expected_${expected}` };
}

async function main() {
  try {
    await step('Two disposable real Auth accounts and password sessions', async () => {
      for (let index = 0; index < 2; index++) {
        const email = `wardrobe-update-${randomUUID()}@example.test`, password = `${randomUUID()}Aa!9`;
        const created = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
        const db = client(config.publishableKey);
        assert.ok(created.user);
        const user = { id: created.user.id, db, token: '' }; users.push(user);
        user.token = checked(await db.auth.signInWithPassword({ email, password })).session!.access_token;
      }
    });
    await step('Authenticated capability and curated inspiration endpoints', async () => {
      assert.equal((await request(app).get('/api/capabilities').set(auth())).body.inventoryUpdate, true);
      const source = await request(app).get('/api/inspiration').set(auth());
      assert.equal(source.status, 200); assert.equal(source.body.cards.length, 4); assert.equal(source.body.mode, 'curated');
    });
    const own = await step('Reviewed text inventory, unknown metadata, grouped quantities and collections', async () => {
      const value = await manual({ category: 'sets', pack_count: 1, pack_description: 'Technical fixture; unspecified contents', collections: ['LIVE UPDATE TEST Daily'] });
      assert.equal(value.photo_path, null); assert.equal(value.quantity, null); assert.equal(value.color, null); assert.equal(value.status, 'confirmed');
      return value;
    });
    const foreign = await step('Other-account fixture remains isolated', () => manual({ name: 'LIVE UPDATE TEST other account', collections: ['LIVE UPDATE TEST Private'] }, 1));
    await step('Explicit Favorites persistence and cross-account rejection', async () => {
      assert.equal((await request(app).patch(`/api/items/${own.id}/favorite`).set(auth()).send({ is_favorite: true })).status, 200);
      const favorites = await request(app).get('/api/items?favorite=true').set(auth()); assert.equal(favorites.body.items[0].id, own.id);
      assert.equal((await request(app).patch(`/api/items/${own.id}/favorite`).set(auth(1)).send({ is_favorite: false })).status, 404);
      assert.equal((await users[1].db.from('wardrobe_items').select('id').eq('id', own.id)).data?.length, 0);
    });
    await step('Settings persist optional gender and default occasion for the owner', async () => {
      const settings = { display_name: 'LIVE UPDATE TEST', style_preferences: 'Comfort', gender: null, gender_description: '', default_occasion: 'Training' };
      assert.equal((await request(app).patch('/api/profile').set(auth()).send(settings)).status, 200);
      assert.equal((await request(app).get('/api/profile').set(auth())).body.default_occasion, 'Training');
      assert.equal((await request(app).get('/api/profile').set(auth(1))).body.default_occasion, '');
    });
    await step('No-photo analysis rejected at API and database enqueue boundaries', async () => {
      assert.equal((await request(app).post(`/api/items/${own.id}/analyze`).set(auth())).status, 409);
      const pending = checked(await users[0].db.from('wardrobe_items').insert({ user_id: users[0].id, name: 'LIVE UPDATE TEST no-photo pending' }).select('id').single());
      const queued = await users[0].db.from('ai_tag_jobs').insert({ user_id: users[0].id, item_id: pending.id, available_at: new Date(Date.now() + 3600000).toISOString() }); assert.ok(queued.error);
    });
    await step('Private photo attachment preserves inventory ID and review status', async () => {
      const record = await manual({ name: 'LIVE UPDATE TEST neutral technical swatch' });
      const path = `${users[0].id}/${record.id}.webp`; photoPaths.push(path);
      // A neutral test swatch, not a garment photo or recognition-quality claim.
      const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ddd' } }).png().toBuffer();
      const attached = await request(app).post(`/api/items/${record.id}/photo`).set(auth()).attach('photo', bytes, 'technical-swatch.png');
      assert.equal(attached.status, 200); assert.equal(attached.body.id, record.id); assert.equal(attached.body.status, 'confirmed');
      assert.equal((await fetch(attached.body.photoUrl)).status, 200);
      assert.equal((await fetch(`${config.supabaseUrl}/storage/v1/object/public/garment-photos/${path}`)).ok, false);
      assert.ok((await users[1].db.storage.from('garment-photos').download(path)).error);
      assert.equal((await request(app).delete(`/api/items/${record.id}`).set(auth())).status, 204);
      assert.ok((await users[0].db.storage.from('garment-photos').download(path)).error);
    });
    await step('Server-side filtering and pagination with collection metadata', async () => {
      for (let n = 0; n < 3; n++) await manual({ name: `LIVE UPDATE TEST pagination ${n}`, category: 'socks', brand: 'Technical fixture', quantity: 2, quantity_unit: 'pairs', collections: ['LIVE UPDATE TEST Daily'] });
      const page = await request(app).get('/api/items?brand=Technical%20fixture&limit=2').set(auth());
      assert.equal(page.status, 200); assert.equal(page.body.total, 3); assert.equal(page.body.nextOffset, 2); assert.equal(page.body.items.length, 2);
      const next = await request(app).get('/api/items?brand=Technical%20fixture&limit=2&offset=2').set(auth()); assert.equal(next.body.items.length, 1);
    });
    const preview = await step('Provided inventory preview is read-only and source-keyed', async () => {
      const response = await request(app).get('/api/import/preview').set(auth()); assert.equal(response.status, 200); assert.equal(response.body.entries.length, 100);
      return response.body.entries as { key: string; kind: string; item?: Record<string, unknown>; template?: Record<string, unknown> }[];
    });
    await step('Concurrent import is idempotent and deletion leaves a ledger tombstone', async () => {
      const entry = preview.find(e => e.kind === 'item')!;
      const body = { entries: [{ key: entry.key, action: 'create', reviewed: true, data: entry.item }] };
      const responses = await Promise.all([request(app).post('/api/import/commit').set(auth()).send(body), request(app).post('/api/import/commit').set(auth()).send(body)]);
      const results = responses.map(r => r.body.results[0]); assert.deepEqual(results.map(r => r.status).sort(), ['created', 'skipped']);
      assert.equal((await request(app).delete(`/api/items/${results.find(r => r.id).id}`).set(auth())).status, 204);
      assert.equal((await request(app).post('/api/import/commit').set(auth()).send(body)).body.results[0].status, 'skipped');
    });
    await step('Linking adds collections without replacing owned metadata', async () => {
      const entry = preview.filter(e => e.kind === 'item')[1];
      const response = await request(app).post('/api/import/commit').set(auth()).send({ entries: [{ key: entry.key, action: 'link', reviewed: true, existingId: own.id, data: { ...entry.item, collections: ['LIVE UPDATE TEST Linked'] } }] });
      assert.equal(response.body.results[0].status, 'linked');
      const record = checked(await users[0].db.from('wardrobe_items').select('name,quantity').eq('id', own.id).single()); assert.equal(record.name, 'LIVE UPDATE TEST text record'); assert.equal(record.quantity, null);
    });
    const templateId = await step('Missing-component templates stay separate and can be resolved', async () => {
      const entry = preview.find(e => e.kind === 'template')!;
      const result = await request(app).post('/api/import/commit').set(auth()).send({ entries: [{ key: entry.key, action: 'create', reviewed: true, data: entry.template }] }); assert.equal(result.body.results[0].status, 'created');
      const id = result.body.results[0].id as string;
      const plans = await request(app).get('/api/templates').set(auth()); assert.ok(plans.body.templates.find((t: { id: string }) => t.id === id));
      assert.equal((await request(app).patch(`/api/templates/${id}`).set(auth()).send({ title: 'LIVE UPDATE TEST resolved plan', occasion: 'Training', notes: '', components: [{ label: 'Reviewed set', item_id: own.id }] })).status, 200);
      return id;
    });
    const outfitId = await step('Flexible manual outfit saves only with explicit completeness', async () => {
      assert.equal((await request(app).post('/api/outfits/manual').set(auth()).send({ ...look([own.id]), confirmedComplete: false })).status, 400);
      assert.equal((await request(app).post('/api/outfits/manual').set(auth()).send(look([foreign.id]))).status, 400);
      const result = await request(app).post('/api/outfits/manual').set(auth()).send(look([own.id])); assert.equal(result.status, 201); return result.body.id as string;
    });
    await step('Atomic outfit edit retains wear history and feedback', async () => {
      status(await request(app).post('/api/wear-logs').set(auth()).send({ outfitId, wornOn: new Date().toISOString().slice(0, 10) }), 201, 'wear');
      status(await request(app).post(`/api/outfits/${outfitId}/feedback`).set(auth()).send({ rating: 5, comment: 'Temporary update check' }), 200, 'feedback');
      status(await request(app).patch(`/api/outfits/${outfitId}`).set(auth()).send({ ...look([own.id]), title: 'LIVE UPDATE TEST edited look' }), 200, 'edit');
      const embedded = checked(await users[0].db.from('outfits').select('outfit_feedback(rating,comment)').eq('id', outfitId).single());
      console.info(`INFO: Live feedback relationship shape: ${Array.isArray(embedded.outfit_feedback) ? 'array' : typeof embedded.outfit_feedback}`);
      const outfits = await request(app).get('/api/outfits').set(auth()); assert.equal(outfits.body.outfits.find((o: { id: string }) => o.id === outfitId).outfit_feedback[0].rating, 5);
      assert.equal((await request(app).get('/api/wear-logs').set(auth())).body.logs.length, 1);
    });
    await step('AI save validation accepts explicit reviewed sets, rejects unknown coverage', async () => {
      const shoes = await manual({ category: 'shoes' });
      const unknown = await users[0].db.rpc('save_outfit', { payload: look([own.id, shoes.id]) }); assert.ok(unknown.error);
      const set = await manual({ category: 'suits', set_coverage: 'top-bottom' });
      assert.ok(checked(await users[0].db.rpc('save_outfit', { payload: look([set.id, shoes.id]) })));
    });
    await step('Cross-owner collection/template/import associations are rejected', async () => {
      const collection = checked(await users[1].db.from('collections').select('id').single());
      assert.ok((await users[0].db.from('item_collections').insert({ user_id: users[0].id, item_id: own.id, collection_id: collection.id })).error);
      assert.ok((await users[0].db.rpc('write_template', { target: templateId, payload: { title: 'LIVE UPDATE TEST foreign link', occasion: 'Training', notes: '', components: [{ label: 'foreign', item_id: foreign.id }] } })).error);
      assert.ok((await users[0].db.from('wardrobe_import_entries').delete().eq('import_id', 'provided-wardrobe-v1')).error);
    });
  } catch { process.exitCode = 1; }
  finally {
    let cleanup = true;
    try { if (photoPaths.length) { const result = await admin.storage.from('garment-photos').remove(photoPaths); if (result.error) throw result.error; } } catch { cleanup = false; }
    for (const user of users) {
      try {
        await user.db.auth.signOut(); checked(await admin.auth.admin.deleteUser(user.id));
        assert.ok((await admin.auth.admin.getUserById(user.id)).error);
        for (const table of ['profiles', 'wardrobe_items', 'outfits', 'wear_logs', 'outfit_feedback', 'collections', 'item_collections', 'outfit_templates', 'template_components', 'wardrobe_import_entries']) {
          const result = await admin.from(table).select('*', { count: 'exact', head: true }).eq(table === 'profiles' ? 'id' : 'user_id', user.id); assert.equal(result.error, null); assert.equal(result.count, 0);
        }
      } catch { cleanup = false; }
    }
    report.cleanup = cleanup; if (!cleanup) process.exitCode = 1;
    console.info(`${cleanup ? 'PASS' : 'FAIL'}: Disposable accounts, new relationships and technical swatch cleanup`);
    await writeFile(process.argv.includes('--phase2') ? 'docs/workshop-5-4-live-results.json' : 'docs/inventory-update-live-results.json', JSON.stringify(report, null, 2) + '\n');
  }
}
main().catch(() => { console.error('Live update verification stopped; private details withheld.'); process.exitCode = 1; });
