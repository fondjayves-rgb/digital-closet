-- Local Wardrobe App foundation. Apply to a fresh Supabase project.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 80),
  style_preferences text not null default '' check (length(style_preferences) <= 160),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.wardrobe_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled garment' check (length(trim(name)) between 1 and 100),
  photo_path text not null unique,
  status text not null default 'pending' check (status in ('pending','confirmed')),
  category text check (category in ('tops','bottoms','dresses','outerwear','shoes','accessories')),
  color text check (length(trim(color)) between 1 and 60),
  pattern text not null default 'unknown' check (pattern in ('solid','striped','checked','floral','graphic','other','unknown')),
  attributes text[] not null default '{}' check (cardinality(attributes) <= 9 and attributes <@ array['long sleeves','short sleeves','sleeveless','collar','hood','buttons','zipper','pockets','visible logo']::text[]),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id, user_id),
  check (photo_path = user_id::text || '/' || id::text || '.webp'),
  check (status <> 'confirmed' or (category is not null and color is not null))
);
create table public.ai_tag_jobs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null, status text not null default 'queued' check (status in ('queued','processing','retry','succeeded','failed','cancelled')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  available_at timestamptz not null default now(), lease_until timestamptz, lease_token uuid, last_error text check (length(last_error) <= 500),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,user_id), unique(id,item_id,user_id),
  foreign key(item_id,user_id) references public.wardrobe_items(id,user_id) on delete cascade,
  check ((status = 'processing') = (lease_until is not null and lease_token is not null))
);
create unique index one_active_job_per_item on public.ai_tag_jobs(item_id) where status in ('queued','processing','retry');
create index jobs_poll_idx on public.ai_tag_jobs(status, available_at, created_at);
create index jobs_owner_idx on public.ai_tag_jobs(user_id,item_id,created_at desc);
create table public.tag_suggestions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null, job_id uuid not null unique, proposed_tags jsonb not null check (jsonb_typeof(proposed_tags) = 'object'),
  created_at timestamptz not null default now(),
  foreign key(item_id,user_id) references public.wardrobe_items(id,user_id) on delete cascade,
  foreign key(job_id,item_id,user_id) references public.ai_tag_jobs(id,item_id,user_id) on delete cascade
);
create table public.outfits (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(length(trim(title)) between 1 and 100), explanation text not null check(length(explanation) between 1 and 600),
  occasion text not null check(length(trim(occasion)) between 1 and 120), style text not null check(length(trim(style)) between 1 and 160),
  season text not null check(season in ('spring','summer','autumn','winter','all-season')),
  invalidated boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table public.outfit_items (
  outfit_id uuid not null, item_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(outfit_id,item_id),
  foreign key(outfit_id,user_id) references public.outfits(id,user_id) on delete cascade,
  foreign key(item_id,user_id) references public.wardrobe_items(id,user_id) on delete cascade
);
create table public.wear_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  outfit_id uuid not null, worn_on date not null check(worn_on <= current_date),
  created_at timestamptz not null default now(), unique(user_id,outfit_id,worn_on),
  foreign key(outfit_id,user_id) references public.outfits(id,user_id) on delete cascade
);
create table public.outfit_feedback (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  outfit_id uuid not null, rating integer not null check(rating between 1 and 5), comment text not null default '' check(length(comment) <= 500),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,outfit_id),
  foreign key(outfit_id,user_id) references public.outfits(id,user_id) on delete cascade
);
create index wardrobe_owner_category_idx on public.wardrobe_items(user_id,status,category,created_at desc);
create index suggestions_owner_idx on public.tag_suggestions(user_id,item_id,created_at desc);
create index outfits_owner_idx on public.outfits(user_id,created_at desc);
create index outfit_items_item_idx on public.outfit_items(item_id,user_id);
create index outfit_items_owner_idx on public.outfit_items(user_id,outfit_id);
create index wear_owner_date_idx on public.wear_logs(user_id,worn_on desc);
create index wear_outfit_idx on public.wear_logs(outfit_id,user_id);
create index feedback_outfit_idx on public.outfit_feedback(outfit_id,user_id);

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create function private.immutable_owner() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.user_id <> old.user_id then raise exception 'Owner cannot change'; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['profiles','wardrobe_items','ai_tag_jobs','outfits','outfit_feedback'] loop
    execute format('create trigger touch_updated before update on public.%I for each row execute function private.touch_updated_at()',t);
  end loop;
  foreach t in array array['wardrobe_items','ai_tag_jobs','tag_suggestions','outfits','outfit_items','wear_logs','outfit_feedback'] loop
    execute format('create trigger keep_owner before update on public.%I for each row execute function private.immutable_owner()',t);
  end loop;
end $$;

-- This trigger alone needs elevated rights to create a profile during Auth signup.
create function private.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id) values(new.id); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.create_profile();

-- A reviewed garment cancels any in-flight job, so a late AI result cannot overwrite a review.
create function private.after_item_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if auth.uid() is not null and auth.uid() <> old.user_id then raise exception 'Owner mismatch'; end if;
    update public.outfits set invalidated = true where id in (select outfit_id from public.outfit_items where item_id=old.id and user_id=old.user_id);
    return old;
  end if;
  if auth.uid() is not null and auth.uid() <> new.user_id then raise exception 'Owner mismatch'; end if;
  if new.status = 'confirmed' then
    update public.ai_tag_jobs set status='cancelled',lease_until=null,lease_token=null
      where item_id=new.id and user_id=new.user_id and status in ('queued','processing','retry');
  end if;
  return new;
end $$;
create trigger reviewed_item after update of status on public.wardrobe_items for each row execute function private.after_item_change();
create trigger removed_item before delete on public.wardrobe_items for each row execute function private.after_item_change();

create function private.guard_outfit_item() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from public.wardrobe_items where id=new.item_id and user_id=new.user_id and status='confirmed')
    then raise exception 'Only confirmed owned garments can be associated'; end if;
  return new;
end $$;
create trigger confirmed_outfit_garment before insert or update on public.outfit_items for each row execute function private.guard_outfit_item();
create function private.guard_wear() returns trigger language plpgsql set search_path = '' as $$
declare cats text[];
begin
  if not exists(select 1 from public.outfits where id=new.outfit_id and user_id=new.user_id and not invalidated)
    then raise exception 'Outfit unavailable'; end if;
  select array_agg(i.category) into cats from public.outfit_items oi join public.wardrobe_items i on i.id=oi.item_id and i.user_id=oi.user_id
    where oi.outfit_id=new.outfit_id and oi.user_id=new.user_id and i.status='confirmed';
  if not coalesce('shoes'=any(cats) and ('dresses'=any(cats) or ('tops'=any(cats) and 'bottoms'=any(cats))),false) then raise exception 'Outfit incomplete'; end if;
  return new;
end $$;
create trigger available_wear before insert or update on public.wear_logs for each row execute function private.guard_wear();

alter table public.profiles enable row level security;
create policy profile_read on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy profile_edit on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
do $$ declare t text; begin
  foreach t in array array['wardrobe_items','ai_tag_jobs','tag_suggestions','outfits','outfit_items','wear_logs','outfit_feedback'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner_read on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
  end loop;
  foreach t in array array['wardrobe_items','outfits','outfit_items','wear_logs','outfit_feedback'] loop
    execute format('create policy owner_insert on public.%I for insert to authenticated with check(user_id=(select auth.uid()))',t);
  end loop;
  foreach t in array array['wardrobe_items','outfit_feedback'] loop
    execute format('create policy owner_update on public.%I for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',t);
  end loop;
  foreach t in array array['wardrobe_items','outfits','wear_logs'] loop
    execute format('create policy owner_delete on public.%I for delete to authenticated using(user_id=(select auth.uid()))',t);
  end loop;
end $$;
create policy enqueue_own_pending_item on public.ai_tag_jobs for insert to authenticated with check (
  user_id=(select auth.uid()) and status='queued' and attempts=0 and lease_token is null and lease_until is null and last_error is null
  and exists(select 1 from public.wardrobe_items i where i.id=item_id and i.user_id=(select auth.uid()) and i.status='pending')
);

-- Explicit grants opt in to the Data API; AI job mutation stays worker-only.
revoke all on public.profiles,public.wardrobe_items,public.ai_tag_jobs,public.tag_suggestions,public.outfits,public.outfit_items,public.wear_logs,public.outfit_feedback from anon,authenticated;
grant select on public.profiles,public.wardrobe_items,public.ai_tag_jobs,public.tag_suggestions,public.outfits,public.outfit_items,public.wear_logs,public.outfit_feedback to authenticated;
grant update(display_name,style_preferences) on public.profiles to authenticated;
grant insert,delete on public.wardrobe_items to authenticated;
grant update(name,status,category,color,pattern,attributes) on public.wardrobe_items to authenticated;
grant insert on public.ai_tag_jobs to authenticated;
grant insert,delete on public.outfits to authenticated;
grant insert on public.outfit_items,public.wear_logs to authenticated;
grant delete on public.wear_logs to authenticated;
grant insert on public.outfit_feedback to authenticated;
grant update(rating,comment) on public.outfit_feedback to authenticated;
grant all on public.profiles,public.wardrobe_items,public.ai_tag_jobs,public.tag_suggestions,public.outfits,public.outfit_items,public.wear_logs,public.outfit_feedback to service_role;

-- Atomic save locks the selected inventory and rejects stale, foreign, duplicate or incomplete looks.
create function public.save_outfit(payload jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); result_id uuid; ids uuid[]; n int; cats text[];
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  select array_agg(v::uuid) into ids from jsonb_array_elements_text(payload->'garmentIds') as x(v);
  if coalesce(cardinality(ids),0) < 1 or cardinality(ids) > 8 or cardinality(ids) <> (select count(distinct v) from unnest(ids) x(v)) then raise exception 'Invalid garment selection'; end if;
  perform 1 from public.wardrobe_items where id=any(ids) and user_id=owner_id and status='confirmed' order by id for update;
  select count(*),array_agg(category) into n,cats from public.wardrobe_items where id=any(ids) and user_id=owner_id and status='confirmed';
  if n <> cardinality(ids) or
    (select count(*) from unnest(cats) x(c) where c='shoes') <> 1 or
    (select count(*) from unnest(cats) x(c) where c='outerwear') > 1 or
    (select count(*) from unnest(cats) x(c) where c='accessories') > 1 or
    not (
      ((select count(*) from unnest(cats) x(c) where c='dresses')=1 and not ('tops'=any(cats) or 'bottoms'=any(cats))) or
      (not ('dresses'=any(cats)) and (select count(*) from unnest(cats) x(c) where c='tops')=1 and (select count(*) from unnest(cats) x(c) where c='bottoms')=1)
    ) then raise exception 'Unavailable or incomplete outfit'; end if;
  insert into public.outfits(user_id,title,explanation,occasion,style,season)
    values(owner_id,payload->>'title',payload->>'explanation',payload->>'occasion',payload->>'style',payload->>'season') returning id into result_id;
  insert into public.outfit_items(outfit_id,item_id,user_id) select result_id,v,owner_id from unnest(ids) x(v);
  return result_id;
end $$;
revoke all on function public.save_outfit(jsonb) from public,anon;
grant execute on function public.save_outfit(jsonb) to authenticated;

-- Lease fencing makes expired/restarted workers harmless. Three claims maximum per job.
create function public.claim_tag_job() returns setof public.ai_tag_jobs language plpgsql security invoker set search_path = '' as $$
declare target_id uuid;
begin
  update public.ai_tag_jobs set status='failed',last_error='Analysis stopped after three attempts. Review manually or request a new analysis.',lease_token=null,lease_until=null
    where attempts>=3 and ((status='processing' and lease_until<now()) or status in ('queued','retry'));
  select id into target_id from public.ai_tag_jobs
    where attempts<3 and ((status in ('queued','retry') and available_at<=now()) or (status='processing' and lease_until<now()))
    order by created_at for update skip locked limit 1;
  return query update public.ai_tag_jobs set status='processing',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '180 seconds',last_error=null
    where id=target_id returning *;
end $$;
create function public.finish_tag_job(job_uuid uuid, token uuid, tags jsonb, error_text text default null) returns boolean language plpgsql security invoker set search_path = '' as $$
declare job public.ai_tag_jobs; garment public.wardrobe_items;
begin
  select * into job from public.ai_tag_jobs where id=job_uuid;
  if not found then return false; end if;
  -- Lock item first, matching the manual confirmation lock order.
  select * into garment from public.wardrobe_items where id=job.item_id for update;
  select * into job from public.ai_tag_jobs where id=job_uuid for update;
  if job.status<>'processing' or job.lease_token is distinct from token or job.lease_until<now() then return false; end if;
  if garment.status<>'pending' then
    update public.ai_tag_jobs set status='cancelled',lease_until=null,lease_token=null where id=job_uuid; return false;
  end if;
  if error_text is not null then
    update public.ai_tag_jobs set status=case when attempts>=3 then 'failed' else 'retry' end,
      available_at=now()+(power(2,attempts)*5)*interval '1 second',last_error=left(error_text,500),lease_until=null,lease_token=null where id=job_uuid;
  else
    insert into public.tag_suggestions(user_id,item_id,job_id,proposed_tags) values(job.user_id,job.item_id,job.id,tags);
    update public.ai_tag_jobs set status='succeeded',last_error=null,lease_until=null,lease_token=null where id=job_uuid;
  end if;
  return true;
end $$;
revoke all on function public.claim_tag_job(),public.finish_tag_job(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_tag_job(),public.finish_tag_job(uuid,uuid,jsonb,text) to service_role;
revoke execute on all functions in schema private from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('garment-photos','garment-photos',false,8388608,array['image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy wardrobe_photo_read on storage.objects for select to authenticated using(bucket_id='garment-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy wardrobe_photo_insert on storage.objects for insert to authenticated with check(bucket_id='garment-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy wardrobe_photo_delete on storage.objects for delete to authenticated using(bucket_id='garment-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
