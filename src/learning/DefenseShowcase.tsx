import { useEffect, useState } from 'react';
import { Crosshair, Snowflake, Waves, Zap } from 'lucide-react';
import { DEFENSE_COLS, DEFENSE_ROWS, enemyXY, pathCell } from './towerDefense';
import './defense-showcase.css';

const turrets = [
  {x:3,y:2,kind:'blaster'},
  {x:6,y:3,kind:'frost'},
  {x:7,y:3,kind:'pulse'},
  {x:9,y:5,kind:'blaster'},
] as const;
const tiles=Array.from({length:DEFENSE_COLS*DEFENSE_ROWS},(_,i)=>({x:i%DEFENSE_COLS,y:Math.floor(i/DEFENSE_COLS)}));

export function DefenseShowcase({hacker=false}:{hacker?:boolean}){
  const [tick,setTick]=useState(0);
  useEffect(()=>{
    if(typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const id=window.setInterval(()=>setTick(old=>old+1),170);
    return()=>window.clearInterval(id);
  },[]);
  return <div className={'defense-showcase'+(hacker?' is-hacker':'')} aria-label="Moving preview of Pico Defender with attacking towers and malware">
    <div className="defense-showcase-top"><span><Zap size={12}/> WAVE 3</span><span>CORE <b>86%</b></span></div>
    <div className="defense-showcase-world" aria-hidden="true">
      {tiles.map(tile=><span key={tile.y*DEFENSE_COLS+tile.x}
        className={'defense-showcase-tile'+(pathCell(tile.x,tile.y)?' road':'')}
        style={{left:(tile.x/DEFENSE_COLS*100)+'%',top:(tile.y/DEFENSE_ROWS*100)+'%'}} />)}
      <span className="defense-showcase-base is-spawn" style={{left:'4%',top:'44%'}}>IN</span>
      <span className="defense-showcase-base is-core" style={{left:'96%',top:'81%'}}>HQ</span>
      {turrets.map(turret=>{
        const Icon=turret.kind==='blaster'?Crosshair:turret.kind==='frost'?Snowflake:Waves;
        return <span key={turret.x+'-'+turret.y} className={'defense-showcase-tower '+turret.kind}
          style={{left:((turret.x+.5)/DEFENSE_COLS*100)+'%',top:((turret.y+.5)/DEFENSE_ROWS*100)+'%'}}>
          <Icon size={15} strokeWidth={2.5}/></span>;
      })}
      {[0,1,2,3].map((number)=>{
        const progress=(tick*.14-number*3.6+12+18.1)%18.1;
        const point=enemyXY(progress);
        return <span key={number} className={'defense-showcase-bug type-'+number%3}
          style={{left:(point.x/DEFENSE_COLS*100)+'%',top:(point.y/DEFENSE_ROWS*100)+'%'}}>
          <i/><i/></span>;
      })}
    </div>
    <div className="defense-showcase-bar"><span>4 towers placed</span><span>17 threats blocked</span></div>
  </div>;
}
