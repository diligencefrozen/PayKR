export const REGION_COUNT=17;
export function validateCursor(s){
 if(!s||!Number.isInteger(s.region)||s.region<0||s.region>REGION_COUNT||!Number.isInteger(s.page)||s.page<1||typeof s.complete!=='boolean'||s.complete!==(s.region===REGION_COUNT)||!/^\d{4}-\d{2}-\d{2}$/.test(s.started))throw Error('Invalid stored import cursor; inspect before resuming');
 return s;
}
// Page ordering is not a stable snapshot: replay the entire partially read province.
export function transition(initial,quality){
 validateCursor(initial);
 if(quality){validateCursor(quality);if(!initial.complete)throw Error('Unexpected prior quality cursor with incomplete baseline');return {end:REGION_COUNT,replay:{...quality}};}
 const end=initial.region+(initial.page>1&&!initial.complete?1:0);
 return {end,replay:{started:initial.started,region:0,page:1,complete:end===0}};
}
