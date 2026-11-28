-- Apply after 001 and 002, with sync jobs stopped. No merchant deletion.
begin;
alter table public.paykr_merchants add column if not exists quality_status text not null default 'legacy' check(quality_status in ('legacy','accepted','review','excluded'));
alter table public.paykr_merchants add column if not exists quality_reason text;
alter table public.paykr_merchants add column if not exists source_change_day date;
create or replace function public.paykr_search_merchants(
  p_south double precision default null,p_west double precision default null,
  p_north double precision default null,p_east double precision default null,
  p_brand_ids text[] default null,p_query text default '',p_offset integer default 0,p_limit integer default 61
) returns table(id text,brand_id text,name text,address text,category text,lat double precision,lng double precision)
language sql stable security definer set search_path = '' as $$
  select m.id,m.brand_id,m.name,m.address,m.category,m.lat,m.lng
  from public.paykr_merchants m where m.active and m.quality_status <> 'excluded'
  and (p_brand_ids is null or m.brand_id=any(p_brand_ids))
  and length(coalesce(p_query,'')) <= 100
  and (p_brand_ids is null or cardinality(p_brand_ids)<=165)
  and (coalesce(p_query,'')='' or strpos(m.search_key,p_query)>0)
  and ((p_south is null and p_west is null and p_north is null and p_east is null)
    or (p_south between -90 and 90 and p_north between -90 and 90 and p_west between -180 and 180 and p_east between -180 and 180 and p_south<=p_north and p_west<=p_east and m.location operator(extensions.&&)
      extensions.st_makeenvelope(p_west,p_south,p_east,p_north,4326)))
  order by case when p_south is not null then
    m.location operator(extensions.<->) extensions.st_setsrid(extensions.st_makepoint((p_west+p_east)/2,(p_south+p_north)/2),4326) end nulls last, m.id
  offset greatest(0,least(coalesce(p_offset,0),10000)) limit greatest(1,least(coalesce(p_limit,61),101));
$$;
revoke all on function public.paykr_search_merchants(double precision,double precision,double precision,double precision,text[],text,integer,integer) from public;
grant execute on function public.paykr_search_merchants(double precision,double precision,double precision,double precision,text[],text,integer,integer) to anon,authenticated;
-- Column-level grants from 001 must be revoked explicitly.
revoke select (id,brand_id,name,address,category,lat,lng,region,search_key,active,location) on public.paykr_merchants from anon,authenticated,public;
revoke all on public.paykr_merchants from anon,authenticated,public;
drop policy if exists paykr_public_read on public.paykr_merchants;
create or replace function public.paykr_upsert_merchants(p_rows jsonb) returns void
language sql security invoker set search_path='' as $$
 insert into public.paykr_merchants as m(id,brand_id,name,address,category,lat,lng,region,search_key,active,quality_status,quality_reason,source_change_day)
 select x.id,x.brand_id,x.name,x.address,x.category,x.lat,x.lng,x.region,x.search_key,x.active,'accepted',null,x.source_change_day
 from jsonb_to_recordset(p_rows) as x(id text,brand_id text,name text,address text,category text,lat double precision,lng double precision,region text,search_key text,active boolean,source_change_day date)
 on conflict(id) do update set brand_id=excluded.brand_id,name=excluded.name,address=excluded.address,category=excluded.category,lat=excluded.lat,lng=excluded.lng,region=excluded.region,search_key=excluded.search_key,active=excluded.active,quality_status=case when m.quality_status='excluded' then 'excluded' else 'accepted' end,quality_reason=case when m.quality_status='excluded' then m.quality_reason else null end,source_change_day=coalesce(excluded.source_change_day,m.source_change_day),updated_at=now()
 where (m.source_change_day is null or excluded.source_change_day>=m.source_change_day) and ((m.brand_id,m.name,m.address,m.category,m.lat,m.lng,m.region,m.search_key,m.active) is distinct from
 (excluded.brand_id,excluded.name,excluded.address,excluded.category,excluded.lat,excluded.lng,excluded.region,excluded.search_key,excluded.active)
 or m.quality_status in ('legacy','review') or (excluded.source_change_day is not null and m.source_change_day is distinct from excluded.source_change_day));
$$;
revoke all on function public.paykr_upsert_merchants(jsonb) from public,anon,authenticated;
grant execute on function public.paykr_upsert_merchants(jsonb) to service_role;

create or replace function public.paykr_mark_merchant_review(p_rows jsonb) returns void
language sql security invoker set search_path='' as $$
 update public.paykr_merchants m set quality_status='review',quality_reason=left(x.reason,100),source_change_day=coalesce(x.source_change_day,m.source_change_day),updated_at=now()
 from jsonb_to_recordset(p_rows) x(id text,reason text,source_change_day date)
 where m.id=x.id and m.quality_status<>'excluded'
 and (m.source_change_day is null or x.source_change_day>=m.source_change_day)
 and ((m.quality_status,m.quality_reason) is distinct from ('review',left(x.reason,100)) or (x.source_change_day is not null and m.source_change_day is distinct from x.source_change_day));
$$;
revoke all on function public.paykr_mark_merchant_review(jsonb) from public,anon,authenticated;
grant execute on function public.paykr_mark_merchant_review(jsonb) to service_role;
create or replace function public.paykr_quality_schema() returns integer language sql stable set search_path='' as $$ select 5 $$;
revoke all on function public.paykr_quality_schema() from public,anon,authenticated;
grant execute on function public.paykr_quality_schema() to service_role;
commit;
