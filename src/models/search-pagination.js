// Reuse the nearby loop: legacy calls stay budgeted; DB pages cover the visible area.
export const DB_AUTO_PAGES=10; // At most 600 rows per interaction; more remains available.
export function shouldContinue({dbMode,nearby,all,area,input,more,failed,pages}){
  if(!more)return false;
  return dbMode?(!failed&&!input&&(nearby||(all&&area))&&pages<DB_AUTO_PAGES):nearby;
}
