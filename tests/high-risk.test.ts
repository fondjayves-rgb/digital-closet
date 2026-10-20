// Actual Express/PostgreSQL/RLS; simulated identity, bytes/signing and AI. No hosted calls.
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../apps/api/src/app';
import { HttpError } from '../apps/api/src/errors';
import { processNextJob } from '../apps/api/src/jobs';
import { database, asUser, garment, ALICE, BOB } from './database';
import { testClient } from './adapter';
import { inventorySchema } from '../packages/shared/src/index';
import provided from '../packages/shared/src/provided-inventory.json';

let db: PGlite; let app: ReturnType<typeof createApp>; let photo: Buffer;
const photos = new Map<string, Buffer>();
const ai = { recognize: vi.fn(), suggest: vi.fn() };
let storageFault: 'upload' | 'remove' | 'sign' | '' = '';
const auth = (who = 'alice') => ({ Authorization: `Bearer ${who}` });
const input = (patch: Record<string, unknown> = {}) => inventorySchema.parse({ name: 'PHASE2 TEST item', category: 'tops', color: null, pattern: 'unknown', attributes: [], ...patch });
const look = (ids: string[], patch = {}) => ({ title: 'PHASE2 TEST look', occasion: 'Everyday', style: 'Simple', season: 'all-season', explanation: 'Isolated fixture.', garmentIds: ids, confirmedComplete: true, ...patch });
function client(userId: string): SupabaseClient {
  const result = testClient(db, userId, photos);
  const from = result.storage.from.bind(result.storage);
  result.storage.from = ((...args: Parameters<typeof from>) => {
    const storage = from(...args);
    for (const [method, fault] of [['upload', 'upload'], ['remove', 'remove'], ['createSignedUrls', 'sign']] as const) {
      const original = storage[method].bind(storage);
      (storage as any)[method] = (...values: unknown[]) => storageFault === fault ? Promise.resolve({ data: null, error: { message: 'Isolated storage fault' } }) : (original as any)(...values);
    }
    return storage;
  }) as typeof result.storage.from;
  return result;
}
beforeAll(async () => {
  db = await database(); photo = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ddd' } }).png().toBuffer();
  app = createApp({ config: { port: 3001, webOrigin: 'http://127.0.0.1:5173', supabaseUrl: 'https://isolated.invalid', publishableKey: 'test', secretKey: 'test', openaiKey: 'test', model: 'test' }, ai,
    authenticate: async token => { if (!['alice', 'bob'].includes(token)) throw new HttpError(401, 'Expired or invalid fixture session'); const userId = token === 'alice' ? ALICE : BOB; return { userId, db: client(userId) }; } });
}, 60000);
afterAll(async () => { await db?.close(); });
async function manual(patch: Record<string, unknown> = {}, who = 'alice') {
  const result = await request(app).post('/api/items/manual').set(auth(who)).send({ ...input(patch), confirmed: true }); expect(result.status).toBe(201); return result.body as { id: string };
}
async function saved(ids: string[]) { const result = await request(app).post('/api/outfits/manual').set(auth()).send(look(ids)); expect(result.status).toBe(201); return result.body.id as string; }

it('checks all new RPC privileges and thirteen-table anonymous denial without relying only on RLS flags', async () => {
  const names = ['set_item_collections','save_inventory','valid_outfit_selection','write_saved_outfit','save_manual_outfit','write_template','commit_wardrobe_import','wardrobe_update_version','list_inventory'];
  const functions = await db.query<{ proname: string; prosecdef: boolean; anon: boolean; owner: boolean }>("select proname,prosecdef,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname=any($1)", [names]);
  expect(functions.rows).toHaveLength(9); expect(functions.rows.every(f => !f.prosecdef && !f.anon && f.owner)).toBe(true);
  const tables = (await db.query<{ tablename: string }>("select tablename from pg_tables where schemaname='public'")).rows;
  expect(tables).toHaveLength(13);
  for (const { tablename } of tables) await expect(db.transaction(async tx => { await tx.exec('set local role anon'); return tx.query(`select * from public.${tablename}`); })).rejects.toThrow();
});
it('rejects forged new-association ownership and hides existing new-table data from another user', async () => {
  const own = await manual({ collections: ['PHASE2 TEST private'] });
  const template = await asUser(db, ALICE, tx => tx.query<{ id: string }>('select public.write_template($1::jsonb) id', [JSON.stringify({ title: 'PHASE2 TEST plan', occasion: 'Sport', notes: '', components: [{ label: 'Owned', item_id: own.id }] })]));
  await asUser(db, ALICE, tx => tx.query('select public.commit_wardrobe_import($1::jsonb)', [JSON.stringify({ key: 'phase2-link', kind: 'item', action: 'link', existingId: own.id, data: { collections: [] } })]));
  for (const table of ['collections','item_collections','outfit_templates','template_components','wardrobe_import_entries']) expect((await asUser(db, BOB, tx => tx.query(`select * from public.${table} where user_id=$1`, [ALICE]))).rows).toEqual([]);
  await expect(asUser(db, BOB, tx => tx.query("insert into public.wardrobe_import_entries(user_id,import_id,source_key,item_id) values($1,'provided-wardrobe-v1','forged-link',$2)", [BOB, own.id]))).rejects.toThrow();
  expect((await request(app).delete(`/api/templates/${template.rows[0].id}`).set(auth('bob'))).status).toBe(404);
  expect((await request(app).patch(`/api/templates/${template.rows[0].id}`).set(auth('bob')).send({ title: 'Wrong', occasion: 'Sport', notes: '', components: [] })).status).toBe(404);
  expect((await request(app).get('/api/templates').set(auth())).body.templates.some((t: { id: string }) => t.id === template.rows[0].id)).toBe(true);
});
it('rolls back a stale outfit edit without replacing associations, feedback or wear history', async () => {
  const first = await manual(), second = await manual(); const id = await saved([first.id]);
  expect((await request(app).post('/api/wear-logs').set(auth()).send({ outfitId: id, wornOn: new Date().toISOString().slice(0, 10) })).status).toBe(201);
  expect((await request(app).post(`/api/outfits/${id}/feedback`).set(auth()).send({ rating: 4, comment: 'Keep this' })).status).toBe(200);
  const oldVersion = (await db.query<{ version: string }>('select to_jsonb(updated_at) version from public.outfits where id=$1', [id])).rows[0].version;
  expect((await request(app).patch(`/api/outfits/${id}`).set(auth()).send({ ...look([first.id], { title: 'Current edited look' }), expectedUpdatedAt: oldVersion })).status).toBe(200);
  const response = await request(app).patch(`/api/outfits/${id}`).set(auth()).send({ ...look([second.id], { title: 'Must not replace' }), expectedUpdatedAt: oldVersion });
  expect(response.status).toBe(400);
  const record = (await request(app).get('/api/outfits').set(auth())).body.outfits.find((o: { id: string }) => o.id === id);
  expect(record.title).toBe('Current edited look'); expect(record.outfit_items).toEqual([{ item_id: first.id }]); expect(record.outfit_feedback[0]).toMatchObject({ rating: 4, comment: 'Keep this' });
  expect((await db.query('select id from public.wear_logs where outfit_id=$1', [id])).rows).toHaveLength(1);
});
it('rejects malformed expectedUpdatedAt as input rather than reporting a database outage', async () => {
  const own = await manual(); const id = await saved([own.id]);
  expect((await request(app).patch(`/api/outfits/${id}`).set(auth()).send({ ...look([own.id]), expectedUpdatedAt: 'not-a-timestamp' })).status).toBe(400);
});
it('enforces manual selection bounds at both API and transactional SQL boundaries', async () => {
  const ids: string[] = []; for (let n = 0; n < 21; n++) ids.push((await manual()).id);
  for (const selected of [[], ids]) {
    expect((await request(app).post('/api/outfits/manual').set(auth()).send(look(selected))).status).toBe(400);
    await expect(asUser(db, ALICE, tx => tx.query('select public.save_manual_outfit($1::jsonb)', [JSON.stringify(look(selected))]))).rejects.toThrow();
  }
  expect((await request(app).post('/api/outfits/manual').set(auth()).send(look(ids.slice(0, 20)))).status).toBe(201);
});
it('validates wear duplicates/dates and every rating without losing saved feedback', async () => {
  const own = await manual(); const id = await saved([own.id]); const today = new Date().toISOString().slice(0, 10);
  for (const wornOn of ['', 'not-a-date', '2999-01-01']) expect((await request(app).post('/api/wear-logs').set(auth()).send({ outfitId: id, wornOn })).status).toBe(400);
  expect((await request(app).post('/api/wear-logs').set(auth()).send({ outfitId: id, wornOn: today })).status).toBe(201);
  expect((await request(app).post('/api/wear-logs').set(auth()).send({ outfitId: id, wornOn: today })).status).toBe(409);
  for (const rating of [0, 6, 1.5]) expect((await request(app).post(`/api/outfits/${id}/feedback`).set(auth()).send({ rating, comment: '' })).status).toBe(400);
  for (const rating of [1,2,3,4,5]) expect((await request(app).post(`/api/outfits/${id}/feedback`).set(auth()).send({ rating, comment: 'x'.repeat(500) })).status).toBe(200);
  expect((await request(app).post(`/api/outfits/${id}/feedback`).set(auth()).send({ rating: 1, comment: 'x'.repeat(501) })).status).toBe(400);
  const feedback = (await db.query<{ rating: number; comment: string }>('select rating,comment from public.outfit_feedback where outfit_id=$1', [id])).rows;
  expect(feedback).toHaveLength(1); expect(feedback[0].rating).toBe(5); expect(feedback[0].comment.length).toBe(500);
});
it('retains history on garment deletion, cascades outfit deletion and keeps unrelated owned data', async () => {
  const own = await manual(), keep = await manual(); const id = await saved([own.id]);
  await request(app).post('/api/wear-logs').set(auth()).send({ outfitId: id, wornOn: new Date().toISOString().slice(0, 10) });
  await request(app).post(`/api/outfits/${id}/feedback`).set(auth()).send({ rating: 5, comment: '' });
  const wearId = (await db.query<{ id: string }>('select id from public.wear_logs where outfit_id=$1', [id])).rows[0].id;
  expect((await request(app).delete(`/api/wear-logs/${wearId}`).set(auth('bob'))).status).toBe(404);
  expect((await request(app).delete(`/api/outfits/${id}`).set(auth('bob'))).status).toBe(404);
  expect((await request(app).delete(`/api/items/${own.id}`).set(auth())).status).toBe(204);
  expect((await db.query('select id from public.wear_logs where outfit_id=$1', [id])).rows).toHaveLength(1);
  expect((await db.query<{ invalidated: boolean }>('select invalidated from public.outfits where id=$1', [id])).rows[0].invalidated).toBe(true);
  expect((await request(app).post('/api/wear-logs').set(auth()).send({ outfitId: id, wornOn: new Date().toISOString().slice(0, 10) })).status).toBe(409);
  expect((await request(app).delete(`/api/outfits/${id}`).set(auth())).status).toBe(204);
  for (const table of ['outfit_items','outfit_feedback','wear_logs']) expect((await db.query(`select * from public.${table} where outfit_id=$1`, [id])).rows).toHaveLength(0);
  expect((await db.query('select id from public.wardrobe_items where id=$1', [keep.id])).rows).toHaveLength(1);
  expect((await request(app).delete(`/api/outfits/${id}`).set(auth())).status).toBe(404);
});
it('template deletion preserves inventory and import tombstones without silently recreating plans', async () => {
  const entry = provided.find(e => e.kind === 'template')!; const own = await manual();
  const body = { entries: [{ key: entry.key, action: 'create', reviewed: true, data: entry.template }] };
  const imported = await request(app).post('/api/import/commit').set(auth()).send(body); const id = imported.body.results[0].id;
  expect((await request(app).patch(`/api/templates/${id}`).set(auth()).send({ ...entry.template, components: [{ label: 'Owned', item_id: own.id }] })).status).toBe(200);
  expect((await request(app).delete(`/api/templates/${id}`).set(auth())).status).toBe(204);
  expect((await request(app).post('/api/import/commit').set(auth()).send(body)).body.results[0].status).toBe('skipped');
  expect((await db.query('select id from public.wardrobe_items where id=$1', [own.id])).rows).toHaveLength(1);
});
it('retries only unresolved mixed-batch imports and leaves skip decisions uncommitted', async () => {
  const entries = provided.filter(e => e.kind === 'item').slice(10, 13);
  const row = (n: number, data = entries[n].item) => ({ key: entries[n].key, action: 'create', reviewed: true, data });
  const result = await request(app).post('/api/import/commit').set(auth()).send({ entries: [row(0), row(1, { ...entries[1].item!, name: '' }), { ...row(2), action: 'skip' }] });
  expect(result.body.results.map((r: { status: string }) => r.status)).toEqual(['created','failed','skipped']);
  const retried = await request(app).post('/api/import/commit').set(auth()).send({ entries: [row(0),row(1),row(2)] });
  expect(retried.body.results.map((r: { status: string }) => r.status)).toEqual(['skipped','created','created']);
});
it('rejects changed inventory after simulated AI latency and sanitizes malformed provider output', async () => {
  // Use Bob's otherwise empty confirmed closet to bound capacity to one.
  const ids: string[] = []; for (const category of ['tops','bottoms','shoes']) ids.push(await garment(db, BOB, category));
  const value = { suggestions: [{ title: 'Isolated AI', explanation: 'No paid call.', garmentIds: ids }], inventoryNote: '' };
  ai.suggest.mockImplementationOnce(async () => { await asUser(db, BOB, tx => tx.query('delete from public.wardrobe_items where id=$1', [ids[2]])); return value; });
  expect((await request(app).post('/api/outfits/suggest').set(auth('bob')).send({ occasion: 'Work', style: 'Simple', season: 'all-season' })).status).toBe(409);
  await garment(db, BOB, 'shoes'); ai.suggest.mockRejectedValueOnce(new Error('SENSITIVE_FIXTURE_ERROR_DO_NOT_SERIALIZE'));
  const response = await request(app).post('/api/outfits/suggest').set(auth('bob')).send({ occasion: 'Work', style: 'Simple', season: 'all-season' });
  expect(response.status).toBe(502); expect(response.text).not.toContain('SENSITIVE_FIXTURE_ERROR');
  expect((await db.query('select id from public.outfits where user_id=$1', [BOB])).rows).toHaveLength(0);
});
it('rolls back failed uploads, keeps signing failures recoverable and refuses failed photo deletion', async () => {
  const before = photos.size; storageFault = 'upload';
  expect((await request(app).post('/api/items').set(auth()).attach('photo', photo, 'test.png')).status).toBe(503); expect(photos.size).toBe(before);
  const beforeRows = (await db.query('select id from public.wardrobe_items')).rows.length;
  storageFault = 'sign'; expect((await request(app).post('/api/items').set(auth()).attach('photo', photo, 'test.png')).status).toBe(503);
  expect((await db.query('select id from public.wardrobe_items')).rows.length).toBe(beforeRows + 1);
  storageFault = ''; const uploaded = await request(app).post('/api/items').set(auth()).attach('photo', photo, 'test.png'); expect(uploaded.status).toBe(201);
  storageFault = 'remove'; expect((await request(app).delete(`/api/items/${uploaded.body.id}`).set(auth())).status).toBe(503);
  expect(photos.has(uploaded.body.photo_path)).toBe(true); expect((await db.query('select id from public.wardrobe_items where id=$1', [uploaded.body.id])).rows).toHaveLength(1);
  storageFault = ''; expect((await request(app).delete(`/api/items/${uploaded.body.id}`).set(auth())).status).toBe(204); expect(photos.has(uploaded.body.photo_path)).toBe(false);
});
it('sanitizes worker errors without confirming inventory or storing invalid proposals', async () => {
  // Cancel earlier recoverable upload drafts' jobs (none were enqueued); enqueue one controlled job.
  const id = await garment(db, ALICE, null, 'pending'); const path = `${ALICE}/${id}.webp`; photos.set(path, photo);
  await asUser(db, ALICE, tx => tx.query('insert into public.ai_tag_jobs(user_id,item_id) values($1,$2)', [ALICE,id]));
  ai.recognize.mockRejectedValueOnce(new Error('SENSITIVE_FIXTURE_ERROR_DO_NOT_SERIALIZE'));
  expect(await processNextJob(testClient(db, null, photos), ai)).toBe(true);
  const job = (await db.query<{ status: string; last_error: string }>('select status,last_error from public.ai_tag_jobs where item_id=$1', [id])).rows[0];
  expect(job.status).toBe('retry'); expect(job.last_error).not.toContain('SENSITIVE_FIXTURE_ERROR');
  expect((await db.query<{ status: string }>('select status from public.wardrobe_items where id=$1', [id])).rows[0].status).toBe('pending');
  expect((await db.query('select id from public.tag_suggestions where item_id=$1', [id])).rows).toHaveLength(0);
});
it('enforces list bounds and rejects expired fixture tokens before any mutation', async () => {
  for (const query of ['limit=1','limit=200','offset=0']) expect((await request(app).get(`/api/items?${query}`).set(auth())).status).toBe(200);
  for (const query of ['limit=0','limit=201','offset=-1']) expect((await request(app).get(`/api/items?${query}`).set(auth())).status).toBe(400);
  const before = (await db.query('select id from public.wardrobe_items')).rows.length;
  expect((await request(app).post('/api/items/manual').set(auth('expired')).send({ ...input(), confirmed: true })).status).toBe(401);
  expect((await db.query('select id from public.wardrobe_items')).rows.length).toBe(before);
});
