import {describe, expect, it} from 'vitest';
import {renderOfficeFeed} from '../src/blackout/office-monitor';

function mockCanvas(width:number,height:number){
  const texts:string[]=[];
  const ctx={
    canvas:{width,height},
    fillStyle:'',strokeStyle:'',lineWidth:1,font:'',
    setTransform(){},clearRect(){},fillRect(){},beginPath(){},moveTo(){},
    lineTo(){},stroke(){},fillText(text:string){texts.push(text);},
  };
  return {ctx:ctx as unknown as CanvasRenderingContext2D,texts};
}

describe('Physical security-office traffic monitor',()=>{
  it('renders changing request counts, incident states and live proxy status',()=>{
    const {ctx,texts}=mockCanvas(512,288);
    renderOfficeFeed(ctx,{
      traffic:18765,health:42,proxies:3,
      dispatchActive:true,alert:true,
      history:[{traffic:12000},{traffic:18765}],
      requests:[{status:200,path:'/api/search'},{status:429,path:'/api/orders'}],
    });
    expect(texts).toContain('18,765');
    expect(texts).toContain('42%');
    expect(texts).toContain('3');
    expect(texts).toContain('ALERT');
    expect(texts).toContain('OFFICERS DEPLOYED');
    expect(texts.some(t=>t.includes('/api/orders'))).toBe(true);
  });
  it('shows standby monitoring when officers return to the office',()=>{
    const {ctx,texts}=mockCanvas(768,432);
    renderOfficeFeed(ctx,{
      traffic:2200,health:100,proxies:5,
      dispatchActive:false,alert:false,
      history:[{traffic:1700},{traffic:1900},{traffic:2200}],
      requests:[],
    });
    expect(texts).toContain('CONTROL ROOM MONITORING');
    expect(texts).toContain('ONLINE');
    expect(texts).toContain('2,200');
  });
});
