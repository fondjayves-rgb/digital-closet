import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
function validConfiguration() {
  if (!url || !key || /YOUR_PROJECT/i.test(url) || /^your-/i.test(key)) return false;
  try { return ['http:', 'https:'].includes(new URL(url).protocol); } catch { return false; }
}
export const authConfigured = validConfiguration();
export const supabase = authConfigured ? createClient(url!, key!, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } }) : null;
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const headers = new Headers(init.headers);
  if (session) headers.set('Authorization', `Bearer ${session.access_token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  let response;
  try { response = await fetch(`/api${path}`, { ...init, headers, cache: 'no-store', signal: init.signal ?? AbortSignal.timeout(90000) }); }
  catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') throw new Error('This request is taking too long. Refresh your wardrobe before retrying an upload or save.');
    throw new Error('Cannot connect to your wardrobe. Check your connection and try again.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.details?.length ? `${body.error} ${body.details.join(' ')}` : body?.error || 'The request failed. Please try again.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';
export function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export const prettyDate = (value: string) => new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
