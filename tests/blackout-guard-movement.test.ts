import {describe,expect,it} from 'vitest';
import {routeTo} from '../src/blackout/navigation';
import {moveGuardWithAvoidance} from '../src/blackout/guard-movement';

const floor=(x:number,z:number)=>
  x>-23&&x<31&&z>-12.5&&z<12.5&&
  !(x>14.2&&x<15.1&&(z<-1||z>1.7))&&
  !(Math.abs(x-2.3)<1.26&&Math.abs(z-2)<1.38);
const clearance=(x:number,z:number)=>
  floor(x,z)&&floor(x+.22,z)&&floor(x-.22,z)&&
  floor(x,z+.22)&&floor(x,z-.22);

function follow(from:{x:number,z:number},to:{x:number,z:number},
  nearby:readonly {x:number,z:number}[]=[]){
  const path=routeTo(from,to,clearance);
  let position={...from},index=0,blockedFrames=0;
  for(let frame=0;frame<1000&&index<path.length;frame++){
    const next=moveGuardWithAvoidance(position,path[index],nearby,clearance,4.1,.05);
    position=next.point;
    expect(clearance(position.x,position.z)).toBe(true);
    if(next.arrived)index++;
    if(next.moved<.001)blockedFrames++;else blockedFrames=0;
    expect(blockedFrames).toBeLessThan(25);
  }
  return {position,path,completed:index===path.length};
}

describe('Guard movement around walls and office doorway',()=>{
  it('moves from security office through doorway without entering the wall',()=>{
    const result=follow({x:23.4,z:4.1},{x:10,z:0.5});
    expect(result.path.length).toBeGreaterThan(0);
    expect(result.completed).toBe(true);
    expect(Math.hypot(result.position.x-10,result.position.z-.5)).toBeLessThan(.3);
  });
  it('returns to the office without getting pinned to the wall',()=>{
    const result=follow({x:13.4,z:2.3},{x:21.2,z:-.6});
    expect(result.completed).toBe(true);
  });
  it('maintains progress when another guard stands in the door',()=>{
    const result=follow({x:13.4,z:2.3},{x:21.2,z:-.6},
      [{x:14.8,z:.5},{x:15.5,z:.4}]);
    expect(result.completed).toBe(true);
  });
  it('never steps directly through an impassable wall',()=>{
    const result=moveGuardWithAvoidance({x:13.5,z:5},
      {x:16,z:5},[],clearance,4,.08);
    expect(clearance(result.point.x,result.point.z)).toBe(true);
  });
});
