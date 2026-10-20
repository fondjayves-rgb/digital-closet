// Local-only reproduction of the original bug and validation of the approved SQL.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { database, asUser, garment, ALICE, BOB } from './database.js';
const db = await database({ initialOnly: true });
async function look(userId: string) {
  const ids = [];
  for (const category of ['tops', 'bottoms', 'shoes']) ids.push(await garment(db, userId, category));
  const payload = { title: 'Synthetic cleanup look', explanation: 'Local proposal validation.', occasion: 'Everyday', style: 'Simple', season: 'all-season', garmentIds: ids };
  const result = await asUser(db, userId, tx => tx.query<{ id: string }>('select public.save_outfit($1::jsonb) as id', [JSON.stringify(payload)]));
  await asUser(db, userId, tx => tx.query('insert into public.wear_logs(user_id,outfit_id,worn_on) values($1,$2,current_date)', [userId, result.rows[0].id]));
  return { ids, outfitId: result.rows[0].id };
}
try {
  const alice = await look(ALICE); const bob = await look(BOB);
  await assert.rejects(db.query('delete from auth.users where id=$1', [ALICE]), (error: unknown) => (error as { code: string }).code === '23503');
  console.info('PASS: reproduced existing account-deletion foreign-key failure in isolated PostgreSQL.');
  await db.exec(await readFile(new URL('../docs/proposed-account-cleanup-fix.sql', import.meta.url), 'utf8'));
  await db.query('delete from auth.users where id=$1', [ALICE]);
  assert.equal((await db.query('select id from public.outfits where id=$1', [alice.outfitId])).rows.length, 0);
  assert.equal((await db.query('select id from public.wear_logs where user_id=$1', [ALICE])).rows.length, 0);
  assert.equal((await db.query('select id from public.outfits where id=$1', [bob.outfitId])).rows.length, 1);
  console.info('PASS: proposed guard allows account deletion and preserves the other account.');
  await asUser(db, BOB, tx => tx.query('delete from public.wardrobe_items where id=$1', [bob.ids[0]]));
  assert.equal((await db.query<{ invalidated: boolean }>('select invalidated from public.outfits where id=$1', [bob.outfitId])).rows[0].invalidated, true);
  assert.equal((await db.query('select id from public.wear_logs where user_id=$1', [BOB])).rows.length, 1);
  console.info('PASS: ordinary garment deletion still invalidates the look and retains history.');
  const itemId = await garment(db, BOB, null, 'pending');
  await asUser(db, BOB, tx => tx.query('insert into public.ai_tag_jobs(user_id,item_id) values($1,$2)', [BOB, itemId]));
  await asUser(db, BOB, tx => tx.query("update public.wardrobe_items set status='confirmed', category='tops', color='white' where id=$1", [itemId]));
  assert.equal((await db.query<{ status: string }>('select status from public.ai_tag_jobs where item_id=$1', [itemId])).rows[0].status, 'cancelled');
  console.info('PASS: manual tag confirmation still cancels pending AI work. This check did not contact the live database.');
} finally { await db.close(); }
