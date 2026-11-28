-- Read-only diagnostics. Run each SELECT separately in Supabase SQL Editor.
-- 1. Regional progress and baseline/quality cursors.
select id,value,updated_at from public.paykr_sync_state
where id in ('initial','delta','quality_v2') order by id;

-- 2. Brand coverage and category distribution (not a completeness claim).
select region,brand_id,category,count(*) as stores from public.paykr_merchants
where active group by region,brand_id,category order by region,brand_id,stores desc;

-- 3. Possible duplicate source IDs for the same shop (no automatic deletion).
select brand_id,name,address,count(*) as records,array_agg(id order by id) as source_ids
from public.paykr_merchants where active and address<>''
group by brand_id,name,address having count(*)>1 order by records desc,brand_id,name;

-- 4. Current footprint.
select count(*) as stores,pg_size_pretty(pg_total_relation_size('public.paykr_merchants')) as table_and_indexes,
pg_size_pretty(pg_database_size(current_database())) as database_size from public.paykr_merchants;
