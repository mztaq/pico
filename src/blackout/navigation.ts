/** Grid-based navigation for guards and future co-op players.
 * The grid is built per query, without timers or network requests.
 * A bounded BFS and a visibility pass yield a short, collision-safe route.
 */
export interface NavPoint { x:number; z:number }
export interface NavBounds { minX:number; maxX:number; minZ:number; maxZ:number }
export type Walkable = (x:number,z:number)=>boolean;
export function routeTo(
  start:NavPoint,end:NavPoint,passable:Walkable,
  bounds:NavBounds={minX:-44.3,maxX:31,minZ:-12.5,maxZ:12.5},
  cellSize=1,
):NavPoint[] {
  const width=Math.floor((bounds.maxX-bounds.minX)/cellSize)+1;
  const height=Math.floor((bounds.maxZ-bounds.minZ)/cellSize)+1;
  const total=width*height;
  if(total>15000||total<2||!Number.isFinite(total))return [];
  const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));
  const gx=(x:number)=>clamp(Math.round((x-bounds.minX)/cellSize),0,width-1);
  const gz=(z:number)=>clamp(Math.round((z-bounds.minZ)/cellSize),0,height-1);
  const index=(x:number,z:number)=>x+z*width;
  const point=(x:number,z:number)=>({x:bounds.minX+x*cellSize,z:bounds.minZ+z*cellSize});
  const valid=(x:number,z:number)=>x>=0&&x<width&&z>=0&&z<height&&passable(point(x,z).x,point(x,z).z);
  function nearest(x:number,z:number):[number,number]|null{
    if(valid(x,z))return [x,z];
    for(let radius=1;radius<=5;radius++){
      let closest:[number,number]|null=null,score=Infinity;
      for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
        if(Math.max(Math.abs(dx),Math.abs(dz))!==radius||!valid(x+dx,z+dz))continue;
        const d=dx*dx+dz*dz;
        if(d<score){closest=[x+dx,z+dz];score=d;}
      }
      if(closest)return closest;
    }
    return null;
  }
  const from=nearest(gx(start.x),gz(start.z));
  const target=nearest(gx(end.x),gz(end.z));
  if(!from||!target)return [];
  const first=index(...from),last=index(...target);
  const parents=new Int32Array(total);parents.fill(-1);
  const queue=new Int32Array(total);
  let head=0,tail=0;
  queue[tail++]=first;parents[first]=first;
  const offsets:[[number,number],[number,number],[number,number],[number,number]]=[[1,0],[-1,0],[0,1],[0,-1]];
  while(head<tail&&head<total){
    const v=queue[head++];if(v===last)break;
    const x=v%width,z=Math.floor(v/width);
    for(const [dx,dz] of offsets){
      const xx=x+dx,zz=z+dz;
      if(!valid(xx,zz))continue;
      const next=index(xx,zz);if(parents[next]>=0)continue;
      parents[next]=v;queue[tail++]=next;
    }
  }
  if(parents[last]<0)return [];
  const cells:NavPoint[]=[];
  let v=last;
  while(v!==first&&cells.length<total){
    cells.push(point(v%width,Math.floor(v/width)));v=parents[v];
  }
  cells.reverse();
  function lineClear(a:NavPoint,b:NavPoint){
    const dist=Math.hypot(a.x-b.x,a.z-b.z);
    const steps=Math.max(1,Math.ceil(dist/(cellSize*.35)));
    for(let i=1;i<=steps;i++){
      const t=i/steps;
      if(!passable(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false;
    }
    return true;
  }
  if(!cells.length)return [end];
  const full:NavPoint[]=[start,...cells];
  if(passable(end.x,end.z))full.push(end);
  const simplified:NavPoint[]=[];
  let cursor=0;
  while(cursor<full.length-1){
    let next=cursor+1;
    for(let probe=full.length-1;probe>next;probe--){
      if(lineClear(full[cursor],full[probe])){next=probe;break;}
    }
    simplified.push(full[next]);cursor=next;
  }
  return simplified;
}
