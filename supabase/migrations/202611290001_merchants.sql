-- Run once on the PayKR project, NOT ForumliteKR's other database.
-- Only public-source store records. No Kakao response data or payment verification claims.
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create table if not exists public.paykr_merchants (
  id text primary key, brand_id text not null, name text not null,
  address text not null default '', category text not null default '',
  lat double precision not null check(lat between 32.9 and 39),
  lng double precision not null check(lng between 124 and 132.1),
  region text not null default '', search_key text not null,
  active boolean not null default true,
  location extensions.geometry(Point,4326) generated always as
    (extensions.st_setsrid(extensions.st_makepoint(lng,lat),4326)) stored,
  updated_at timestamptz not null default now()
);
create index if not exists paykr_merchants_geo on public.paykr_merchants using gist(location) where active;
create index if not exists paykr_merchants_brand on public.paykr_merchants(brand_id,id) where active;
create index if not exists paykr_merchants_region on public.paykr_merchants(region,id);
create table if not exists public.paykr_sync_state (
  id text primary key, value jsonb not null, updated_at timestamptz not null default now()
);
alter table public.paykr_merchants enable row level security;
alter table public.paykr_sync_state enable row level security;
revoke all on public.paykr_merchants, public.paykr_sync_state from anon,authenticated;
grant select (id,brand_id,name,address,category,lat,lng,region,search_key,active,location) on public.paykr_merchants to anon,authenticated;
grant all on public.paykr_merchants,public.paykr_sync_state to service_role;
drop policy if exists paykr_public_read on public.paykr_merchants;
create policy paykr_public_read on public.paykr_merchants for select to anon,authenticated using(active);
-- Bounded public result sizes, no arbitrary SQL. Invoker respects RLS.
create or replace function public.paykr_search_merchants(
  p_south double precision default null,p_west double precision default null,
  p_north double precision default null,p_east double precision default null,
  p_brand_ids text[] default null,p_query text default '',p_offset integer default 0,p_limit integer default 61
) returns table(id text,brand_id text,name text,address text,category text,lat double precision,lng double precision)
language sql stable security invoker set search_path = '' as $$
  select m.id,m.brand_id,m.name,m.address,m.category,m.lat,m.lng
  from public.paykr_merchants m where m.active
  and (p_brand_ids is null or m.brand_id=any(p_brand_ids))
  and (p_query='' or strpos(m.search_key,left(p_query,100))>0)
  and ((p_south is null and p_west is null and p_north is null and p_east is null)
    or (p_south<=p_north and p_west<=p_east and m.location operator(extensions.&&)
      extensions.st_makeenvelope(p_west,p_south,p_east,p_north,4326)))
  order by case when p_south is not null then
    m.location operator(extensions.<->) extensions.st_setsrid(extensions.st_makepoint((p_west+p_east)/2,(p_south+p_north)/2),4326) end nulls last, m.id
  offset greatest(0,least(coalesce(p_offset,0),10000)) limit greatest(1,least(coalesce(p_limit,61),101));
$$;
revoke all on function public.paykr_search_merchants(double precision,double precision,double precision,double precision,text[],text,integer,integer) from public;
grant execute on function public.paykr_search_merchants(double precision,double precision,double precision,double precision,text[],text,integer,integer) to anon,authenticated;
-- Updated rows only; no timestamp-only writes. service_role only.
create or replace function public.paykr_upsert_merchants(p_rows jsonb) returns void
language sql security invoker set search_path='' as $$
 insert into public.paykr_merchants as m(id,brand_id,name,address,category,lat,lng,region,search_key,active)
 select x.id,x.brand_id,x.name,x.address,x.category,x.lat,x.lng,x.region,x.search_key,x.active
 from jsonb_to_recordset(p_rows) as x(id text,brand_id text,name text,address text,category text,lat double precision,lng double precision,region text,search_key text,active boolean)
 on conflict(id) do update set brand_id=excluded.brand_id,name=excluded.name,address=excluded.address,category=excluded.category,lat=excluded.lat,lng=excluded.lng,region=excluded.region,search_key=excluded.search_key,active=excluded.active,updated_at=now()
 where (m.brand_id,m.name,m.address,m.category,m.lat,m.lng,m.region,m.search_key,m.active) is distinct from
 (excluded.brand_id,excluded.name,excluded.address,excluded.category,excluded.lat,excluded.lng,excluded.region,excluded.search_key,excluded.active);
$$;
revoke all on function public.paykr_upsert_merchants(jsonb) from public,anon,authenticated;
grant execute on function public.paykr_upsert_merchants(jsonb) to service_role;
-- A single operator-only size measurement; no monitoring table.
create or replace function public.paykr_db_bytes() returns bigint language sql stable security invoker set search_path='' as $$ select pg_database_size(current_database()) $$;
revoke all on function public.paykr_db_bytes() from public,anon,authenticated;
grant execute on function public.paykr_db_bytes() to service_role;
