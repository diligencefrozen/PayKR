-- Read-only diagnostics. Run in SQL Editor as operator.
select id,value from public.paykr_sync_state where id in ('initial','quality_v5_plan','delta','delta_recheck_v5');
select quality_status,count(*) from public.paykr_merchants group by 1 order by 1;
select region,brand_id,count(*) from public.paykr_merchants where active and quality_status<>'excluded' group by 1,2 order by 1,2;
select id,brand_id,name,address,category,quality_reason from public.paykr_merchants where quality_status='review' order by quality_reason,id limit 500;
-- Inspect actual execution plan as an operator; not an automatic index change.
explain (analyze,buffers) select * from public.paykr_search_merchants(37.55,126.97,37.57,127.01,null,'',0,61);
-- Manual exclusion template (commented; replace only with individually verified IDs):
-- update public.paykr_merchants set quality_status='excluded',quality_reason='operator_confirmed_mismatch',updated_at=now() where id in ('REPLACE_WITH_VERIFIED_ID') and quality_status='review' returning id,name;
-- Manual restore (only after checking source):
-- update public.paykr_merchants set quality_status='review',quality_reason='operator_reopened',updated_at=now() where id in ('REPLACE_WITH_VERIFIED_ID') and quality_status='excluded' returning id,name;
