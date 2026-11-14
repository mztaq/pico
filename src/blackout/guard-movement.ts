/** Collision-aware movement for in-world security officers.
 * Uses a few candidate steps, not continuous physics or expensive raycasts.
 * The navigation planner remains responsible for long paths around racks.
 */
export interface GuardPoint { x:number; z:number }
export interface GuardMovement {
  point:GuardPoint;
  moved:number;
  arrived:boolean;
}
export function moveGuardWithAvoidance(
  from:GuardPoint,
  target:GuardPoint,
  nearby:readonly GuardPoint[],
  standable:(x:number,z:number)=>boolean,
  speed:number,
  dt:number,
):GuardMovement {
  const dx=target.x-from.x,dz=target.z-from.z;
  const distance=Math.hypot(dx,dz);
  if(distance<.28)return {point:{...from},moved:0,arrived:true};
  const step=Math.min(distance,Math.max(0,speed)*Math.max(0,Math.min(dt,.1)));
  if(step<=0)return {point:{...from},moved:0,arrived:false};
  const fx=dx/distance,fz=dz/distance;
  let avoidX=0,avoidZ=0;
  for(const other of nearby){
    const x=from.x-other.x,z=from.z-other.z,dist=Math.hypot(x,z);
    if(dist>.05&&dist<1.45){
      const strength=(1.45-dist)/1.45;
      avoidX+=x/dist*strength*.8;
      avoidZ+=z/dist*strength*.8;
    }
  }
  const directions:GuardPoint[]=[
    {x:fx+avoidX,z:fz+avoidZ}, {x:fx,z:fz},
    {x:fx,z:0},{x:0,z:fz},
    {x:-fz,z:fx},{x:fz,z:-fx},
  ];
  let best:GuardPoint|null=null,bestScore=-Infinity;
  for(const direction of directions){
    const len=Math.hypot(direction.x,direction.z);
    if(len<.001)continue;
    const ux=direction.x/len,uz=direction.z/len;
    const point={x:from.x+ux*step,z:from.z+uz*step};
    let clear=true;
    const checks=Math.max(2,Math.ceil(step/.13));
    for(let k=1;k<=checks;k++){
      const t=k/checks;
      if(!standable(from.x+(point.x-from.x)*t,from.z+(point.z-from.z)*t)){
        clear=false;break;
      }
    }
    if(!clear)continue;
    let score=(distance-Math.hypot(target.x-point.x,target.z-point.z))*3;
    for(const other of nearby){
      const gap=Math.hypot(point.x-other.x,point.z-other.z);
      if(gap<.95)score-=(.95-gap)*1.5;
    }
    // Keep guards oriented toward their waypoint when the aisle is open.
    score+=(ux*fx+uz*fz)*.02;
    if(score>bestScore){bestScore=score;best=point;}
  }
  if(!best)return {point:{...from},moved:0,arrived:false};
  return {point:best,moved:Math.hypot(best.x-from.x,best.z-from.z),
    arrived:Math.hypot(best.x-target.x,best.z-target.z)<.28};
}
