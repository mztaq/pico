import {describe,expect,it} from 'vitest';
import {fitCircuitBounds,stepCircuitZoom} from './viewport';

describe('Fit circuit viewport',()=>{
  it.each([
    [{x:64,y:48,width:4442,height:2714},1350,720],
    [{x:-50000,y:-100000,width:150000,height:200000},350,500],
    [{x:-320,y:-40,width:16000,height:200},900,600],
    [{x:0,y:0,width:200,height:16000},1200,450],
    [{x:42,y:60,width:122,height:78},1000,800],
    [{x:1,y:2,width:0,height:0},10,8],
  ] as const)('centers and contains the entire bounds %j in %d by %d', (bounds,width,height)=>{
    const view=fitCircuitBounds(bounds,width,height)!;
    const {zoom,offset}=view;
    expect(zoom).toBeGreaterThan(0);
    expect(offset.x+bounds.x*zoom).toBeGreaterThanOrEqual(0);
    expect(offset.y+bounds.y*zoom).toBeGreaterThanOrEqual(0);
    expect(offset.x+(bounds.x+bounds.width)*zoom).toBeLessThanOrEqual(width);
    expect(offset.y+(bounds.y+bounds.height)*zoom).toBeLessThanOrEqual(height);
    expect(offset.x+(bounds.x+bounds.width/2)*zoom).toBeCloseTo(width/2);
    expect(offset.y+(bounds.y+bounds.height/2)*zoom).toBeCloseTo(height/2);
  });
  it('fits the 5x4 multiplier below the former 35% floor',()=>{
    expect(fitCircuitBounds({x:64,y:48,width:4442,height:2714},1350,720)!.zoom).toBeLessThan(.35);
  });
  it('does not jump back to 35% when zooming a fitted circuit',()=>{
    expect(stepCircuitZoom(.08,1.2)).toBeCloseTo(.096);
    expect(stepCircuitZoom(.08,1/1.2)).toBeLessThan(.08);
    expect(stepCircuitZoom(.0005,1.2)).toBeCloseTo(.0006);
  });
  it('ignores an unmeasurable viewport',()=>{
    expect(fitCircuitBounds({x:0,y:0,width:100,height:100},0,800)).toBeNull();
  });
});
