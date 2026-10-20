-- Forward-only feature update. No seed, reset, or replacement of existing records.
alter table public.wardrobe_items alter column photo_path drop not null;
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid='public.wardrobe_items'::regclass and contype='c' and pg_get_constraintdef(oid) like '%category%' loop
    execute format('alter table public.wardrobe_items drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.wardrobe_items
  add constraint inventory_category check(category in ('tops','bottoms','dresses','outerwear','shoes','accessories','socks','underwear','sets','suits','afritude','headwear','sleepwear','after-shower','sports-equipment','fragrance')),
  add constraint reviewed_category check(status <> 'confirmed' or category is not null),
  add column brand text check(length(brand)<=100), add column fit text check(length(fit)<=80), add column subtype text check(length(subtype)<=80),
  add column quantity integer check(quantity between 1 and 10000),
  add column quantity_unit text not null default 'unspecified' check(quantity_unit in ('unspecified','pieces','pairs','sets','bottles')),
  add column pack_count integer check(pack_count between 1 and 10000),
  add column pack_description text not null default '' check(length(pack_description)<=300),
  add column source_description text not null default '' check(length(source_description)<=2000),
  add column review_notes text not null default '' check(length(review_notes)<=1000),
  add column is_favorite boolean not null default false,
  add column set_coverage text not null default 'unspecified' check(set_coverage in ('unspecified','top-bottom')),
  add constraint set_coverage_category check(set_coverage='unspecified' or category in ('sets','suits'));
alter table public.profiles add column gender text check(gender in ('man','woman','nonbinary','self-described','prefer-not-to-say')),
  add column gender_description text not null default '' check(length(gender_description)<=80),
  add column default_occasion text not null default '' check(length(default_occasion)<=120);
alter table public.outfits add column creation_method text not null default 'ai' check(creation_method in ('ai','manual')),
  add column manual_confirmed boolean not null default false,
  add constraint manual_completion check(creation_method <> 'manual' or manual_confirmed);

create table public.collections (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 80), unique(user_id,name), unique(id,user_id)
);
create table public.item_collections (
  user_id uuid not null references auth.users(id) on delete cascade, item_id uuid not null, collection_id uuid not null,
  primary key(item_id,collection_id),
  foreign key(item_id,user_id) references public.wardrobe_items(id,user_id) on delete cascade,
  foreign key(collection_id,user_id) references public.collections(id,user_id) on delete cascade
);
create index item_collections_owner on public.item_collections(user_id,collection_id);
create table public.outfit_templates (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(length(trim(title)) between 1 and 100), occasion text not null check(length(trim(occasion)) between 1 and 120),
  notes text not null default '' check(length(notes)<=2000), unique(id,user_id)
);
create table public.template_components (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null, label text not null check(length(trim(label)) between 1 and 120), item_id uuid,
  foreign key(template_id,user_id) references public.outfit_templates(id,user_id) on delete cascade,
  foreign key(item_id,user_id) references public.wardrobe_items(id,user_id) on delete set null(item_id)
);
create index template_components_owner on public.template_components(user_id,template_id);
create index template_components_item on public.template_components(item_id,user_id);
create trigger reviewed_template_item before insert or update of item_id on public.template_components for each row execute function private.guard_outfit_item();
-- Unlike outfit associations, a template slot may remain unmatched.
create function private.guard_template_item() returns trigger language plpgsql set search_path='' as $$
begin
  if new.item_id is not null and not exists(select 1 from public.wardrobe_items where id=new.item_id and user_id=new.user_id and status='confirmed') then raise exception 'Choose a reviewed owned item'; end if;
  return new;
end $$;
drop trigger reviewed_template_item on public.template_components;
create trigger reviewed_template_item before insert or update on public.template_components for each row execute function private.guard_template_item();
create table public.wardrobe_import_entries (
  user_id uuid not null references auth.users(id) on delete cascade, import_id text not null, source_key text not null,
  item_id uuid, template_id uuid, created_at timestamptz not null default now(),
  primary key(user_id,import_id,source_key), check(import_id='provided-wardrobe-v1'), check(not(item_id is not null and template_id is not null)),
  foreign key(item_id,user_id) references public.wardrobe_items(id,user_id) on delete set null(item_id),
  foreign key(template_id,user_id) references public.outfit_templates(id,user_id) on delete set null(template_id)
);
create index import_item on public.wardrobe_import_entries(item_id,user_id);
create index import_template on public.wardrobe_import_entries(template_id,user_id);
create index inventory_favorites on public.wardrobe_items(user_id,is_favorite,created_at desc,id);
do $$ declare t text; begin
  foreach t in array array['collections','item_collections','outfit_templates','template_components','wardrobe_import_entries'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner_access on public.%I for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',t);
    execute format('create trigger keep_owner before update on public.%I for each row execute function private.immutable_owner()',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
grant update(gender,gender_description,default_occasion) on public.profiles to authenticated;
grant update(photo_path,brand,fit,subtype,quantity,quantity_unit,pack_count,pack_description,source_description,review_notes,is_favorite,set_coverage) on public.wardrobe_items to authenticated;
create policy outfit_edit on public.outfits for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant update(title,explanation,occasion,style,season,invalidated,manual_confirmed) on public.outfits to authenticated;
create policy outfit_item_remove on public.outfit_items for delete to authenticated using(user_id=(select auth.uid()));
grant delete on public.outfit_items to authenticated;

create function public.set_item_collections(target uuid, names jsonb, replace_existing boolean default true) returns void language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); n text; cid uuid;
begin
  if not exists(select 1 from public.wardrobe_items where id=target and user_id=owner_id) then raise exception 'Item unavailable'; end if;
  if jsonb_array_length(names)>12 then raise exception 'Too many collections'; end if;
  if replace_existing then delete from public.item_collections where item_id=target and user_id=owner_id; end if;
  for n in select distinct trim(value) from jsonb_array_elements_text(names) loop
    insert into public.collections(user_id,name) values(owner_id,n) on conflict(user_id,name) do update set name=excluded.name returning id into cid;
    insert into public.item_collections(user_id,item_id,collection_id) values(owner_id,target,cid) on conflict do nothing;
  end loop;
end $$;
create function public.save_inventory(payload jsonb, target uuid default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare result_id uuid:=target; owner_id uuid:=auth.uid();
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if target is null then
    insert into public.wardrobe_items(user_id,name,status,category,color,pattern,attributes) values(owner_id,payload->>'name','confirmed',payload->>'category',nullif(payload->>'color',''),payload->>'pattern',array(select jsonb_array_elements_text(payload->'attributes'))) returning id into result_id;
  else
    perform 1 from public.wardrobe_items where id=target and user_id=owner_id for update;
    if not found then raise exception 'Item unavailable'; end if;
    update public.wardrobe_items set name=payload->>'name',status='confirmed',category=payload->>'category',color=nullif(payload->>'color',''),pattern=payload->>'pattern',attributes=array(select jsonb_array_elements_text(payload->'attributes')) where id=target and user_id=owner_id;
  end if;
  update public.wardrobe_items set brand=nullif(payload->>'brand',''),fit=nullif(payload->>'fit',''),subtype=nullif(payload->>'subtype',''),quantity=(payload->>'quantity')::integer,quantity_unit=coalesce(payload->>'quantity_unit','unspecified'),pack_count=(payload->>'pack_count')::integer,pack_description=coalesce(payload->>'pack_description',''),source_description=coalesce(payload->>'source_description',''),review_notes=coalesce(payload->>'review_notes',''),set_coverage=coalesce(payload->>'set_coverage','unspecified') where id=result_id and user_id=owner_id;
  perform public.set_item_collections(result_id,coalesce(payload->'collections','[]'::jsonb));
  return result_id;
end $$;
create function public.valid_outfit_selection(ids uuid[], method text) returns boolean language sql stable security invoker set search_path='' as $$
  with chosen as (select * from public.wardrobe_items where id=any(ids) and user_id=auth.uid() and status='confirmed'),
  counts as (select count(*) total, count(*) filter(where category='shoes') shoes,count(*) filter(where category='tops') tops,count(*) filter(where category='bottoms') bottoms,count(*) filter(where category='dresses') dresses,count(*) filter(where category in ('sets','suits') and set_coverage='top-bottom') sets,count(*) filter(where category='outerwear') layers,count(*) filter(where category='accessories') accessories,count(*) filter(where category not in ('tops','bottoms','dresses','shoes','outerwear','accessories') and not(category in ('sets','suits') and set_coverage='top-bottom')) unsupported from chosen)
  select coalesce(cardinality(ids) between 1 and case when method='manual' then 20 else 8 end and cardinality(ids)=(select count(distinct id) from unnest(ids) x(id)) and total=cardinality(ids) and
    (method='manual' or (method='ai' and shoes=1 and layers<=1 and accessories<=1 and unsupported=0 and ((sets=1 and tops=0 and bottoms=0 and dresses=0) or (sets=0 and ((dresses=1 and tops=0 and bottoms=0) or (dresses=0 and tops=1 and bottoms=1)))))),false) from counts
$$;
create function public.write_saved_outfit(payload jsonb, target uuid, method text) returns uuid language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); ids uuid[]; result_id uuid:=target; old_method text; old_updated timestamptz;
begin
  if owner_id is null or method not in ('ai','manual') then raise exception 'Authentication or method invalid'; end if;
  if method='manual' and (payload->>'confirmedComplete')::boolean is distinct from true then raise exception 'Confirm this is a complete look'; end if;
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(payload->'garmentIds');
  if target is not null then
    select creation_method,updated_at into old_method,old_updated from public.outfits where id=target and user_id=owner_id for update;
    if not found or old_method<>method then raise exception 'Outfit unavailable'; end if;
    if payload->>'expectedUpdatedAt' is not null and (payload->>'expectedUpdatedAt')::timestamptz<>old_updated then raise exception 'Outfit changed; refresh before editing'; end if;
  end if;
  perform 1 from public.wardrobe_items where id=any(ids) and user_id=owner_id order by id for update;
  if not public.valid_outfit_selection(ids,method) then raise exception 'Unavailable or incomplete outfit'; end if;
  if target is null then
    insert into public.outfits(user_id,title,explanation,occasion,style,season,creation_method,manual_confirmed) values(owner_id,payload->>'title',coalesce(nullif(payload->>'explanation',''),'Chosen by you.'),payload->>'occasion',payload->>'style',payload->>'season',method,method='manual') returning id into result_id;
  else
    update public.outfits set title=payload->>'title',explanation=coalesce(nullif(payload->>'explanation',''),'Chosen by you.'),occasion=payload->>'occasion',style=payload->>'style',season=payload->>'season',invalidated=false where id=target and user_id=owner_id;
    delete from public.outfit_items where outfit_id=target and user_id=owner_id;
  end if;
  insert into public.outfit_items(user_id,outfit_id,item_id) select owner_id,result_id,id from unnest(ids) x(id);
  return result_id;
end $$;
create or replace function public.save_outfit(payload jsonb) returns uuid language sql security invoker set search_path='' as $$select public.write_saved_outfit(payload,null,'ai')$$;
create function public.save_manual_outfit(payload jsonb) returns uuid language sql security invoker set search_path='' as $$select public.write_saved_outfit(payload,null,'manual')$$;
create or replace function private.guard_wear() returns trigger language plpgsql set search_path='' as $$
declare ids uuid[]; method text;
begin
  select creation_method into method from public.outfits where id=new.outfit_id and user_id=new.user_id and not invalidated;
  if not found then raise exception 'Outfit unavailable'; end if;
  select array_agg(item_id) into ids from public.outfit_items where outfit_id=new.outfit_id and user_id=new.user_id;
  if not public.valid_outfit_selection(ids,method) then raise exception 'Outfit incomplete'; end if;
  return new;
end $$;
create function public.write_template(payload jsonb, target uuid default null) returns uuid language plpgsql security invoker set search_path='' as $$
declare result_id uuid:=target; slot jsonb; owner_id uuid:=auth.uid();
begin
  if owner_id is null or jsonb_array_length(payload->'components')>20 then raise exception 'Template invalid'; end if;
  if target is null then insert into public.outfit_templates(user_id,title,occasion,notes) values(owner_id,payload->>'title',payload->>'occasion',payload->>'notes') returning id into result_id;
  else
    update public.outfit_templates set title=payload->>'title',occasion=payload->>'occasion',notes=payload->>'notes' where id=target and user_id=owner_id;
    if not found then raise exception 'Template unavailable'; end if;
    delete from public.template_components where template_id=target and user_id=owner_id;
  end if;
  for slot in select value from jsonb_array_elements(payload->'components') loop
    insert into public.template_components(user_id,template_id,label,item_id) values(owner_id,result_id,slot->>'label',(slot->>'item_id')::uuid);
  end loop;
  return result_id;
end $$;
create function public.commit_wardrobe_import(payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); result_id uuid; k text:=payload->>'key'; kind text:=payload->>'kind'; action text:=payload->>'action';
begin
  if owner_id is null or coalesce(length(k),0) not between 1 and 120 or kind not in ('item','template') or action not in ('create','link','skip') then raise exception 'Import invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':provided-wardrobe-v1:'||k,0));
  if exists(select 1 from public.wardrobe_import_entries where user_id=owner_id and import_id='provided-wardrobe-v1' and source_key=k) then return jsonb_build_object('key',k,'status','skipped'); end if;
  if action='skip' then return jsonb_build_object('key',k,'status','skipped'); end if;
  if kind='template' then
    if action<>'create' then raise exception 'Templates cannot link inventory'; end if;
    result_id:=public.write_template(payload->'data');
    insert into public.wardrobe_import_entries(user_id,import_id,source_key,template_id) values(owner_id,'provided-wardrobe-v1',k,result_id);
  else
    if action='link' then
      result_id:=(payload->>'existingId')::uuid;
      if not exists(select 1 from public.wardrobe_items where id=result_id and user_id=owner_id and status='confirmed') then raise exception 'Choose an existing reviewed owned item'; end if;
      perform public.set_item_collections(result_id,coalesce(payload->'data'->'collections','[]'::jsonb),false);
    else result_id:=public.save_inventory(payload->'data'); end if;
    insert into public.wardrobe_import_entries(user_id,import_id,source_key,item_id) values(owner_id,'provided-wardrobe-v1',k,result_id);
  end if;
  return jsonb_build_object('key',k,'status',case when action='link' then 'linked' else 'created' end,'id',result_id);
end $$;
-- No photo-less job can enter the persistent queue, including direct Data API writes.
create function private.require_job_photo() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.wardrobe_items where id=new.item_id and user_id=new.user_id and status='pending' and photo_path is not null) then raise exception 'Analysis requires a pending owned photo'; end if;
  return new;
end $$;
create trigger require_job_photo before insert on public.ai_tag_jobs for each row execute function private.require_job_photo();
create function public.wardrobe_update_version() returns integer language sql immutable set search_path='' as $$select 1$$;
revoke all on function public.set_item_collections(uuid,jsonb,boolean),public.save_inventory(jsonb,uuid),public.valid_outfit_selection(uuid[],text),public.write_saved_outfit(jsonb,uuid,text),public.save_manual_outfit(jsonb),public.write_template(jsonb,uuid),public.commit_wardrobe_import(jsonb),public.wardrobe_update_version() from public,anon;
grant execute on function public.set_item_collections(uuid,jsonb,boolean),public.save_inventory(jsonb,uuid),public.valid_outfit_selection(uuid[],text),public.write_saved_outfit(jsonb,uuid,text),public.save_manual_outfit(jsonb),public.write_template(jsonb,uuid),public.commit_wardrobe_import(jsonb),public.wardrobe_update_version() to authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;

create function public.list_inventory(filters jsonb default '{}'::jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
with owned as (
 select i.*,coalesce((select jsonb_agg(c.name order by c.name) from public.item_collections ic join public.collections c on c.id=ic.collection_id and c.user_id=ic.user_id where ic.item_id=i.id and ic.user_id=i.user_id),'[]'::jsonb) collections
 from public.wardrobe_items i where user_id=auth.uid()
), filtered as (
 select * from owned i where
 (coalesce(filters->>'category','')='' or i.category=filters->>'category') and
 (coalesce(filters->>'status','')='' or i.status=filters->>'status') and
 (coalesce(filters->>'brand','')='' or i.brand=filters->>'brand') and
 (coalesce(filters->>'color','')='' or i.color=filters->>'color') and
 (coalesce(filters->>'fit','')='' or i.fit=filters->>'fit') and
 (coalesce(filters->>'subtype','')='' or i.subtype=filters->>'subtype') and
 (coalesce(filters->>'collection','')='' or i.collections ? (filters->>'collection')) and
 (coalesce(filters->>'favorite','')<>'true' or i.is_favorite) and
 (coalesce(filters->>'q','')='' or position(replace(replace(replace(lower(filters->>'q'),'chemise','shirt'),'pantalon','trousers'),'kaki','khaki') in replace(replace(replace(lower(concat_ws(' ',i.name,i.category,i.brand,i.color,i.fit,i.subtype,i.source_description,i.review_notes,i.pattern,array_to_string(i.attributes,' '))),'chemise','shirt'),'pantalon','trousers'),'kaki','khaki'))>0)
), page as (
 select * from filtered order by
 case when filters->>'sort'='name' then name end asc,
 case when filters->>'sort'='oldest' then created_at end asc,
 case when coalesce(filters->>'sort','newest') not in ('name','oldest') then created_at end desc, id
 limit least(greatest(coalesce((filters->>'limit')::integer,100),1),200) offset greatest(coalesce((filters->>'offset')::integer,0),0)
)
select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p)) from page p),'[]'::jsonb),'total',(select count(*) from filtered),'nextOffset',case when (select count(*) from page)+coalesce((filters->>'offset')::integer,0)<(select count(*) from filtered) then (select count(*) from page)+coalesce((filters->>'offset')::integer,0) else null end,
'summary',jsonb_build_object('records',(select count(*) from owned),'unknownQuantities',(select count(*) from owned where quantity is null),'knownByUnit',coalesce((select jsonb_object_agg(quantity_unit,n) from (select quantity_unit,sum(quantity) n from owned where quantity is not null group by quantity_unit) x),'{}'::jsonb)))
$$;
revoke all on function public.list_inventory(jsonb) from public,anon;
grant execute on function public.list_inventory(jsonb) to authenticated;
revoke update,delete on public.wardrobe_import_entries from authenticated;
