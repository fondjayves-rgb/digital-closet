import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Config } from './config.js';
import { HttpError } from './errors.js';
export const BUCKET = 'garment-photos';
const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
export function userClient(config: Config, token: string): SupabaseClient {
  return createClient(config.supabaseUrl, config.publishableKey, { auth, global: { headers: { Authorization: `Bearer ${token}` } } });
}
export function workerClient(config: Config): SupabaseClient {
  if (!config.supabaseUrl || !config.secretKey) throw new HttpError(503, 'Set SUPABASE_URL and SUPABASE_SECRET_KEY in apps/api/.env to run the worker.');
  return createClient(config.supabaseUrl, config.secretKey, { auth });
}
