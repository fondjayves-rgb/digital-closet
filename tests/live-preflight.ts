// Read-only live configuration check. Never print provider payloads or environment values.
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { readConfig, missingSetup } from '../apps/api/src/config.js';
const config = readConfig();
const safeCode = (value: unknown) => typeof value === 'string' && /^[a-z0-9_]{1,80}$/i.test(value) ? value : undefined;
async function main() {
  if (missingSetup(config).length || !config.secretKey) { console.log(JSON.stringify({ configuration: 'missing', missing: [...missingSetup(config), ...(!config.secretKey ? ['SUPABASE_SECRET_KEY'] : [])] })); return; }
  const db = createClient(config.supabaseUrl, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const results: Record<string, unknown> = {};
  for (const [name, url] of [['frontend', 'http://127.0.0.1:5173/'], ['backendHealth', `http://127.0.0.1:${config.port}/health`], ['frontendApiProxy', 'http://127.0.0.1:5173/api/setup']] as const) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      results[name] = { reachable: true, status: response.status, ...(name === 'frontendApiProxy' && response.ok ? { setup: await response.json() } : {}) };
    } catch { results[name] = { reachable: false }; }
  }
  const tables: Record<string, unknown> = {};
  for (const table of ['profiles','wardrobe_items','ai_tag_jobs','tag_suggestions','outfits','outfit_items','wear_logs','outfit_feedback']) {
    try { const result = await db.from(table).select('*', { head: true }); tables[table] = { accessible: !result.error, status: result.status, code: safeCode(result.error?.code) }; }
    catch { tables[table] = { accessible: false, connectionFailed: true }; }
  }
  results.tables = tables;
  try { const { data, error } = await db.storage.getBucket('garment-photos'); results.storage = { accessible: !error, ...(data ? { private: !data.public, fileSizeLimit: data.file_size_limit, allowedMimeTypes: data.allowed_mime_types } : {}), ...(error ? { code: safeCode((error as { code?: string }).code) } : {}) }; }
  catch { results.storage = { accessible: false, connectionFailed: true }; }
  try { const response = await fetch(`${config.supabaseUrl}/auth/v1/settings`, { headers: { apikey: config.publishableKey }, signal: AbortSignal.timeout(15000) });
    const data = response.ok ? await response.json() as Record<string, any> : {};
    results.auth = { reachable: response.ok, status: response.status, emailPasswordEnabled: data.external?.email, signupDisabled: data.disable_signup, emailAutoConfirm: data.mailer_autoconfirm };
  } catch { results.auth = { reachable: false }; }
  try { const client = new OpenAI({ apiKey: config.openaiKey, maxRetries: 0, timeout: 15000 }); await client.models.retrieve(config.model); results.openaiModelAccess = { passed: true, note: 'Read-only model access; no Responses inference verified yet.' }; }
  catch (error) { const e = error as { status?: number; code?: string }; results.openaiModelAccess = { passed: false, status: e.status, code: safeCode(e.code) }; }
  console.log(JSON.stringify(results, null, 2));
}
main().catch(() => { console.error('Preflight could not complete. Provider details were withheld.'); process.exitCode = 1; });
