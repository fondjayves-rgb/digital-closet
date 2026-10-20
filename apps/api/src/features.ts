import type { Express, Response } from 'express';
import type { Multer } from 'multer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import provided from '../../../packages/shared/src/provided-inventory.json' with { type: 'json' };
import { IMPORT_ID, inventorySchema, profileSchema, templateSchema, manualOutfitSchema, saveOutfitSchema, validateManualOutfit, validateOutfit, type Garment, type ProvidedEntry } from '../../../packages/shared/src/index.js';
import type { Identity } from './app.js';
import { HttpError, requireResult } from './errors.js';
import { normalizePhoto } from './photos.js';
import { BUCKET } from './supabase.js';
import { inspiration } from './inspiration.js';
type Context = Response<unknown, Identity>;
const entries = provided as ProvidedEntry[];
export async function itemPhotos(db: SupabaseClient, items: Garment[]) {
  const withPhotos = items.filter(i=>i.photo_path);
  if (!withPhotos.length) return items;
  const result = await db.storage.from(BUCKET).createSignedUrls(withPhotos.map(i=>i.photo_path!),300);
  if (result.error || !result.data) throw new HttpError(503,'Private photos are unavailable. Refresh your wardrobe to retry.');
  const urls = new Map(withPhotos.map((item,index)=>[item.id,result.data[index]?.signedUrl]));
  return items.map(item=>({...item,photoUrl:urls.get(item.id) || undefined}));
}
async function item(res: Context, id: string) { return requireResult(await res.locals.db.from('wardrobe_items').select('*').eq('id',id).eq('user_id',res.locals.userId).single()) as Garment; }
export async function allInventory(db: SupabaseClient): Promise<Garment[]> {
  const records: Garment[]=[]; let offset: number | null=0;
  while (offset !== null) { const page: {items:Garment[];nextOffset:number|null}=requireResult(await db.rpc('list_inventory',{filters:{offset,limit:200}})); records.push(...page.items); offset=page.nextOffset; }
  return records;
}
export function registerFeatures(app: Express, upload: Multer) {
  app.get('/api/capabilities',async (_req,res:Context)=>{ const version=await res.locals.db.rpc('wardrobe_update_version'); res.json({inventoryUpdate:version.data === 1 && !version.error}); });
  app.get('/api/inspiration',(_req,res)=>res.json(inspiration));
  app.patch('/api/profile',async(req,res:Context)=>{ const parsed=profileSchema.parse(req.body); const value='gender' in req.body ? parsed : {display_name:parsed.display_name,style_preferences:parsed.style_preferences}; res.json(requireResult(await res.locals.db.from('profiles').update(value).eq('id',res.locals.userId).select().single())); });
  app.get('/api/items',async(req,res:Context)=>{
    const query=z.object({q:z.string().max(100).optional(),category:inventorySchema.shape.category.optional(),status:z.enum(['pending','confirmed']).optional(),brand:z.string().max(100).optional(),color:z.string().max(60).optional(),fit:z.string().max(80).optional(),subtype:z.string().max(80).optional(),collection:z.string().max(80).optional(),favorite:z.enum(['true','false']).optional(),sort:z.enum(['name','oldest','newest']).optional(),offset:z.coerce.number().int().min(0).max(1000000).default(0),limit:z.coerce.number().int().min(1).max(200).default(100)}).strict().parse(req.query);
    const result=await res.locals.db.rpc('list_inventory',{filters:query});
    if (result.error?.code === 'PGRST202' || result.error?.code === '42883') {
      // Existing hosted project remains readable before the approved forward migration is applied.
      const legacy=requireResult(await res.locals.db.from('wardrobe_items').select('*').eq('user_id',res.locals.userId).order('created_at',{ascending:false}).limit(1000)) as Garment[];
      const filtered=legacy.filter(i=>(!query.category||i.category===query.category)&&(!query.status||i.status===query.status)&&(!query.q||`${i.name} ${i.color||''}`.toLowerCase().includes(query.q.toLowerCase())));
      res.json({items:await itemPhotos(res.locals.db,filtered),total:filtered.length,nextOffset:null,legacy:true});return;
    }
    const data=requireResult(result) as {items:Garment[]};
    res.json({...data,items:await itemPhotos(res.locals.db,data.items)});
  });
  app.post('/api/items/manual',async(req,res:Context)=>{
    const {confirmed,...value}=inventorySchema.extend({confirmed:z.literal(true)}).parse(req.body);
    void confirmed;
    const id=requireResult(await res.locals.db.rpc('save_inventory',{payload:value}));
    res.status(201).json(await item(res,id as string));
  });
  app.patch('/api/items/:id/favorite',async(req,res:Context)=>{
    const id=z.uuid().parse(req.params.id); await item(res,id);
    const value=z.object({is_favorite:z.boolean()}).strict().parse(req.body);
    res.json(requireResult(await res.locals.db.from('wardrobe_items').update(value).eq('id',id).eq('user_id',res.locals.userId).select().single()));
  });
  app.post('/api/items/:id/photo',upload.single('photo'),async(req,res:Context)=>{
    const id=z.uuid().parse(req.params.id); const record=await item(res,id);
    if (record.photo_path) throw new HttpError(409,'This item already has a photo.');
    const photo=await normalizePhoto(req.file); const path=`${res.locals.userId}/${id}.webp`;
    const result=await res.locals.db.storage.from(BUCKET).upload(path,photo,{contentType:'image/webp',upsert:false});
    if (result.error) throw new HttpError(503,'Photo attachment failed. Refresh before retrying.');
    const saved=requireResult(await res.locals.db.from('wardrobe_items').update({photo_path:path}).eq('id',id).eq('user_id',res.locals.userId).is('photo_path',null).select().single()) as Garment;
    res.json((await itemPhotos(res.locals.db,[saved]))[0]);
  });
  for (const path of ['/api/items/:id/confirm','/api/items/:id']) app.patch(path,async(req,res:Context,next)=>{
    // Preserve legacy tag-only requests and their validation; metadata-aware clients use the atomic RPC.
    if (!req.body || typeof req.body!=='object' || !('brand' in req.body || 'quantity' in req.body || 'collections' in req.body)) { next(); return; }
    const id=z.uuid().parse(req.params.id); const record=await item(res,id);
    if (path.endsWith('/:id') && record.status !== 'confirmed') throw new HttpError(409,'Review and confirm this item first.');
    const value=inventorySchema.parse(req.body);
    requireResult(await res.locals.db.rpc('save_inventory',{payload:value,target:id}));
    res.json((await itemPhotos(res.locals.db,[await item(res,id)]))[0]);
  });
  app.get('/api/import/preview',async(_req,res:Context)=>{
    const ledger=requireResult(await res.locals.db.from('wardrobe_import_entries').select('source_key,item_id,template_id').eq('user_id',res.locals.userId).eq('import_id',IMPORT_ID)) as {source_key:string}[];
    const owned=await allInventory(res.locals.db);
    res.json({importId:IMPORT_ID,entries:entries.map(entry=>({...entry,imported:ledger.some(row=>row.source_key===entry.key),candidates:entry.kind==='item' ? owned.filter(i=>i.status==='confirmed' && i.category===entry.item?.category && (!entry.item.brand || !i.brand || i.brand===entry.item.brand)).map(i=>({id:i.id,name:i.name})) : []}))});
  });
  app.post('/api/import/commit',async(req,res:Context)=>{
    const batch=z.object({entries:z.array(z.object({key:z.string(),action:z.enum(['create','link','skip']),existingId:z.uuid().optional(),reviewed:z.literal(true),data:z.unknown()}).strict()).min(1).max(10)}).strict().parse(req.body);
    const results=[];
    for (const row of batch.entries) {
      try {
        const source=entries.find(e=>e.key===row.key); if (!source) throw new HttpError(400,'Unknown inventory source entry.');
        if (row.action==='link' && !row.existingId) throw new HttpError(400,'Choose the existing item to link.');
        const candidate=row.action==='skip' ? source.kind==='item'?source.item:source.template : row.data;
        const data=source.kind==='item' ? {...inventorySchema.parse(candidate),source_description:source.source} : templateSchema.parse(candidate);
        const result=requireResult(await res.locals.db.rpc('commit_wardrobe_import',{payload:{key:row.key,kind:source.kind,action:row.action,existingId:row.existingId,data}}));
        results.push(result);
      } catch(error) { results.push({key:row.key,status:'failed',error:error instanceof HttpError ? error.message : 'Check this entry and retry.'}); }
    }
    res.json({results});
  });
  app.get('/api/templates',async(_req,res:Context)=>res.json({templates:requireResult(await res.locals.db.from('outfit_templates').select('*,template_components(id,label,item_id)').eq('user_id',res.locals.userId).order('title'))}));
  app.patch('/api/templates/:id',async(req,res:Context)=>{
    const id=z.uuid().parse(req.params.id); const value=templateSchema.parse(req.body);
    requireResult(await res.locals.db.from('outfit_templates').select('id').eq('id',id).eq('user_id',res.locals.userId).single());
    requireResult(await res.locals.db.rpc('write_template',{payload:value,target:id})); res.json({id});
  });
  app.delete('/api/templates/:id',async(req,res:Context)=>{
    requireResult(await res.locals.db.from('outfit_templates').delete().eq('id',z.uuid().parse(req.params.id)).eq('user_id',res.locals.userId).select('id').single()); res.status(204).end();
  });
  app.post('/api/outfits/manual',async(req,res:Context)=>{
    const value=manualOutfitSchema.parse(req.body);
    try { validateManualOutfit(value,await allInventory(res.locals.db),res.locals.userId); } catch { throw new HttpError(400,'Choose distinct reviewed items from your own closet.'); }
    const id=requireResult(await res.locals.db.rpc('save_manual_outfit',{payload:value})); res.status(201).json({id});
  });
  app.patch('/api/outfits/:id',async(req,res:Context)=>{
    const id=z.uuid().parse(req.params.id);
    const record=requireResult(await res.locals.db.from('outfits').select('*').eq('id',id).eq('user_id',res.locals.userId).single()) as {creation_method:string};
    const schema=record.creation_method==='manual' ? manualOutfitSchema : saveOutfitSchema;
    const {expectedUpdatedAt,...value}=schema.extend({expectedUpdatedAt:z.iso.datetime({offset:true}).optional()}).parse(req.body);
    const inventory=await allInventory(res.locals.db);
    if (record.creation_method==='manual') validateManualOutfit(value,inventory,res.locals.userId);
    else validateOutfit({title:value.title,explanation:value.explanation,garmentIds:value.garmentIds},inventory,res.locals.userId);
    requireResult(await res.locals.db.rpc('write_saved_outfit',{payload:{...value,expectedUpdatedAt},target:id,method:record.creation_method})); res.json({id});
  });
}
