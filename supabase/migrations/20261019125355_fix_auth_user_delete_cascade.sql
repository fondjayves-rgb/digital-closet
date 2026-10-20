-- Approved fix: avoid invalidating an outfit after its Auth owner has been removed.
-- Version matches the migration recorded by Supabase when the fix was applied.
create or replace function private.after_item_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if auth.uid() is not null and auth.uid() <> old.user_id then
      raise exception 'Owner mismatch';
    end if;
    if exists (select 1 from auth.users where id = old.user_id) then
      update public.outfits set invalidated = true
      where id in (
        select outfit_id from public.outfit_items
        where item_id = old.id and user_id = old.user_id
      );
    end if;
    return old;
  end if;
  if auth.uid() is not null and auth.uid() <> new.user_id then
    raise exception 'Owner mismatch';
  end if;
  if new.status = 'confirmed' then
    update public.ai_tag_jobs
      set status = 'cancelled', lease_until = null, lease_token = null
      where item_id = new.id and user_id = new.user_id
        and status in ('queued', 'processing', 'retry');
  end if;
  return new;
end $$;
