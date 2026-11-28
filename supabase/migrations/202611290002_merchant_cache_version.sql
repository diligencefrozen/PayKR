-- Additive migration. Run once after 202611290001; no merchant rows changed.
-- Reuse existing private sync state. Version updates only when a DML statement changes rows.
begin;
insert into public.paykr_sync_state(id,value) values ('merchant_cache_version',to_jsonb(1::bigint)) on conflict(id) do nothing;
create or replace function public.paykr_bump_merchant_version() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op = 'DELETE' then
    if not exists(select 1 from old_rows) then return null; end if;
  else
    if not exists(select 1 from new_rows) then return null; end if;
  end if;
  update public.paykr_sync_state set value=to_jsonb((value #>> '{}')::bigint+1),updated_at=now()
    where id='merchant_cache_version';
  return null;
end;
$$;
revoke all on function public.paykr_bump_merchant_version() from public,anon,authenticated;
drop trigger if exists paykr_version_insert on public.paykr_merchants;
create trigger paykr_version_insert after insert on public.paykr_merchants referencing new table as new_rows for each statement execute function public.paykr_bump_merchant_version();
drop trigger if exists paykr_version_update on public.paykr_merchants;
create trigger paykr_version_update after update on public.paykr_merchants referencing new table as new_rows for each statement execute function public.paykr_bump_merchant_version();
drop trigger if exists paykr_version_delete on public.paykr_merchants;
create trigger paykr_version_delete after delete on public.paykr_merchants referencing old table as old_rows for each statement execute function public.paykr_bump_merchant_version();
create or replace function public.paykr_merchant_version() returns text
language sql stable security definer set search_path='' as $$
 select value #>> '{}' from public.paykr_sync_state where id='merchant_cache_version';
$$;
revoke all on function public.paykr_merchant_version() from public;
grant execute on function public.paykr_merchant_version() to anon,authenticated,service_role;
commit;
