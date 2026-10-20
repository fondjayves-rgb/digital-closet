// Test-only Supabase boundary adapter: real PostgreSQL and RLS, simulated Auth and Storage.
// This is never imported by the application and is not evidence of live provider success.
import type { PGlite, Transaction } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { asUser } from './database';
type Row = Record<string, any>;
const identifier = (value: string) => { if (!/^[a-z_]+$/.test(value)) throw new Error('Unsafe test identifier'); return `"${value}"`; };
export function testClient(db: PGlite, userId: string | null, photos: Map<string, Buffer>): SupabaseClient {
  const run = <T>(callback: (tx: Transaction) => Promise<T>) => userId ? asUser(db,userId,callback) : db.transaction(callback);
  class Query {
    filters: { column: string; values: unknown[]; op: string }[]=[]; operation='select'; values: Row | null=null; columns='*'; max=1000; one=false; sortColumn=''; ascending=true;
    constructor(public table:string){}
    select(columns='*') { this.columns=columns; return this; }
    eq(column:string,value:unknown) { this.filters.push({column,values:[value],op:'='}); return this; }
    is(column:string,value:null) { this.filters.push({column,values:[value],op:'is'}); return this; }
    in(column:string,values:unknown[]) { this.filters.push({column,values,op:'in'}); return this; }
    order(column:string,options?:{ascending?:boolean}) { this.sortColumn=column; this.ascending=options?.ascending ?? true; return this; }
    limit(max:number) { this.max=max; return this; }
    single() { this.one=true; return this; }
    insert(values:Row) { this.operation='insert'; this.values=values; return this; }
    update(values:Row) { this.operation='update'; this.values=values; return this; }
    delete() { this.operation='delete'; return this; }
    then(resolve:(value:unknown)=>unknown,reject?:(reason:unknown)=>unknown) { return this.execute().then(resolve,reject); }
    async execute() {
      try {
        const data=await run(async tx=> {
          const params:unknown[]=[]; const param=(value:unknown)=>{params.push(value);return `$${params.length}`;};
          let sql=''; const table=`public.${identifier(this.table)}`;
          if(this.operation==='insert') { const entries=Object.entries(this.values!); sql=`insert into ${table}(${entries.map(([k])=>identifier(k)).join(',')}) values(${entries.map(([,v])=>param(v)).join(',')})`; }
          else if(this.operation==='update') sql=`update ${table} set ${Object.entries(this.values!).map(([k,v])=>`${identifier(k)}=${param(v)}`).join(',')}`;
          else if(this.operation==='delete') sql=`delete from ${table}`;
          else sql=`select * from ${table}`;
          if(this.operation!=='insert' && this.filters.length) sql+=' where '+this.filters.map(f=>f.op==='is'?`${identifier(f.column)} is null`:f.op==='in'?`${identifier(f.column)} in (${f.values.map(param).join(',')})`:`${identifier(f.column)}=${param(f.values[0])}`).join(' and ');
          if(this.operation==='select') { if(this.sortColumn) sql+=` order by ${identifier(this.sortColumn)} ${this.ascending?'asc':'desc'}`; sql+=` limit ${Number(this.max)}`; }
          else sql+=' returning *';
          const result=await tx.query<Row>(sql,params);
          for(const row of result.rows) {
            if(this.columns.includes('outfit_items(')) row.outfit_items=(await tx.query('select item_id from public.outfit_items where outfit_id=$1',[row.id])).rows;
            // Match PostgREST's to-one embedding for unique(user_id,outfit_id).
            if(this.columns.includes('outfit_feedback(')) row.outfit_feedback=(await tx.query('select rating,comment from public.outfit_feedback where outfit_id=$1',[row.id])).rows[0] ?? null;
            if(this.columns.includes('outfits(')) row.outfits=(await tx.query('select title from public.outfits where id=$1',[row.outfit_id])).rows[0] ?? null;
            if(this.columns.includes('template_components(')) row.template_components=(await tx.query('select id,label,item_id from public.template_components where template_id=$1 order by id',[row.id])).rows;
          }
          if(this.one) { if(result.rows.length!==1) throw Object.assign(new Error('Not found'),{code:'PGRST116'}); return result.rows[0]; }
          return result.rows;
        });
        return {data,error:null};
      } catch(error) { return {data:null,error:{code:(error as {code:string}).code,message:'Test database rejected operation'}}; }
    }
  }
  return {
    from:(table:string)=>new Query(table),
    rpc:async(name:string,args:Row={})=> {
      try {
        const data=await run(async tx=> {
          if(name==='save_outfit') return (await tx.query<{id:string}>('select public.save_outfit($1::jsonb) as id',[JSON.stringify(args.payload)])).rows[0].id;
          if(name==='wardrobe_update_version') return (await tx.query<{version:number}>('select public.wardrobe_update_version() as version')).rows[0].version;
          if(name==='list_inventory') return (await tx.query<{result:unknown}>('select public.list_inventory($1::jsonb) as result',[JSON.stringify(args.filters)])).rows[0].result;
          if(name==='save_inventory' || name==='write_template') return (await tx.query<{id:string}>(`select public.${name}($1::jsonb,$2::uuid) as id`,[JSON.stringify(args.payload),args.target ?? null])).rows[0].id;
          if(name==='commit_wardrobe_import') return (await tx.query<{result:unknown}>('select public.commit_wardrobe_import($1::jsonb) as result',[JSON.stringify(args.payload)])).rows[0].result;
          if(name==='save_manual_outfit') return (await tx.query<{id:string}>('select public.save_manual_outfit($1::jsonb) as id',[JSON.stringify(args.payload)])).rows[0].id;
          if(name==='write_saved_outfit') return (await tx.query<{id:string}>('select public.write_saved_outfit($1::jsonb,$2::uuid,$3::text) as id',[JSON.stringify(args.payload),args.target,args.method])).rows[0].id;
          if(name==='claim_tag_job') return (await tx.query('select * from public.claim_tag_job()')).rows;
          if(name==='finish_tag_job') return (await tx.query<{done:boolean}>('select public.finish_tag_job($1,$2,$3::jsonb,$4) as done',[args.job_uuid,args.token,args.tags===null?null:JSON.stringify(args.tags),args.error_text])).rows[0].done;
          throw new Error('Unimplemented test RPC');
        });return {data,error:null};
      }catch(error){return {data:null,error:{code:(error as {code:string}).code,message:'Test RPC rejected'}};}
    },
    storage:{from:()=>({
      upload:async(path:string,buffer:Buffer)=> { if(userId&&!path.startsWith(`${userId}/`)) return {error:{message:'Denied'}}; photos.set(path,buffer); return {data:{path},error:null}; },
      remove:async(paths:string[])=>{for(const path of paths){if(userId&&!path.startsWith(`${userId}/`))return {error:{message:'Denied'}};photos.delete(path);}return {data:[],error:null};},
      download:async(path:string)=> {const buffer=photos.get(path);return {data:buffer?new Blob([new Uint8Array(buffer)]):null,error:buffer?null:{message:'Not found'}};},
      createSignedUrls:async(paths:string[])=>({data:paths.map(path=>({signedUrl:`https://private.test/${path}?expires=300`})),error:null}),
    })},
  } as unknown as SupabaseClient;
}
