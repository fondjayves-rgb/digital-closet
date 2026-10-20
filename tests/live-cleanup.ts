// Repair cleanup only for this verification run's uniquely named temporary accounts.
import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile } from 'node:fs/promises';
import { readConfig } from '../apps/api/src/config.js';
const config = readConfig();
async function main() {
  const report = JSON.parse(await readFile('docs/live-workflow-results.json', 'utf8')) as { startedAt: string; finishedAt: string; cleanup: boolean; cleanupRepair?: unknown };
  const admin = createClient(config.supabaseUrl, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const accounts = [];
  for (let page = 1; page <= 100; page++) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (result.error) throw new Error('lookup_failed');
    accounts.push(...result.data.users.filter(u => /^wardrobe-verify-[a-f0-9-]+@example\.test$/.test(u.email || '') && Date.parse(u.created_at) >= Date.parse(report.startedAt) && Date.parse(u.created_at) <= Date.parse(report.finishedAt)));
    if (result.data.users.length < 100) break;
  }
  console.info(`Remaining accounts from this test run: ${accounts.length}`);
  let success = true;
  const repairs: { account: number; stage: string; passed: boolean; status?: number; code?: string }[] = [];
  for (const [index, account] of accounts.entries()) {
    async function check(stage: string, result: { error: { status?: number; code?: string } | null }) {
      const code = result.error?.code && /^[a-z0-9_]{1,80}$/i.test(result.error.code) ? result.error.code : undefined;
      repairs.push({ account: index + 1, stage, passed: !result.error, status: result.error?.status, code });
      console.info(`${result.error ? 'FAIL' : 'PASS'}: cleanup ${stage}${result.error?.status ? ` (HTTP ${result.error.status})` : ''}${code ? ` [${code}]` : ''}`);
      return !result.error;
    }
    // Reproduce the administrative cleanup error once without exposing its payload.
    const attempt = await admin.auth.admin.deleteUser(account.id);
    if (await check('direct_auth_delete', attempt)) continue;
    const items = await admin.from('wardrobe_items').select('photo_path').eq('user_id', account.id);
    if (items.error) { success = false; continue; }
    const paths = items.data.map(r => r.photo_path as string);
    if (!paths.every(path => path.startsWith(`${account.id}/`))) throw new Error('path_scope_failed');
    if (paths.length && !await check('remove_owned_photos', await admin.storage.from('garment-photos').remove(paths))) { success = false; continue; }
    if (!await check('remove_owned_outfits', await admin.from('outfits').delete().eq('user_id', account.id))) { success = false; continue; }
    if (!await check('remove_owned_garments', await admin.from('wardrobe_items').delete().eq('user_id', account.id))) { success = false; continue; }
    if (!await check('auth_delete_after_child_cleanup', await admin.auth.admin.deleteUser(account.id))) success = false;
  }
  report.cleanup = success; report.cleanupRepair = { checkedAt: new Date().toISOString(), remainingTestAccountsFound: accounts.length, checks: repairs };
  await writeFile('docs/live-workflow-results.json', JSON.stringify(report, null, 2) + '\n');
  if (!success) process.exitCode = 1;
}
main().catch(() => { console.error('Cleanup repair failed; private details withheld.'); process.exitCode = 1; });
