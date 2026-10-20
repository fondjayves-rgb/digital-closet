import { beforeAll,afterAll,it,expect,vi } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import type { PGlite } from '@electric-sql/pglite';
import { createApp } from '../apps/api/src/app';
import { HttpError } from '../apps/api/src/errors';
import { processNextJob } from '../apps/api/src/jobs';
import { database,garment,ALICE,BOB } from './database';
import { testClient } from './adapter';
import type { AIProvider } from '../apps/api/src/ai';
import { readConfig } from '../apps/api/src/config';
let db:PGlite; let app:ReturnType<typeof createApp>; let photo:Buffer; let uploaded:string; let saved:string;
const photos=new Map<string,Buffer>();
const recognize=vi.fn<AIProvider['recognize']>().mockResolvedValue({category:'tops',color:'ivory',pattern:'solid',attributes:['collar']});
const suggest=vi.fn<AIProvider['suggest']>(); const ai={recognize,suggest};
const auth=(token='alice')=>({Authorization:`Bearer ${token}`});
beforeAll(async()=>{
  db=await database();photo=await sharp({create:{width:20,height:20,channels:3,background:'#ded7ca'}}).png().toBuffer();
  app=createApp({config:{...readConfig(),supabaseUrl:'https://test.invalid',publishableKey:'test',secretKey:'test',openaiKey:'test',model:'test'},ai,
    authenticate:async token=>{if(!['alice','bob'].includes(token)) throw new HttpError(401,'Invalid test token');const userId=token==='alice'?ALICE:BOB;return {userId,db:testClient(db,userId,photos)};}});
},60000);
afterAll(async()=>{await db?.close();});
it('requires authentication on protected routes',async()=>{expect((await request(app).get('/api/items')).status).toBe(401);expect((await request(app).get('/api/items').set(auth('invalid'))).status).toBe(401);});
it('returns helpful missing-configuration responses, without fake sessions',async()=>{
  const unconfigured=createApp({config:{port:3001,webOrigin:'http://127.0.0.1:5173',supabaseUrl:'',publishableKey:'',secretKey:'',openaiKey:'',model:''}});
  const setup=await request(unconfigured).get('/api/setup');expect(setup.body.ready).toBe(false);expect(setup.body.missing).toContain('SUPABASE_URL');
  expect((await request(unconfigured).get('/api/items').set(auth())).status).toBe(503);
});
it('rejects forged photo contents, wrong types, extra fields, and oversized photos',async()=>{
  expect((await request(app).post('/api/items').set(auth()).attach('photo',Buffer.from('not an image'),{filename:'fake.png',contentType:'image/png'})).status).toBe(415);
  expect((await request(app).post('/api/items').set(auth()).attach('photo',photo,{filename:'file.svg',contentType:'image/svg+xml'})).status).toBe(415);
  expect((await request(app).post('/api/items').set(auth()).field('user_id',BOB).attach('photo',photo,{filename:'photo.png',contentType:'image/png'})).status).toBe(400);
  expect((await request(app).post('/api/items').set(auth()).attach('photo',Buffer.alloc(8*1024*1024+1),{filename:'big.png',contentType:'image/png'})).status).toBe(413);
});
it('uploads a photo into a private, owned pending draft and signs its access',async()=>{
  const result=await request(app).post('/api/items').set(auth()).attach('photo',photo,{filename:'my-shirt.png',contentType:'image/png'});
  expect(result.status,result.text).toBe(201);uploaded=result.body.id;expect(result.body).toMatchObject({user_id:ALICE,status:'pending',category:null});
  expect(result.body.photo_path).toBe(`${ALICE}/${uploaded}.webp`);expect(result.body.photoUrl).toContain('expires=300');expect(photos.has(result.body.photo_path)).toBe(true);
  expect((await sharp(photos.get(result.body.photo_path)).metadata()).format).toBe('webp');
});
it('isolates garment reads, edits, analysis and deletion at the API',async()=>{
  for(const method of ['get','delete'] as const) expect((await request(app)[method](`/api/items/${uploaded}`).set(auth('bob'))).status).toBe(404);
  expect((await request(app).patch(`/api/items/${uploaded}/confirm`).set(auth('bob')).send({})).status).toBe(404);
  expect((await request(app).post(`/api/items/${uploaded}/analyze`).set(auth('bob'))).status).toBe(404);
  expect((await request(app).get('/api/items').set(auth('bob'))).body.items).toEqual([]);
});
it('queues and processes tags without automatically confirming them',async()=>{
  const result=await request(app).post(`/api/items/${uploaded}/analyze`).set(auth());expect(result.status,result.text).toBe(202);
  const second=await request(app).post(`/api/items/${uploaded}/analyze`).set(auth());expect(second.body.id).toBe(result.body.id);
  expect(await processNextJob(testClient(db,null,photos),ai)).toBe(true);expect(recognize).toHaveBeenCalledTimes(1);
  const item=await request(app).get(`/api/items/${uploaded}`).set(auth());expect(item.body.job.status).toBe('succeeded');expect(item.body.item.status).toBe('pending');expect(item.body.suggestion.category).toBe('tops');
  expect((await request(app).get(`/api/jobs/${result.body.id}`).set(auth('bob'))).status).toBe(404);
});
it('honestly reports insufficient confirmed inventory',async()=>{
  const result=await request(app).post('/api/outfits/suggest').set(auth()).send({occasion:'Everyday',style:'Simple',season:'all-season'});expect(result.status).toBe(200);expect(result.body.suggestions).toEqual([]);expect(result.body.inventoryNote).toContain('confirmed');expect(suggest).not.toHaveBeenCalled();
});
it('requires complete reviewed tags and rejects unsupported AI-style claims',async()=>{
  expect((await request(app).patch(`/api/items/${uploaded}/confirm`).set(auth()).send({name:'Shirt',category:'tops',color:'',pattern:'solid',attributes:[]})).status).toBe(400);
  expect((await request(app).patch(`/api/items/${uploaded}/confirm`).set(auth()).send({name:'Shirt',category:'tops',color:'ivory',pattern:'solid',attributes:[],material:'cotton'})).status).toBe(400);
  const result=await request(app).patch(`/api/items/${uploaded}/confirm`).set(auth()).send({name:'Favorite shirt',category:'tops',color:'ivory',pattern:'solid',attributes:['collar']});expect(result.status,result.text).toBe(200);expect(result.body.status).toBe('confirmed');
});
it('validates all AI garment IDs and saves, wears and rates an owned outfit',async()=>{
  const bottom=await garment(db,ALICE,'bottoms');const shoes=await garment(db,ALICE,'shoes');const foreign=await garment(db,BOB,'tops');
  const outfit={title:'Everyday, thoughtfully',explanation:'An ivory shirt with neutral bottoms and shoes.',garmentIds:[uploaded,bottom,shoes]};
  const input={occasion:'Everyday',style:'Simple',season:'all-season'};
  suggest.mockResolvedValueOnce({suggestions:[{...outfit,garmentIds:[foreign,bottom,shoes]}],inventoryNote:''});
  expect((await request(app).post('/api/outfits/suggest').set(auth()).send(input)).status).toBe(502);
  suggest.mockResolvedValueOnce({suggestions:[outfit],inventoryNote:''});
  const ideas=await request(app).post('/api/outfits/suggest').set(auth()).send(input);expect(ideas.status,ideas.text).toBe(200);expect(ideas.body.suggestions).toHaveLength(1);expect(ideas.body.inventoryNote).toContain('1 distinct');
  expect((await request(app).post('/api/outfits').set(auth('bob')).send({...outfit,...input})).status).toBe(400);
  const result=await request(app).post('/api/outfits').set(auth()).send({...outfit,...input});expect(result.status,result.text).toBe(201);saved=result.body.id;
  const outfits=await request(app).get('/api/outfits').set(auth());expect(outfits.body.outfits[0].outfit_items).toHaveLength(3);
  const date=new Date().toISOString().slice(0,10);
  expect((await request(app).post('/api/wear-logs').set(auth('bob')).send({outfitId:saved,wornOn:date})).status).toBe(404);
  expect((await request(app).post('/api/wear-logs').set(auth()).send({outfitId:saved,wornOn:date})).status).toBe(201);
  expect((await request(app).post(`/api/outfits/${saved}/feedback`).set(auth('bob')).send({rating:5,comment:''})).status).toBe(404);
  expect((await request(app).post(`/api/outfits/${saved}/feedback`).set(auth()).send({rating:5,comment:'Will wear again'})).status).toBe(200);
  expect((await request(app).get('/api/wear-logs').set(auth())).body.logs).toHaveLength(1);
});
it('returns three distinct suggestions when optional layers provide capacity',async()=>{
  const outer=await garment(db,ALICE,'outerwear');const accessory=await garment(db,ALICE,'accessories');
  const result=await db.query<{item_id:string}>('select item_id from public.outfit_items where outfit_id=$1',[saved]);const ids=result.rows.map(i=>i.item_id);
  suggest.mockResolvedValueOnce({suggestions:[{title:'Simple',explanation:'A simple outfit.',garmentIds:ids},{title:'Layered',explanation:'A visible layer.',garmentIds:[...ids,outer]},{title:'Finishing touch',explanation:'An added accessory.',garmentIds:[...ids,accessory]}],inventoryNote:''});
  const response=await request(app).post('/api/outfits/suggest').set(auth()).send({occasion:'Everyday',style:'Simple',season:'all-season'});expect(response.status,response.text).toBe(200);expect(response.body.suggestions).toHaveLength(3);
});
it('deletes the private photo and marks affected saved outfits unavailable',async()=>{
  expect((await request(app).delete(`/api/items/${uploaded}`).set(auth())).status).toBe(204);expect(photos.has(`${ALICE}/${uploaded}.webp`)).toBe(false);
  const result=await request(app).get('/api/outfits').set(auth());expect(result.body.outfits[0].invalidated).toBe(true);
  expect((await request(app).post('/api/wear-logs').set(auth()).send({outfitId:saved,wornOn:new Date().toISOString().slice(0,10)})).status).toBe(409);
});
