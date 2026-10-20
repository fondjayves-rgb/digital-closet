// Live verification of the approved trigger fix. Only disposable accounts are mutated.
// No photos or OpenAI calls are needed for this database-focused check.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { readConfig } from '../apps/api/src/config.js';
const config = readConfig();
const report: { checkedAt: string; live: boolean; checks: { name: string; passed: boolean; status?: number; code?: string }[]; cleanup?: boolean } = { checkedAt: new Date().toISOString(), live: true, checks: [] };
function checked<R extends { data: unknown; error: { status?: number; code?: string } | null }>(result: R): NonNullable<R['data']> {
  if (result.error) throw result.error;
  if (result.data === null || result.data === undefined) throw new Error('Missing verification result');
  return result.data as NonNullable<R['data']>;
}
async function step<T>(name: string, action: () => Promise<T>) {
  try { const value = await action(); report.checks.push({ name, passed: true }); console.info(`PASS: ${name}`); return value; }
  catch (error) {
    const e = error as { status?: number; code?: string }; const code = e.code && /^[a-z0-9_]{1,80}$/i.test(e.code) ? e.code : undefined;
    report.checks.push({ name, passed: false, status: e.status, code }); console.info(`FAIL: ${name}${e.status ? ` (HTTP ${e.status})` : ''}${code ? ` [${code}]` : ''}`); throw new Error('Verification failed; private details withheld.');
  }
}
const create = (key: string) => createClient(config.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function main() {
  const admin = create(config.secretKey);
  const users: { id: string; db: SupabaseClient; deleted: boolean }[] = [];
  try {
    await step('Create two disposable accounts with real password sessions', async () => {
      for (let index = 0; index < 2; index++) {
        const email = `wardrobe-fix-${randomUUID()}@example.test`; const password = `${randomUUID()}Aa!9`;
        const created = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true })); assert.ok(created.user);
        const db = create(config.publishableKey); users.push({ id: created.user.id, db, deleted: false });
        const login = checked(await db.auth.signInWithPassword({ email, password })); assert.ok(login.session);
      }
    });
    async function prepare(user: (typeof users)[number]) {
      const items = ['tops', 'bottoms', 'shoes'].map(category => { const id = randomUUID(); return { id, user_id: user.id, photo_path: `${user.id}/${id}.webp`, name: `LIVE FIX TEST ${category}`, category, color: 'ivory', pattern: 'solid', attributes: [], status: 'confirmed' }; });
      checked(await user.db.from('wardrobe_items').insert(items).select('id'));
      const payload = { title: 'LIVE FIX TEST outfit', explanation: 'Synthetic database verification records; no AI claim.', occasion: 'Everyday', style: 'Simple', season: 'all-season', garmentIds: items.map(item => item.id) };
      const outfitId = checked(await user.db.rpc('save_outfit', { payload })) as string;
      checked(await user.db.from('wear_logs').insert({ user_id: user.id, outfit_id: outfitId, worn_on: new Date().toISOString().slice(0, 10) }).select('id'));
      checked(await user.db.from('outfit_feedback').insert({ user_id: user.id, outfit_id: outfitId, rating: 4, comment: 'Temporary trigger verification' }).select('id'));
      return { itemIds: items.map(item => item.id), outfitId };
    }
    const alice = await step('Create complete saved outfits, wear history and feedback for account one', () => prepare(users[0]));
    const bob = await step('Create separate owned records for account two', () => prepare(users[1]));
    await step('Manual tag confirmation still cancels queued work', async () => {
      const id = randomUUID(); const owner = users[0];
      checked(await owner.db.from('wardrobe_items').insert({ id, user_id: owner.id, photo_path: `${owner.id}/${id}.webp`, name: 'LIVE FIX TEST pending draft' }).select('id'));
      // Schedule in the future so the running worker cannot consume this test job.
      const job = checked(await owner.db.from('ai_tag_jobs').insert({ item_id: id, user_id: owner.id, available_at: new Date(Date.now() + 3600000).toISOString() }).select('id').single());
      checked(await owner.db.from('wardrobe_items').update({ status: 'confirmed', category: 'tops', color: 'white' }).eq('id', id).select('id').single());
      const result = checked(await owner.db.from('ai_tag_jobs').select('status').eq('id', job.id).single()); assert.equal(result.status, 'cancelled');
    });
    await step('Direct Auth account deletion succeeds with saved outfits and history', async () => {
      await users[0].db.auth.signOut(); checked(await admin.auth.admin.deleteUser(users[0].id)); users[0].deleted = true;
      for (const table of ['profiles', 'wardrobe_items', 'ai_tag_jobs', 'tag_suggestions', 'outfits', 'outfit_items', 'wear_logs', 'outfit_feedback']) {
        const result = await admin.from(table).select('*', { head: true, count: 'exact' }).eq(table === 'profiles' ? 'id' : 'user_id', users[0].id);
        if (result.error) throw result.error; assert.equal(result.count, 0);
      }
      const removed = checked(await admin.from('outfits').select('id').eq('id', alice.outfitId)); assert.equal(removed.length, 0);
    });
    await step('Deleting one account leaves the other account and its records intact', async () => {
      const outfit = checked(await users[1].db.from('outfits').select('id,invalidated').eq('id', bob.outfitId).single()); assert.equal(outfit.invalidated, false);
      const rows = checked(await users[1].db.from('wardrobe_items').select('id')); assert.equal(rows.length, 3);
    });
    await step('Ordinary garment deletion invalidates saved outfit and preserves wear history', async () => {
      checked(await users[1].db.from('wardrobe_items').delete().eq('id', bob.itemIds[0]).select('id').single());
      const outfit = checked(await users[1].db.from('outfits').select('invalidated').eq('id', bob.outfitId).single()); assert.equal(outfit.invalidated, true);
      const history = checked(await users[1].db.from('wear_logs').select('id').eq('outfit_id', bob.outfitId)); assert.equal(history.length, 1);
      const feedback = checked(await users[1].db.from('outfit_feedback').select('id').eq('outfit_id', bob.outfitId)); assert.equal(feedback.length, 1);
    });
  } catch { process.exitCode = 1; }
  finally {
    let cleanup = true;
    for (const user of users) {
      try {
        await user.db.auth.signOut();
        if (!user.deleted) { checked(await admin.auth.admin.deleteUser(user.id)); user.deleted = true; }
        const result = await admin.auth.admin.getUserById(user.id); assert.ok(result.error);
      } catch {
        cleanup = false;
        // Scoped fallback only; never touch another account's data.
        await admin.from('outfits').delete().eq('user_id', user.id);
        await admin.from('wardrobe_items').delete().eq('user_id', user.id);
        await admin.auth.admin.deleteUser(user.id);
      }
    }
    report.cleanup = cleanup;
    if (!cleanup) process.exitCode = 1;
    console.info(`${cleanup ? 'PASS' : 'FAIL'}: Temporary verification-account cleanup`);
    await writeFile('docs/account-cleanup-fix-results.json', JSON.stringify(report, null, 2) + '\n');
  }
}
main().catch(() => { console.error('Live trigger verification stopped; private details withheld.'); process.exitCode = 1; });
