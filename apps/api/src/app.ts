import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z, ZodError } from 'zod';
import { MAX_UPLOAD_BYTES, imageTypes, reviewSchema, tagsSchema, requestSchema, saveOutfitSchema, feedbackSchema, wearSchema, validateRecommendations, validateOutfit, validateManualOutfit, lookCapacity, type Garment, type SavedOutfit } from '../../../packages/shared/src/index.js';
import { readConfig, missingSetup, type Config } from './config.js';
import { userClient, BUCKET } from './supabase.js';
import { HttpError, requireResult } from './errors.js';
import { normalizePhoto } from './photos.js';
import { createAI, type AIProvider } from './ai.js';
import { registerFeatures, itemPhotos, allInventory } from './features.js';

export interface Identity { userId: string; db: SupabaseClient }
export interface Dependencies {
  config: Config; ai: AIProvider;
  authenticate(token: string): Promise<Identity>;
}
type Context = Response<unknown, Identity>;
const idSchema = z.uuid();
const uuid = (value: unknown) => idSchema.parse(value);
export function createApp(overrides: Partial<Dependencies> = {}) {
  const config = overrides.config ?? readConfig();
  const deps: Dependencies = {
    config, ai: overrides.ai ?? createAI(config),
    authenticate: overrides.authenticate ?? (async token => {
      if (missingSetup(config).length) throw new HttpError(503, 'Supabase is not configured. Follow README.md and set apps/api/.env.');
      const db = userClient(config, token);
      let result;
      try { result = await db.auth.getUser(token); }
      catch { throw new HttpError(503, 'Cannot reach Supabase Auth. Check your connection and SUPABASE_URL.'); }
      if (result.error || !result.data.user) throw new HttpError(401, 'Your session is invalid or expired. Sign in again.');
      return { db, userId: result.data.user.id };
    }),
  };
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.webOrigin, methods: ['GET','POST','PATCH','DELETE'], allowedHeaders: ['Authorization','Content-Type'] }));
  app.use(express.json({ limit: '32kb' }));
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/setup', (_req, res) => res.json({
    ready: missingSetup(config).length === 0, missing: missingSetup(config),
    aiReady: Boolean(config.openaiKey && config.model), workerConfigured: Boolean(config.secretKey),
  }));
  app.use('/api', rateLimit({ windowMs: 60000, limit: 150, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests. Wait a minute and try again.' } }));
  app.use('/api', async (req: Request, res: Context, next: NextFunction) => {
    const header = req.get('Authorization');
    if (!header?.startsWith('Bearer ') || header.length > 12000) throw new HttpError(401, 'Sign in to access your private wardrobe.');
    Object.assign(res.locals, await deps.authenticate(header.slice(7)));
    next();
  });
  const aiLimit = rateLimit({ windowMs: 60000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'AI request limit reached. Wait a minute and try again.' } });
  const upload = multer({
    storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0, parts: 1 },
    fileFilter: (_req, file, cb) => (imageTypes as readonly string[]).includes(file.mimetype) ? cb(null, true) : cb(new HttpError(415, 'Use a JPEG, PNG, or WebP photo.')),
  });
  registerFeatures(app, upload);
  async function ownedItem(res: Context, id: string): Promise<Garment> {
    return requireResult(await res.locals.db.from('wardrobe_items').select('*').eq('id', id).eq('user_id', res.locals.userId).single()) as Garment;
  }
  async function ownedOutfit(res: Context, id: string) {
    return requireResult(await res.locals.db.from('outfits').select('*,outfit_items(item_id)').eq('id', id).eq('user_id', res.locals.userId).single<SavedOutfit>());
  }
  async function photoUrls(db: SupabaseClient, items: Garment[]) {
    return itemPhotos(db,items);
  }
  async function confirmed(res: Context): Promise<Garment[]> {
    const items = requireResult(await res.locals.db.from('wardrobe_items').select('*').eq('user_id', res.locals.userId).eq('status', 'confirmed').order('id').limit(501)) as Garment[];
    if (items.length > 500) throw new HttpError(422, 'Outfit planning currently supports up to 500 confirmed garments.');
    return items;
  }
  app.get('/api/profile', async (_req, res: Context) => {
    res.json(requireResult(await res.locals.db.from('profiles').select('*').eq('id', res.locals.userId).single()));
  });
  app.post('/api/items', upload.single('photo'), async (req, res: Context) => {
    const photo = await normalizePhoto(req.file);
    const id = randomUUID(); const path = `${res.locals.userId}/${id}.webp`;
    const item = requireResult(await res.locals.db.from('wardrobe_items').insert({ id, user_id: res.locals.userId, photo_path: path }).select().single()) as Garment;
    const result = await res.locals.db.storage.from(BUCKET).upload(path, photo, { contentType: 'image/webp', upsert: false });
    if (result.error) {
      await res.locals.db.from('wardrobe_items').delete().eq('id', id).eq('user_id', res.locals.userId);
      throw new HttpError(503, 'Photo upload failed. Check the private garment-photos bucket and its policies, then try again.');
    }
    // The draft remains recoverable if signing or subsequent analysis fails.
    res.status(201).json((await photoUrls(res.locals.db, [item]))[0]);
  });
  app.get('/api/items/:id', async (req, res: Context) => {
    const id = uuid(req.params.id); const item = await ownedItem(res, id);
    const jobs = requireResult(await res.locals.db.from('ai_tag_jobs').select('id,item_id,status,attempts,last_error,created_at,updated_at').eq('item_id', id).eq('user_id', res.locals.userId).order('created_at', { ascending: false }).limit(1));
    const suggestions = requireResult(await res.locals.db.from('tag_suggestions').select('proposed_tags,created_at').eq('item_id', id).eq('user_id', res.locals.userId).order('created_at', { ascending: false }).limit(1));
    res.json({ item: (await photoUrls(res.locals.db, [item]))[0], job: jobs[0] ?? null, suggestion: suggestions[0] ? tagsSchema.parse(suggestions[0].proposed_tags) : null });
  });
  app.post('/api/items/:id/analyze', aiLimit, async (req, res: Context) => {
    const item = await ownedItem(res, uuid(req.params.id));
    if (item.status !== 'pending') throw new HttpError(409, 'This garment is already confirmed. Edit its reviewed tags directly.');
    if (!item.photo_path) throw new HttpError(400, 'Add a photo before requesting photo analysis. Manual review is available.');
    if (!config.openaiKey || !config.model || !config.secretKey) throw new HttpError(503, 'AI analysis needs OPENAI_API_KEY, OPENAI_MODEL, and SUPABASE_SECRET_KEY in apps/api/.env, plus npm.cmd run worker. Manual review is available.');
    const jobs = requireResult(await res.locals.db.from('ai_tag_jobs').select('id,item_id,status,attempts,last_error').eq('item_id', item.id).eq('user_id', res.locals.userId).in('status', ['queued','processing','retry']).limit(1));
    if (jobs[0]) { res.status(202).json(jobs[0]); return; }
    const result = await res.locals.db.from('ai_tag_jobs').insert({ item_id: item.id, user_id: res.locals.userId }).select('id,item_id,status,attempts,last_error').single();
    if (result.error?.code === '23505') throw new HttpError(409, 'Analysis is already queued. Refresh to see its status.');
    res.status(202).json(requireResult(result));
  });
  app.get('/api/jobs/:id', async (req, res: Context) => {
    res.json(requireResult(await res.locals.db.from('ai_tag_jobs').select('id,item_id,status,attempts,last_error,created_at,updated_at').eq('id', uuid(req.params.id)).eq('user_id', res.locals.userId).single()));
  });
  app.patch('/api/items/:id/confirm', async (req, res: Context) => {
    const id = uuid(req.params.id); await ownedItem(res, id);
    const review = reviewSchema.parse(req.body);
    const result = requireResult(await res.locals.db.from('wardrobe_items').update({ ...review, status: 'confirmed' }).eq('id', id).eq('user_id', res.locals.userId).select().single()) as Garment;
    res.json((await photoUrls(res.locals.db, [result]))[0]);
  });
  app.patch('/api/items/:id', async (req, res: Context) => {
    const id = uuid(req.params.id); const item = await ownedItem(res, id);
    if (item.status !== 'confirmed') throw new HttpError(409, 'Review and confirm this garment first.');
    const result = requireResult(await res.locals.db.from('wardrobe_items').update(reviewSchema.parse(req.body)).eq('id', id).eq('user_id', res.locals.userId).select().single()) as Garment;
    res.json((await photoUrls(res.locals.db, [result]))[0]);
  });
  app.delete('/api/items/:id', async (req, res: Context) => {
    const id = uuid(req.params.id); const item = await ownedItem(res, id);
    // Remove bytes first. A failed database delete leaves a visible draft that can be retried.
    if (item.photo_path) {
      const removal = await res.locals.db.storage.from(BUCKET).remove([item.photo_path]);
      if (removal.error) throw new HttpError(503, 'Photo deletion failed. Please retry.');
    }
    requireResult(await res.locals.db.from('wardrobe_items').delete().eq('id', id).eq('user_id', res.locals.userId).select('id').single());
    res.status(204).end();
  });
  app.post('/api/outfits/suggest', aiLimit, async (req, res: Context) => {
    const value = requestSchema.parse(req.body); const inventory = await confirmed(res);
    const capacity = lookCapacity(inventory);
    if (!capacity) { res.json({ suggestions: [], inventoryNote: 'Your confirmed closet needs shoes and a dress, a top with bottoms, or an explicitly reviewed full set. Add and review pieces you already own to plan a complete outfit.' }); return; }
    const count = Math.min(3, capacity);
    let result;
    try {
      result = validateRecommendations(await deps.ai.suggest(value, inventory, count), inventory, res.locals.userId);
      if (result.suggestions.length !== count) throw new Error('Wrong number of outfits');
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, 'The AI returned an unavailable or incomplete outfit. Nothing was displayed or saved. Please try again.');
    }
    // Re-read after AI latency to reject deletions or edits that changed eligibility.
    const latest = await confirmed(res);
    try { validateRecommendations(result, latest, res.locals.userId); }
    catch { throw new HttpError(409, 'Your closet changed while planning. Request new suggestions.'); }
    if (count < 3) result.inventoryNote = `Your confirmed closet currently supports ${count} distinct complete outfit${count === 1 ? '' : 's'}. ${result.inventoryNote}`.trim();
    res.json(result);
  });
  app.post('/api/outfits', async (req, res: Context) => {
    const value = saveOutfitSchema.parse(req.body);
    try { validateOutfit({ title: value.title, explanation: value.explanation, garmentIds: value.garmentIds }, await confirmed(res), res.locals.userId); }
    catch { throw new HttpError(400, 'Select a complete outfit using only your confirmed garments.'); }
    const id = requireResult(await res.locals.db.rpc('save_outfit', { payload: value }));
    res.status(201).json({ id });
  });
  app.get('/api/outfits', async (_req, res: Context) => {
    const outfits = requireResult(await res.locals.db.from('outfits').select('*,outfit_items(item_id),outfit_feedback(rating,comment)').eq('user_id', res.locals.userId).order('created_at', { ascending: false }).limit(500));
    // The unique owner/outfit feedback relationship is to-one in PostgREST.
    // Preserve the established array contract for browser and older clients.
    res.json({ outfits: outfits.map(outfit => ({ ...outfit, outfit_feedback: Array.isArray(outfit.outfit_feedback) ? outfit.outfit_feedback : outfit.outfit_feedback ? [outfit.outfit_feedback] : [] })) });
  });
  app.delete('/api/outfits/:id', async (req, res: Context) => {
    const id = uuid(req.params.id); await ownedOutfit(res, id);
    requireResult(await res.locals.db.from('outfits').delete().eq('id', id).eq('user_id', res.locals.userId).select('id').single());
    res.status(204).end();
  });
  app.post('/api/outfits/:id/feedback', async (req, res: Context) => {
    const id = uuid(req.params.id); await ownedOutfit(res, id);
    const value = feedbackSchema.parse(req.body);
    const existing = requireResult(await res.locals.db.from('outfit_feedback').select('id').eq('outfit_id', id).eq('user_id', res.locals.userId).limit(1));
    const result = existing[0]
      ? await res.locals.db.from('outfit_feedback').update(value).eq('id', existing[0].id).eq('user_id', res.locals.userId).select().single()
      : await res.locals.db.from('outfit_feedback').insert({ ...value, outfit_id: id, user_id: res.locals.userId }).select().single();
    res.json(requireResult(result));
  });
  app.get('/api/wear-logs', async (_req, res: Context) => {
    res.json({ logs: requireResult(await res.locals.db.from('wear_logs').select('*,outfits(title)').eq('user_id', res.locals.userId).order('worn_on', { ascending: false }).limit(500)) });
  });
  app.post('/api/wear-logs', async (req, res: Context) => {
    const value = z.object({ outfitId: z.uuid(), ...wearSchema.shape }).strict().parse(req.body);
    if (value.wornOn > new Date().toISOString().slice(0, 10)) throw new HttpError(400, 'Wear dates cannot be in the future.');
    const outfit = await ownedOutfit(res, value.outfitId);
    if (outfit.invalidated) throw new HttpError(409, 'A garment in this outfit was removed. Save a new outfit first.');
    try {
      const value = { title: outfit.title, explanation: outfit.explanation, garmentIds: outfit.outfit_items.map((i: { item_id: string }) => i.item_id) };
      if (outfit.creation_method === 'manual') validateManualOutfit({ ...value, occasion:outfit.occasion, style:outfit.style, season:outfit.season, confirmedComplete:true },await allInventory(res.locals.db),res.locals.userId);
      else validateOutfit(value, await confirmed(res), res.locals.userId);
    }
    catch { throw new HttpError(409, 'This outfit is no longer complete. Save a new outfit first.'); }
    res.status(201).json(requireResult(await res.locals.db.from('wear_logs').insert({ outfit_id: value.outfitId, worn_on: value.wornOn, user_id: res.locals.userId }).select().single()));
  });
  app.delete('/api/wear-logs/:id', async (req, res: Context) => {
    requireResult(await res.locals.db.from('wear_logs').delete().eq('id', uuid(req.params.id)).eq('user_id', res.locals.userId).select('id').single());
    res.status(204).end();
  });
  app.use((_req, _res, next) => next(new HttpError(404, 'API route not found.')));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) { res.status(400).json({ error: 'Check the form fields.', details: error.issues.map(i => `${i.path.join('.')}: ${i.message}`) }); return; }
    if (error instanceof multer.MulterError) { res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Photos must be 8 MB or smaller.' : 'Upload exactly one photo and no additional form fields.' }); return; }
    if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof SyntaxError) { res.status(400).json({ error: 'The request body is not valid JSON.' }); return; }
    // Never serialize provider errors: they may contain signed URLs, image data or secrets.
    res.status(503).json({ error: 'The service could not finish this request. Check provider configuration and try again.' });
  });
  return app;
}
