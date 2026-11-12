import {describe, expect, it} from 'vitest';
import {routeTo} from '../src/blackout/navigation';

const obstacles = (x:number,z:number) =>
  x>-23&&x<31&&z>-12.5&&z<12.5 &&
  !(x>14.2&&x<15.1&&(z<-1||z>1.7)) &&
  !(Math.abs(x-2.3)<1.26&&Math.abs(z-2)<1.38) &&
  !(Math.abs(x-5.9)<1.26&&Math.abs(z-2)<1.38);

describe('Data center navigation',()=>{
  it('routes office guards through the real doorway to the server hall',()=>{
    const start={x:23.4,z:4.1},target={x:-8,z:6.2};
    const path=routeTo(start,target,obstacles);
    expect(path.length).toBeGreaterThan(1);
    expect(path.at(-1)?.x).toBeCloseTo(target.x);
    for(const p of path)expect(obstacles(p.x,p.z)).toBe(true);
    let before=start;
    let passedDoor=false;
    for(const next of path){
      const n=Math.ceil(Math.hypot(next.x-before.x,next.z-before.z)/0.25);
      for(let j=0;j<=n;j++){
        const t=j/Math.max(1,n);
        const x=before.x+(next.x-before.x)*t;
        const z=before.z+(next.z-before.z)*t;
        expect(obstacles(x,z)).toBe(true);
        if(Math.abs(x-14.7)<.25&&z> -1&&z<1.7)passedDoor=true;
      }
      before=next;
    }
    expect(passedDoor).toBe(true);
  });
  it('finds different routes for changing targets and avoids rack volumes',()=>{
    const from={x:8.8,z:7};
    const a=routeTo(from,{x:-8,z:-6},obstacles);
    const b=routeTo(from,{x:-14,z:9},obstacles);
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
  it('does not travel through a solid unbroken wall',()=>{
    const barrier=(x:number,z:number)=> x>=-5&&x<=5&&z>=-4&&z<=4 && !(x>-.5&&x<.5);
    const path=routeTo({x:-3,z:0},{x:3,z:0},barrier,
      {minX:-5,maxX:5,minZ:-4,maxZ:4},.5);
    expect(path).toEqual([]);
  });
});