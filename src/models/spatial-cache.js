// Small map viewports only. Cache complete cells; never treat a truncated cell as complete.
export const CELL_DEGREES=.005;
export function viewportCells(bounds){
  if(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite))return null;
  const [s,w,n,e]=bounds;if(s>=n||w>=e||s<32.9||n>39||w<124||e>132.1)return null;
  const scale=200, y0=Math.floor(s*scale),x0=Math.floor(w*scale),y1=Math.ceil(n*scale)-1,x1=Math.ceil(e*scale)-1;
  if((y1-y0+1)*(x1-x0+1)>4)return null;
  const cells=[];
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)cells.push([y/scale,x/scale,(y+1)/scale,(x+1)/scale]);
  return cells;
}
export function viewportPage(results,bounds,skip){
  if(results.some(x=>x.rows.length>=61))return null; // Dense cell: use exact paginated RPC.
  const [s,w,n,e]=bounds,cy=(s+n)/2,cx=(w+e)/2;
  const rows=new Map();
  for(const result of results)for(const r of result.rows){
    if(r.lat>=s&&r.lat<=n&&r.lng>=w&&r.lng<=e)rows.set(r.id,r);
  }
  const distance=r=>(r.lat-cy)**2+(r.lng-cx)**2;
  return {rows:[...rows.values()].sort((a,b)=>distance(a)-distance(b)||(a.id<b.id?-1:a.id>b.id?1:0)).slice(skip,skip+61),stale:results.some(r=>r.stale)};
}
