import type { SupabaseClient } from '@supabase/supabase-js';
import type { AIProvider } from './ai.js';
import { BUCKET } from './supabase.js';
import { requireResult } from './errors.js';
import { tagsSchema } from '../../../packages/shared/src/index.js';
export async function processNextJob(db: SupabaseClient, ai: AIProvider): Promise<boolean> {
  const jobs = requireResult(await db.rpc('claim_tag_job'));
  const job = jobs[0];
  if (!job) return false;
  let tags = null; let errorText: string | null = null;
  try {
    const item = requireResult(await db.from('wardrobe_items').select('photo_path,status').eq('id', job.item_id).eq('user_id', job.user_id).single<{ photo_path: string | null; status: string }>());
    if (item.status !== 'pending') throw new Error('Item already reviewed');
    if (!item.photo_path) throw new Error('No photo attached');
    const file = await db.storage.from(BUCKET).download(item.photo_path);
    if (file.error || !file.data) throw new Error('Photo unavailable');
    tags = tagsSchema.parse(await ai.recognize(Buffer.from(await file.data.arrayBuffer())));
  } catch {
    errorText = 'Photo analysis could not finish. Check the photo, OpenAI key, model access, and network. You can review manually.';
  }
  requireResult(await db.rpc('finish_tag_job', { job_uuid: job.id, token: job.lease_token, tags, error_text: errorText }));
  return true;
}
