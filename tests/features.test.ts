import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,garment,ALICE,BOB} from './database';
import {testClient} from './adapter';
import {createApp} from '../apps/api/src/app';
import {HttpError} from '../apps/api/src/errors';
import {inventorySchema,manualOutfitSchema,validateRecommendations,lookCapacity,type Garment} from '../packages/shared/src/index';
import provided from '../packages/shared/src/provided-inventory.json';
import {inspiration} from '../apps/api/src/inspiration';
let db:PGlite;let app:ReturnType<typeof createApp>;const photos=new Map<string,Buffer>();const auth=(who='alice')=>({Authorization:`Bearer ${who}`});
const inventory=(patch:Record<string,unknown>={})=>inventorySchema.parse({name:'Reviewed text item',category:'tops',color:null,pattern:'unknown',attributes:[],...patch});
const outfit=(ids:string[])=>({title:'My chosen outfit',occasion:'Swimming',style:'Comfort',season:'all-season',explanation:'Chosen explicitly.',garmentIds:ids,confirmedComplete:true});
const ai={recognize:vi.fn(),suggest:vi.fn()};
beforeAll(async()=>{db=await database();app=createApp({config:{port:3001,webOrigin:'http://127.0.0.1:5173',supabaseUrl:'https://test.invalid',publishableKey:'test',secretKey:'test',openaiKey:'test',model:'test'},ai,authenticate:async token=>{if(!['alice','bob'].includes(token))throw new HttpError(401,'Invalid test token');const userId=token==='alice'?ALICE:BOB;return {userId,db:testClient(db,userId,photos)};}});},60000);
afterAll(async()=>{await db?.close();});
async function manual(patch:Record<string,unknown>={},who='alice'){const res=await request(app).post('/api/items/manual').set(auth(who)).send({...inventory(patch),confirmed:true});expect(res.status,res.text).toBe(201);return res.body as Garment;}
it('upgrades populated existing wardrobes without changing IDs, photos, history or feedback',async()=>{
  const legacy=await database({beforeUpdate:true});try{
    const top=await garment(legacy,ALICE,'tops'),bottom=await garment(legacy,ALICE,'bottoms'),shoes=await garment(legacy,ALICE,'shoes');
    const saved=await asUser(legacy,ALICE,tx=>tx.query<{id:string}>('select public.save_outfit($1::jsonb) id',[JSON.stringify(outfit([top,bottom,shoes]))]));const id=saved.rows[0].id;
    await asUser(legacy,ALICE,async tx=>{await tx.query('insert into public.wear_logs(user_id,outfit_id,worn_on) values($1,$2,current_date)',[ALICE,id]);await tx.query('insert into public.outfit_feedback(user_id,outfit_id,rating) values($1,$2,5)',[ALICE,id]);});
    const before=(await legacy.query('select id,user_id,name,photo_path,status,category,color from public.wardrobe_items order by id')).rows;
    const dir=new URL('../supabase/migrations/',import.meta.url);const file=(await readdir(dir)).find(f=>f.includes('_wardrobe_inventory_update.sql'))!;await legacy.exec(await readFile(new URL(file,dir),'utf8'));
    expect((await legacy.query('select id,user_id,name,photo_path,status,category,color from public.wardrobe_items order by id')).rows).toEqual(before);
    expect((await legacy.query('select * from public.wear_logs')).rows).toHaveLength(1);expect((await legacy.query('select rating from public.outfit_feedback')).rows[0]).toEqual({rating:5});
    expect((await legacy.query<{quantity:number|null}>('select quantity from public.wardrobe_items')).rows.every(r=>r.quantity===null)).toBe(true);
  }finally{await legacy.close();}
},60000);
it('requires explicit manual review and stores unknown metadata and pack counts without photos',async()=>{
  expect((await request(app).post('/api/items/manual').set(auth()).send(inventory())).status).toBe(400);
  const item=await manual({category:'sets',pack_count:1,pack_description:'1 Pack; components unspecified'});expect(item).toMatchObject({photo_path:null,color:null,brand:null,quantity:null,pack_count:1,status:'confirmed',set_coverage:'unspecified'});
  expect((await request(app).post(`/api/items/${item.id}/analyze`).set(auth())).status).toBe(409);
  await asUser(db,ALICE,async tx=>{const pending=await tx.query<{id:string}>("insert into public.wardrobe_items(user_id,name) values($1,'No photo draft') returning id",[ALICE]);await expect(tx.query('insert into public.ai_tag_jobs(user_id,item_id) values($1,$2)',[ALICE,pending.rows[0].id])).rejects.toThrow();});
  expect(ai.recognize).not.toHaveBeenCalled();
});
it('keeps legacy photo inventory and tag review usable before the hosted update is applied',async()=>{
  const legacy=await database({beforeUpdate:true});try{
    const id=await garment(legacy,ALICE,null,'pending');const legacyApp=createApp({config:{port:3001,webOrigin:'http://127.0.0.1:5173',supabaseUrl:'https://test.invalid',publishableKey:'test',secretKey:'test',openaiKey:'',model:''},ai,authenticate:async()=>({userId:ALICE,db:testClient(legacy,ALICE,photos)})});
    expect((await request(legacyApp).get('/api/capabilities').set(auth())).body.inventoryUpdate).toBe(false);
    expect((await request(legacyApp).get('/api/items').set(auth())).body.items[0].id).toBe(id);
    const confirmation=await request(legacyApp).patch(`/api/items/${id}/confirm`).set(auth()).send({name:'Existing photo review',category:'tops',color:'white',pattern:'unknown',attributes:[]});expect(confirmation.status,confirmation.text).toBe(200);
    expect((await request(legacyApp).patch('/api/profile').set(auth()).send({display_name:'Legacy preferences',style_preferences:'Simple'})).status).toBe(200);
  }finally{await legacy.close();}
},60000);
it('rejects unreviewed and oversized import batches before writes and reports invalid entries individually',async()=>{
  const entry=provided.find(e=>e.kind==='item')!;const row={key:entry.key,action:'create',reviewed:true,data:entry.item};
  expect((await request(app).post('/api/import/commit').set(auth()).send({entries:[{...row,reviewed:false}]})).status).toBe(400);
  expect((await request(app).post('/api/import/commit').set(auth()).send({entries:Array(11).fill(row)})).status).toBe(400);
  const invalid=await request(app).post('/api/import/commit').set(auth()).send({entries:[{...row,key:'not-a-source-key'}]});expect(invalid.body.results[0].status).toBe('failed');
});
it('persists favorites and profile defaults without exposing or changing another account',async()=>{
  const item=await manual({category:'fragrance'});expect((await request(app).patch(`/api/items/${item.id}/favorite`).set(auth()).send({is_favorite:true})).status).toBe(200);
  const list=await request(app).get('/api/items?favorite=true').set(auth());expect(list.body.items.some((i:Garment)=>i.id===item.id)).toBe(true);
  expect((await request(app).patch(`/api/items/${item.id}/favorite`).set(auth('bob')).send({is_favorite:false})).status).toBe(404);
  const settings={display_name:'Reviewed User',style_preferences:'Relaxed',gender:null,gender_description:'',default_occasion:'Training'};
  expect((await request(app).patch('/api/profile').set(auth()).send(settings)).body).toMatchObject(settings);expect((await request(app).get('/api/profile').set(auth('bob'))).body.display_name).toBe('');
});
it('filters and paginates full inventory with French aliases and flexible collections',async()=>{
  for(let n=0;n<5;n++)await manual({name:`Pagination chemise ${n}`,color:'kaki',brand:'User brand',fit:'slim',collections:['Work','Date Night']});
  const page=await request(app).get('/api/items?q=shirt&color=kaki&brand=User%20brand&collection=Work&limit=2').set(auth());expect(page.status,page.text).toBe(200);expect(page.body.items).toHaveLength(2);expect(page.body.total).toBe(5);expect(page.body.nextOffset).toBe(2);expect(page.body.items[0].collections).toEqual(['Date Night','Work']);
  const second=await request(app).get('/api/items?q=shirt&offset=2&limit=2').set(auth());expect(second.body.items.map((i:Garment)=>i.id)).not.toContain(page.body.items[0].id);
  expect((await request(app).get('/api/items?q=khaki').set(auth())).body.total).toBe(5);
  expect((await request(app).get('/api/items?collection=Work').set(auth('bob'))).body.total).toBe(0);
});
it('preserves provided descriptions, ambiguous units, packs and templates in preview',async()=>{
  const preview=await request(app).get('/api/import/preview').set(auth());expect(preview.status).toBe(200);expect(preview.body.entries).toHaveLength(100);
  expect(provided.filter(e=>e.kind==='template')).toHaveLength(14);expect(provided.filter(e=>e.kind==='item')).toHaveLength(86);
  for(const entry of provided)if(entry.kind==='item')expect(inventorySchema.safeParse(entry.item).success,entry.key).toBe(true);
  const pack=provided.find(e=>e.section==='Hoodies and jogger')!;expect(pack.item).toMatchObject({quantity:null,pack_count:1});
  expect(provided.find(e=>e.source.startsWith('Zara/H&M'))!.item!.brand).toBeNull();
  expect(provided.filter(e=>e.source.includes('Thigh')).every(e=>e.kind==='template')).toBe(true);
});
it('deduplicates concurrent and repeated imports, including after item deletion',async()=>{
  const entry=provided.find(e=>e.kind==='item')!;const body={entries:[{key:entry.key,action:'create',reviewed:true,data:entry.item}]};
  const [first,second]=await Promise.all([request(app).post('/api/import/commit').set(auth()).send(body),request(app).post('/api/import/commit').set(auth()).send(body)]);
  const results=[first.body.results[0],second.body.results[0]];expect(results.map(r=>r.status).sort()).toEqual(['created','skipped']);const id=results.find(r=>r.id)!.id;
  expect((await request(app).delete(`/api/items/${id}`).set(auth())).status).toBe(204);
  expect((await request(app).post('/api/import/commit').set(auth()).send(body)).body.results[0].status).toBe('skipped');
  expect((await request(app).get('/api/import/preview').set(auth('bob'))).body.entries.find((e:{key:string})=>e.key===entry.key).imported).toBe(false);
  await expect(asUser(db,ALICE,tx=>tx.query('delete from public.wardrobe_import_entries'))).rejects.toThrow();
});
it('links an import to an owned reviewed record without duplicating or replacing its metadata',async()=>{
  const item=await manual({name:'Existing socks',category:'socks',quantity:3,collections:['Daily']});const entry=provided.find(e=>e.section==='Work collection'&&e.item?.category==='socks')!;
  const data={...entry.item,collections:['Work']};const body={entries:[{key:entry.key,action:'link',existingId:item.id,reviewed:true,data}]};
  expect((await request(app).post('/api/import/commit').set(auth()).send(body)).body.results[0].status).toBe('linked');
  const own=await request(app).get('/api/items?q=Existing%20socks').set(auth());expect(own.body.items[0]).toMatchObject({name:'Existing socks',quantity:3,collections:['Daily','Work']});
  const foreign=await manual({category:'socks'},'bob');const other=provided.find(e=>e.key!==entry.key&&e.section==='Work collection'&&e.item?.category==='socks')!;
  expect((await request(app).post('/api/import/commit').set(auth()).send({entries:[{...body.entries[0],key:other.key,existingId:foreign.id}]})).body.results[0].status).toBe('failed');
});
it('rejects cross-owner collection, template and import relationships at the database layer',async()=>{
  const own=await manual();const other=await manual({},'bob');const foreignCollection=await asUser(db,BOB,tx=>tx.query<{id:string}>("insert into public.collections(user_id,name) values($1,'Private') returning id",[BOB]));
  await expect(asUser(db,ALICE,tx=>tx.query('insert into public.item_collections(user_id,item_id,collection_id) values($1,$2,$3)',[ALICE,own.id,foreignCollection.rows[0].id]))).rejects.toThrow();
  const value={title:'Private template',occasion:'Sport',notes:'',components:[{label:'shirt',item_id:other.id}]};expect((await request(app).patch(`/api/templates/${other.id}`).set(auth()).send(value)).status).toBe(404);
  await expect(asUser(db,ALICE,tx=>tx.query('select public.write_template($1::jsonb)',[JSON.stringify(value)]))).rejects.toThrow();
});
it('saves and edits flexible finished outfits while retaining wear history and feedback',async()=>{
  const swim=await manual({category:'underwear',name:'Reviewed swim garment'});const cap=await manual({category:'sports-equipment',name:'Swimming cap'});
  expect(manualOutfitSchema.safeParse({...outfit([swim.id]),confirmedComplete:false}).success).toBe(false);
  const saved=await request(app).post('/api/outfits/manual').set(auth()).send(outfit([swim.id,cap.id]));expect(saved.status,saved.text).toBe(201);const id=saved.body.id;
  expect((await request(app).post('/api/wear-logs').set(auth()).send({outfitId:id,wornOn:new Date().toISOString().slice(0,10)})).status).toBe(201);
  await request(app).post(`/api/outfits/${id}/feedback`).set(auth()).send({rating:5,comment:'Saved review'});
  const changed=await request(app).patch(`/api/outfits/${id}`).set(auth()).send({...outfit([swim.id]),title:'Updated swimming look'});expect(changed.status,changed.text).toBe(200);
  expect((await request(app).get('/api/wear-logs').set(auth())).body.logs.some((l:{outfit_id:string})=>l.outfit_id===id)).toBe(true);
  expect((await request(app).get('/api/outfits').set(auth())).body.outfits.find((o:{id:string})=>o.id===id).outfit_feedback[0].rating).toBe(5);
  expect((await request(app).patch(`/api/outfits/${id}`).set(auth('bob')).send(outfit([swim.id]))).status).toBe(404);
});
it('rejects foreign, pending, duplicate and unconfirmed manual outfit saves',async()=>{
  const foreign=await manual({},'bob');const own=await manual();const pending=await garment(db,ALICE,null,'pending');
  for(const ids of [[foreign.id],[pending],[own.id,own.id]])expect((await request(app).post('/api/outfits/manual').set(auth()).send(outfit(ids))).status).toBe(400);
  expect((await request(app).post('/api/outfits/manual').set(auth()).send({...outfit([own.id]),confirmedComplete:false})).status).toBe(400);
});
it('imports editable missing-component plans without increasing completed outfit counts',async()=>{
  const entry=provided.find(e=>e.kind==='template'&&e.source.includes('Thigh'))!;const before=(await request(app).get('/api/outfits').set(auth())).body.outfits.length;
  const result=await request(app).post('/api/import/commit').set(auth()).send({entries:[{key:entry.key,action:'create',reviewed:true,data:entry.template}]});expect(result.body.results[0].status,result.text).toBe('created');
  const templates=await request(app).get('/api/templates').set(auth());const template=templates.body.templates.find((t:{id:string})=>t.id===result.body.results[0].id);expect(template.template_components.every((c:{item_id:string|null})=>c.item_id===null)).toBe(true);
  const item=await manual();const data={...entry.template,components:[{label:'My clarified component',item_id:item.id}]};expect((await request(app).patch(`/api/templates/${template.id}`).set(auth()).send(data)).status).toBe(200);
  expect((await request(app).get('/api/outfits').set(auth())).body.outfits.length).toBe(before);
  expect((await request(app).delete(`/api/items/${item.id}`).set(auth())).status).toBe(204);expect((await request(app).get('/api/templates').set(auth())).body.templates[0].template_components[0].item_id).toBeNull();
});
it('attaches a private photo to an existing text record without duplicating or resetting review',async()=>{
  const item=await manual({name:'Text record photo attachment'});const photo=await sharp({create:{width:20,height:20,channels:3,background:'#ddd'}}).png().toBuffer();
  expect((await request(app).post(`/api/items/${item.id}/photo`).set(auth('bob')).attach('photo',photo,'test.png')).status).toBe(404);
  const result=await request(app).post(`/api/items/${item.id}/photo`).set(auth()).attach('photo',photo,'test.png');expect(result.status,result.text).toBe(200);expect(result.body).toMatchObject({id:item.id,status:'confirmed',photo_path:`${ALICE}/${item.id}.webp`});
  expect((await request(app).post(`/api/items/${item.id}/photo`).set(auth()).attach('photo',photo,'test.png')).status).toBe(409);
});
it('allows explicitly reviewed full sets in AI looks and keeps incomplete sets ineligible',async()=>{
  const set=await manual({category:'suits',set_coverage:'top-bottom'});const shoes=await manual({category:'shoes'});const unknown=await manual({category:'sets'});const inventory=[set,shoes,unknown];
  const value={suggestions:[{title:'Reviewed set',explanation:'Uses known coverage.',garmentIds:[set.id,shoes.id]}],inventoryNote:''};expect(validateRecommendations(value,inventory,ALICE).suggestions).toHaveLength(1);expect(lookCapacity(inventory)).toBe(1);
  expect(()=>validateRecommendations({...value,suggestions:[{...value.suggestions[0],garmentIds:[unknown.id,shoes.id]}]},inventory,ALICE)).toThrow();
  const saved=await request(app).post('/api/outfits').set(auth()).send({...value.suggestions[0],occasion:'Work',style:'Simple',season:'all-season'});expect(saved.status,saved.text).toBe(201);
});
it('serves curated provenance with fixed checked dates and no live-feed or photo claims',async()=>{
  const res=await request(app).get('/api/inspiration').set(auth());expect(res.body).toEqual(inspiration);expect(res.body.cards).toHaveLength(4);expect(res.body.mode).toBe('curated');
  expect(res.body.cards.every((c:{url:string;checkedAt:string})=>c.url.startsWith('https://')&&c.checkedAt==='2026-10-19')).toBe(true);expect(res.body.cards[3].publishedAt).toBeNull();
});
it('retains the approved Auth-deletion fix with all new child relationships present',async()=>{
  const owner=randomUUID();await db.query('insert into auth.users(id) values($1)',[owner]);
  await asUser(db,owner,async tx=>{
    const record=await tx.query<{id:string}>('select public.save_inventory($1::jsonb) id',[JSON.stringify(inventory({collections:['Work'],category:'sets'}))]);const id=record.rows[0].id;
    await tx.query('select public.write_template($1::jsonb)',[JSON.stringify({title:'Owned plan',occasion:'Sport',notes:'',components:[{label:'Set',item_id:id}]})]);
    await tx.query('select public.commit_wardrobe_import($1::jsonb)',[JSON.stringify({key:'sandals-1',kind:'item',action:'link',existingId:id,data:{collections:['Daily']}})]);
    const saved=await tx.query<{id:string}>('select public.save_manual_outfit($1::jsonb) id',[JSON.stringify(outfit([id]))]);
    await tx.query('insert into public.wear_logs(user_id,outfit_id,worn_on) values($1,$2,current_date)',[owner,saved.rows[0].id]);
    await tx.query('insert into public.outfit_feedback(user_id,outfit_id,rating) values($1,$2,5)',[owner,saved.rows[0].id]);
  });
  await db.query('delete from auth.users where id=$1',[owner]);
  for(const table of ['profiles','wardrobe_items','outfits','outfit_items','wear_logs','outfit_feedback','collections','item_collections','outfit_templates','template_components','wardrobe_import_entries']) {
    const key=table==='profiles'?'id':'user_id';expect((await db.query(`select * from public.${table} where ${key}=$1`,[owner])).rows,table).toHaveLength(0);
  }
  expect((await db.query('select id from auth.users where id=$1',[ALICE])).rows).toHaveLength(1);
});
