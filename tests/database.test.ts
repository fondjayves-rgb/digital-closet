import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { database, asUser, garment, ALICE, BOB } from './database';
import { randomUUID } from 'node:crypto';
let db: PGlite; let top: string; let bottom: string; let shoes: string; let foreign: string; let draft: string; let saved: string;
const payload = (ids: string[]) => ({ title:'A considered look', explanation:'Ivory and navy work together.', occasion:'Everyday',style:'Simple',season:'all-season',garmentIds:ids });
beforeAll(async () => { db=await database(); top=await garment(db,ALICE,'tops'); bottom=await garment(db,ALICE,'bottoms'); shoes=await garment(db,ALICE,'shoes'); foreign=await garment(db,BOB,'tops'); draft=await garment(db,ALICE,null,'pending'); },60000);
afterAll(async () => { await db?.close(); });
describe('PostgreSQL migration and ownership',() => {
  it('creates all thirteen tables with RLS enabled and private storage',async () => {
    const tables=await db.query<{relname:string;relrowsecurity:boolean}>("select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r'");
    expect(tables.rows).toHaveLength(13); expect(tables.rows.every(t=>t.relrowsecurity)).toBe(true);
    expect((await db.query<{public:boolean}>("select public from storage.buckets where id='garment-photos'")).rows[0].public).toBe(false);
  });
  it('creates profiles through the Auth trigger',async () => {
    const rows=await asUser(db,ALICE,tx=>tx.query('select * from public.profiles'));
    expect(rows.rows).toHaveLength(1); expect(rows.rows[0]).toMatchObject({id:ALICE});
  });
  it('hides other accounts’ garments and rejects owner reassignment',async () => {
    const result=await asUser(db,ALICE,tx=>tx.query('select id from public.wardrobe_items where id=$1',[foreign])); expect(result.rows).toEqual([]);
    await expect(asUser(db,ALICE,tx=>tx.query('update public.wardrobe_items set user_id=$1 where id=$2',[BOB,top]))).rejects.toThrow();
  });
  it('rejects incomplete confirmation and accepts reviewed details',async () => {
    await expect(asUser(db,ALICE,tx=>tx.query("update public.wardrobe_items set status='confirmed' where id=$1",[draft]))).rejects.toThrow();
    await asUser(db,ALICE,tx=>tx.query("update public.wardrobe_items set name='Reviewed shirt',category='tops',color='navy',status='confirmed' where id=$1",[draft]));
    const result=await asUser(db,ALICE,tx=>tx.query('select status from public.wardrobe_items where id=$1',[draft])); expect(result.rows[0]).toMatchObject({status:'confirmed'});
  });
  it('atomically saves a complete owned outfit',async () => {
    const result=await asUser(db,ALICE,tx=>tx.query<{id:string}>('select public.save_outfit($1::jsonb) as id',[JSON.stringify(payload([top,bottom,shoes]))])); saved=result.rows[0].id;
    expect((await asUser(db,ALICE,tx=>tx.query('select * from public.outfit_items where outfit_id=$1',[saved]))).rows).toHaveLength(3);
  });
  it('rejects foreign, missing, duplicate, pending and incomplete garment sets',async () => {
    const pending=await garment(db,ALICE,'tops','pending');
    for (const ids of [[foreign,bottom,shoes],[top,bottom],[top,bottom,shoes,top],[pending,bottom,shoes],['99999999-9999-4999-8999-999999999999',bottom,shoes]]) {
      await expect(asUser(db,ALICE,tx=>tx.query('select public.save_outfit($1::jsonb)',[JSON.stringify(payload(ids))]))).rejects.toThrow();
    }
    expect((await asUser(db,ALICE,tx=>tx.query('select * from public.outfits'))).rows).toHaveLength(1);
  });
  it('rejects direct cross-account outfit associations and unconfirmed items',async () => {
    await expect(asUser(db,ALICE,tx=>tx.query('insert into public.outfit_items(outfit_id,item_id,user_id) values($1,$2,$3)',[saved,foreign,ALICE]))).rejects.toThrow();
    const pending=await garment(db,ALICE,'tops','pending');
    await expect(asUser(db,ALICE,tx=>tx.query('insert into public.outfit_items(outfit_id,item_id,user_id) values($1,$2,$3)',[saved,pending,ALICE]))).rejects.toThrow();
  });
  it('isolates all eight record types between users',async () => {
    await asUser(db,ALICE,tx=>tx.query("insert into public.wear_logs(user_id,outfit_id,worn_on) values($1,$2,current_date)",[ALICE,saved]));
    await asUser(db,ALICE,tx=>tx.query("insert into public.outfit_feedback(user_id,outfit_id,rating,comment) values($1,$2,4,'Liked it')",[ALICE,saved]));
    for (const table of ['profiles','wardrobe_items','ai_tag_jobs','tag_suggestions','outfits','outfit_items','wear_logs','outfit_feedback']) {
      const ownerColumn=table==='profiles'?'id':'user_id';
      const result=await asUser(db,BOB,tx=>tx.query(`select * from public.${table} where ${ownerColumn}=$1`,[ALICE])); expect(result.rows,table).toEqual([]);
    }
  });
  it('rejects cross-account wear and feedback associations',async () => {
    await expect(asUser(db,BOB,tx=>tx.query('insert into public.wear_logs(user_id,outfit_id,worn_on) values($1,$2,current_date)',[BOB,saved]))).rejects.toThrow();
    await expect(asUser(db,BOB,tx=>tx.query('insert into public.outfit_feedback(user_id,outfit_id,rating) values($1,$2,5)',[BOB,saved]))).rejects.toThrow();
  });
  it('keeps private storage objects account-scoped',async () => {
    await asUser(db,ALICE,tx=>tx.query("insert into storage.objects(bucket_id,name) values('garment-photos',$1)",[`${ALICE}/photo.webp`]));
    expect((await asUser(db,BOB,tx=>tx.query('select * from storage.objects'))).rows).toEqual([]);
    await expect(asUser(db,BOB,tx=>tx.query("insert into storage.objects(bucket_id,name) values('garment-photos',$1)",[`${ALICE}/stolen.webp`]))).rejects.toThrow();
    expect((await asUser(db,BOB,tx=>tx.query('delete from storage.objects returning *'))).rows).toEqual([]);
  });
  it('prevents anonymous access and privileged job RPC access',async () => {
    await expect(db.transaction(async tx=> { await tx.exec('set local role anon'); return tx.query('select * from public.wardrobe_items'); })).rejects.toThrow();
    await expect(asUser(db,ALICE,tx=>tx.query('select * from public.claim_tag_job()'))).rejects.toThrow();
    await expect(asUser(db,ALICE,tx=>tx.query("insert into public.tag_suggestions(user_id,item_id,job_id,proposed_tags) values($1,$2,gen_random_uuid(),'{}')",[ALICE,top]))).rejects.toThrow();
  });
  it('preserves history and invalidates saved looks after a garment deletion',async () => {
    await asUser(db,ALICE,tx=>tx.query('delete from public.wardrobe_items where id=$1',[top]));
    const result=await asUser(db,ALICE,tx=>tx.query('select invalidated from public.outfits where id=$1',[saved])); expect(result.rows[0]).toMatchObject({invalidated:true});
    expect((await asUser(db,ALICE,tx=>tx.query('select * from public.wear_logs where outfit_id=$1',[saved]))).rows).toHaveLength(1);
    await expect(asUser(db,ALICE,tx=>tx.query("insert into public.wear_logs(user_id,outfit_id,worn_on) values($1,$2,current_date-1)",[ALICE,saved]))).rejects.toThrow();
  });
});
describe('durable worker leases and tag approval',() => {
  async function enqueue() {
    const itemId=await garment(db,ALICE,null,'pending');
    const result=await asUser(db,ALICE,tx=>tx.query<{id:string}>('insert into public.ai_tag_jobs(user_id,item_id) values($1,$2) returning id',[ALICE,itemId]));
    return {itemId,jobId:result.rows[0].id};
  }
  async function claim() { return (await db.query<{id:string;lease_token:string;attempts:number}>('select * from public.claim_tag_job()')).rows[0]; }
  it('enforces pending-only, owned queue insertion and one active job',async () => {
    const {itemId}=await enqueue();
    await expect(asUser(db,ALICE,tx=>tx.query('insert into public.ai_tag_jobs(user_id,item_id) values($1,$2)',[ALICE,itemId]))).rejects.toThrow();
    await expect(asUser(db,BOB,tx=>tx.query('insert into public.ai_tag_jobs(user_id,item_id) values($1,$2)',[BOB,itemId]))).rejects.toThrow();
    await expect(asUser(db,ALICE,tx=>tx.query('insert into public.ai_tag_jobs(user_id,item_id) values($1,$2)',[ALICE,bottom]))).rejects.toThrow();
    await db.query("update public.ai_tag_jobs set status='cancelled' where item_id=$1",[itemId]);
  });
  it('stores AI proposals without confirming a garment',async () => {
    const {itemId,jobId}=await enqueue(); const job=await claim(); expect(job.id).toBe(jobId);
    const tags={category:'tops',color:'ivory',pattern:'solid',attributes:[]};
    await db.query('select public.finish_tag_job($1,$2,$3::jsonb,null)',[job.id,job.lease_token,JSON.stringify(tags)]);
    const item=await db.query('select status,category from public.wardrobe_items where id=$1',[itemId]); expect(item.rows[0]).toMatchObject({status:'pending',category:null});
    expect((await asUser(db,ALICE,tx=>tx.query('select proposed_tags from public.tag_suggestions where item_id=$1',[itemId]))).rows[0]).toMatchObject({proposed_tags:tags});
    expect((await asUser(db,BOB,tx=>tx.query('select * from public.tag_suggestions where item_id=$1',[itemId]))).rows).toEqual([]);
  });
  it('cancels in-flight analysis when the user confirms tags',async () => {
    const {itemId,jobId}=await enqueue(); const job=await claim();
    await asUser(db,ALICE,tx=>tx.query("update public.wardrobe_items set category='tops',color='red',status='confirmed' where id=$1",[itemId]));
    const finish=await db.query<{done:boolean}>('select public.finish_tag_job($1,$2,$3::jsonb,null) as done',[jobId,job.lease_token,'{}']); expect(finish.rows[0].done).toBe(false);
    expect((await db.query('select status from public.ai_tag_jobs where id=$1',[jobId])).rows[0]).toMatchObject({status:'cancelled'});
  });
  it('rejects stale workers after lease recovery',async () => {
    const {jobId}=await enqueue(); const first=await claim();
    await db.query("update public.ai_tag_jobs set lease_until=now()-interval '1 second' where id=$1",[jobId]);
    const second=await claim(); expect(second.attempts).toBe(2); expect(second.lease_token).not.toBe(first.lease_token);
    expect((await db.query<{done:boolean}>('select public.finish_tag_job($1,$2,$3::jsonb,null) as done',[jobId,first.lease_token,'{}'])).rows[0].done).toBe(false);
    await db.query("update public.ai_tag_jobs set status='cancelled',lease_until=null,lease_token=null where id=$1",[jobId]);
  });
  it('bounds retries at three attempts and records a terminal error',async () => {
    const {jobId}=await enqueue();
    for(let n=1;n<=3;n++) { const job=await claim(); expect(job.attempts).toBe(n); await db.query('select public.finish_tag_job($1,$2,null,$3)',[jobId,job.lease_token,'Safe analysis failure']); await db.query("update public.ai_tag_jobs set available_at=now()-interval '1 second' where id=$1",[jobId]); }
    expect((await db.query('select status,attempts,last_error from public.ai_tag_jobs where id=$1',[jobId])).rows[0]).toMatchObject({status:'failed',attempts:3,last_error:'Safe analysis failure'});
    expect(await claim()).toBeUndefined();
  });
  it('marks a worker that crashed on its third lease as failed',async () => {
    const {jobId}=await enqueue();
    await db.query("update public.ai_tag_jobs set status='processing',attempts=3,lease_until=now()-interval '1 second',lease_token=gen_random_uuid() where id=$1",[jobId]);
    expect(await claim()).toBeUndefined(); expect((await db.query('select status from public.ai_tag_jobs where id=$1',[jobId])).rows[0]).toMatchObject({status:'failed'});
  });
  it('allows the service role to claim and finish a job without granting user mutation rights',async () => {
    const {jobId}=await enqueue();
    await db.transaction(async tx=>{
      await tx.exec('set local role service_role');
      const result=await tx.query<{id:string;lease_token:string}>('select * from public.claim_tag_job()');expect(result.rows[0].id).toBe(jobId);
      const finished=await tx.query<{done:boolean}>('select public.finish_tag_job($1,$2,$3::jsonb,null) as done',[jobId,result.rows[0].lease_token,JSON.stringify({category:'tops',color:'navy',pattern:'solid',attributes:[]})]);expect(finished.rows[0].done).toBe(true);
    });
  });
  it('deletes an Auth account with saved outfits and history without affecting another account', async () => {
    const userId = randomUUID();
    await db.query('insert into auth.users(id) values($1)', [userId]);
    const ids: string[] = [];
    for (const category of ['tops', 'bottoms', 'shoes']) ids.push(await garment(db, userId, category));
    const saved = await asUser(db, userId, tx => tx.query<{ id: string }>('select public.save_outfit($1::jsonb) as id', [JSON.stringify(payload(ids))]));
    await asUser(db, userId, tx => tx.query('insert into public.wear_logs(user_id,outfit_id,worn_on) values($1,$2,current_date)', [userId, saved.rows[0].id]));
    await asUser(db, userId, tx => tx.query('insert into public.outfit_feedback(user_id,outfit_id,rating) values($1,$2,5)', [userId, saved.rows[0].id]));
    const bobBefore = (await asUser(db, BOB, tx => tx.query('select id from public.wardrobe_items'))).rows.length;
    await db.query('delete from auth.users where id=$1', [userId]);
    for (const table of ['profiles', 'wardrobe_items', 'ai_tag_jobs', 'tag_suggestions', 'outfits', 'outfit_items', 'wear_logs', 'outfit_feedback']) {
      const column = table === 'profiles' ? 'id' : 'user_id';
      expect((await db.query(`select * from public.${table} where ${column}=$1`, [userId])).rows, table).toEqual([]);
    }
    expect((await asUser(db, BOB, tx => tx.query('select id from public.wardrobe_items'))).rows.length).toBe(bobBefore);
  });
});
