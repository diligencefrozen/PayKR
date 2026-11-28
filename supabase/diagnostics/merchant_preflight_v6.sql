-- Read-only SQL Editor diagnostics; no data or configuration changes.
select public.paykr_quality_schema() as schema_version, public.paykr_merchant_version() as cache_version;
select id,value from public.paykr_sync_state where id in ('initial','quality_v5_plan','delta','delta_recheck_v5') order by id;
select region,quality_status,count(*) as merchants from public.paykr_merchants group by 1,2 order by 1,2;
select brand_id,count(*) as visible from public.paykr_merchants where active and quality_status<>'excluded' group by 1 order by 2 desc;
select pg_size_pretty(pg_database_size(current_database())) as db_size,
  has_any_column_privilege('anon','public.paykr_merchants','SELECT') as anon_direct_select,
  has_any_column_privilege('authenticated','public.paykr_merchants','SELECT') as authenticated_direct_select,
  has_function_privilege('anon','public.paykr_search_merchants(double precision,double precision,double precision,double precision,text[],text,integer,integer)','EXECUTE') as anon_search_rpc;
-- Actual table query plan (not just wrapper function scan). Seoul sample; adjust only for testing.
explain (analyze,buffers) select id,brand_id,name,address,category,lat,lng
from public.paykr_merchants where active and quality_status<>'excluded'
and location operator(extensions.&&) extensions.st_makeenvelope(126.97,37.55,127.01,37.57,4326)
order by location operator(extensions.<->) extensions.st_setsrid(extensions.st_makepoint(126.99,37.56),4326),id limit 61;
