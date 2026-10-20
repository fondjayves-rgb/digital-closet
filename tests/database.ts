import { PGlite, type Transaction } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
export const ALICE = '11111111-1111-4111-8111-111111111111';
export const BOB = '22222222-2222-4222-8222-222222222222';
export async function database(options: { initialOnly?: boolean; beforeUpdate?:boolean } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth,storage to authenticated,anon,service_role;
    grant execute on function auth.uid() to authenticated,anon,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
  `);
  const directory = new URL('../supabase/migrations/', import.meta.url);
  const migrations = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
  for (const name of options.initialOnly ? migrations.slice(0, 1) : options.beforeUpdate ? migrations.slice(0,2) : migrations) {
    await db.exec(await readFile(new URL(name, directory), 'utf8'));
  }
  await db.query('insert into auth.users(id) values($1),($2)',[ALICE,BOB]);
  return db;
}
export function asUser<T>(db: PGlite, userId: string, callback: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[userId]);
    return callback(tx);
  });
}
export async function garment(db: PGlite, userId: string, category: string | null, status = 'confirmed') {
  const { rows } = await db.query<{id:string}>(`insert into public.wardrobe_items(id,user_id,photo_path,name,status,category,color,pattern)
    select id,$1::uuid,$1::text || '/' || id::text || '.webp','Test garment',$2,$3,'ivory','solid' from (select gen_random_uuid() as id) x returning id`,[userId,status,category]);
  return rows[0].id;
}
