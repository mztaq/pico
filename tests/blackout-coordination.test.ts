import { describe, expect, it } from 'vitest';
import { formationPosition, rankedCoverSpots } from '../src/blackout/ai-coordination';
import { isSightBlocked } from '../src/blackout/stealth-logic';

const racks:[number,number][]=[[-5,2],[4,2],[-5,-4],[4,-4],[-10,7],[10,7]];
const walkable=(x:number,z:number)=>
  x>-15&&x<15&&z>-11&&z<11&&
  racks.every(([rx,rz])=>!(Math.abs(x-rx)<1.15&&Math.abs(z-rz)<1.3));

describe('Dynamic hacker cover',()=>{
  it('selects valid cover around racks, not a fixed escape route',()=>{
    const top=rankedCoverSpots({x:0,z:0},[{x:9,z:3}],racks,walkable,isSightBlocked,()=>.5);
    expect(top.length).toBeGreaterThan(8);
    expect(walkable(top[0].x,top[0].z)).toBe(true);
    expect(Math.hypot(top[0].x-9,top[0].z-3)).toBeGreaterThan(3.5);
  });
  it('changes priority when guards approach from the opposite side',()=>{
    const west=rankedCoverSpots({x:0,z:0},[{x:-12,z:-3}],racks,walkable,isSightBlocked,()=>.5);
    const east=rankedCoverSpots({x:0,z:0},[{x:12,z:3}],racks,walkable,isSightBlocked,()=>.5);
    expect(west[0]).toBeDefined();expect(east[0]).toBeDefined();
    expect(west[0]).not.toEqual(east[0]);
  });
  it('discourages hiding in the exact same location repeatedly',()=>{
    const first=rankedCoverSpots({x:0,z:0},[{x:9,z:3}],racks,walkable,isSightBlocked,()=>.5);
    const again=rankedCoverSpots({x:0,z:0},[{x:9,z:3}],racks,walkable,isSightBlocked,()=>.5,first[0]);
    expect(again[0]).not.toEqual(first[0]);
  });
});

describe('Officer formation',()=>{
  it('assigns distinct positions around a moving suspect',()=>{
    const target={x:3,z:1},left=formationPosition(target,.2,0),right=formationPosition(target,.2,1);
    expect(Math.hypot(left.x-right.x,left.z-right.z)).toBeGreaterThan(3);
    expect(Math.hypot(left.x-target.x,left.z-target.z)).toBeCloseTo(2.35);
    expect(Math.hypot(right.x-target.x,right.z-target.z)).toBeCloseTo(2.35);
  });
});
