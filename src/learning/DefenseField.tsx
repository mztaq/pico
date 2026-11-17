import { useEffect, useRef, useState } from 'react';
import { ArrowUpCircle, Bug, Crosshair, Snowflake, Waves, Zap } from 'lucide-react';
import {
  DEFENSE_COLS, DEFENSE_ROWS, DEFENSE_PATH, TOWERS,
  enemySpeed, enemyXY, pathCell, upgradeCost, validPlot,
  type DefenseMode, type DefenseState, type Tower, type TowerKind,
} from './towerDefense';
import './defense-field.css';

type Props = {
  state: DefenseState;
  mode: DefenseMode;
  charge: number;
  busy: boolean;
  onBuild: (x: number, y: number, kind: TowerKind) => void;
  onUpgrade: (x: number, y: number) => void;
};

const byKind = [
  { id: 'blaster', label: 'Blaster', note: 'Quick shots', icon: Crosshair },
  { id: 'frost', label: 'Frost', note: 'Slows enemies', icon: Snowflake },
  { id: 'pulse', label: 'Pulse', note: 'Area damage', icon: Waves },
] as const;

type Point = { x:number;y:number };
function rounded(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){
  const radius=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+radius,y);
  ctx.arcTo(x+w,y,x+w,y+h,radius);
  ctx.arcTo(x+w,y+h,x,y+h,radius);
  ctx.arcTo(x,y+h,x,y,radius);
  ctx.arcTo(x,y,x+w,y,radius);
  ctx.closePath();
}
function palette(canvas:HTMLCanvasElement){
  const css=getComputedStyle(canvas);
  const get=(token:string,fallback:string)=>css.getPropertyValue(token).trim()||fallback;
  return {
    accent:get('--accent','#cba6f7'),panel:get('--ds-panel','#28283b'),
    bg:get('--bg','#1e1e2e'), muted:get('--ds-muted','#a6adc8'),
    text:get('--ds-text','#cdd6f4'),border:get('--ds-line-strong','#45475a'),
    success:get('--learn-success','#a6e3a1'), danger:get('--learn-danger','#f38ba8'),
  };
}
function sprite(ctx:CanvasRenderingContext2D,x:number,y:number,color:string,kind:string,t:number,scale=1){
  ctx.save();ctx.translate(x,y+Math.sin(t*.006+x*2)*.025);ctx.scale(scale,scale);
  ctx.shadowBlur=6;ctx.shadowColor=color;
  ctx.lineWidth=.035;ctx.strokeStyle='#111322';ctx.fillStyle=color;
  // Pixel-friendly rounded creature, with little feet, antennas and expression.
  ctx.beginPath();ctx.ellipse(-.17,.26,.065,.095,.25,0,Math.PI*2);
  ctx.ellipse(.17,.26,.065,.095,-.25,0,Math.PI*2);ctx.fill();ctx.stroke();
  rounded(ctx,-.34,-.29,.68,.52,.19);ctx.fill();ctx.stroke();
  ctx.shadowBlur=0;ctx.fillStyle='#181925';
  ctx.beginPath();ctx.ellipse(-.115,-.045,.046,.075,0,0,Math.PI*2);
  ctx.ellipse(.115,-.045,.046,.075,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#181925';ctx.lineWidth=.024;ctx.beginPath();
  ctx.moveTo(-.14,-.30);ctx.lineTo(-.23,-.39);ctx.moveTo(.14,-.30);ctx.lineTo(.23,-.39);ctx.stroke();
  if(kind==='tank'){
    ctx.strokeStyle='#fff3';ctx.lineWidth=.05;rounded(ctx,-.31,-.26,.62,.48,.16);ctx.stroke();
    ctx.fillStyle='#fff7';rounded(ctx,-.22,-.25,.44,.08,.02);ctx.fill();
  }else if(kind==='glitch'){
    ctx.fillStyle='#fff9';ctx.fillRect(-.30,-.15,.09,.065);ctx.fillRect(.19,.12,.12,.055);
  } else {ctx.fillStyle='#fff5';rounded(ctx,-.20,-.25,.28,.075,.04);ctx.fill();}
  ctx.restore();
}
function drawTower(ctx:CanvasRenderingContext2D,tower:Tower,now:number,p:{accent:string;muted:string},hovered:boolean){
  const x=tower.x+.5,y=tower.y+.5;
  const color=tower.kind==='blaster'?p.accent:tower.kind==='frost'?'#89dceb':'#fab387';
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='#171827';ctx.strokeStyle=color;ctx.lineWidth=.045;
  rounded(ctx,-.37,-.33,.74,.7,.15);ctx.fill();ctx.stroke();
  ctx.globalAlpha=.18;ctx.fillStyle=color;rounded(ctx,-.30,-.26,.60,.56,.10);ctx.fill();ctx.globalAlpha=1;
  ctx.fillStyle=color;ctx.strokeStyle='#1c1c30';ctx.lineWidth=.03;
  if(tower.kind==='blaster'){
    ctx.translate(0,.045);rounded(ctx,-.13,-.21,.26,.42,.07);ctx.fill();
    rounded(ctx,-.065,-.44,.13,.30,.035);ctx.fill();
    ctx.fillStyle='#fff9';ctx.fillRect(-.08,.09,.16,.06);
  }else if(tower.kind==='frost'){
    ctx.beginPath();
    for(let i=0;i<6;i++){const a=i*Math.PI/3+now*.0002;ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*.27,Math.sin(a)*.27);}
    ctx.strokeStyle=color;ctx.lineWidth=.07;ctx.stroke();ctx.beginPath();ctx.arc(0,0,.085,0,Math.PI*2);ctx.fill();
  }else{
    ctx.strokeStyle=color;ctx.lineWidth=.07;
    ctx.beginPath();ctx.arc(0,0,.24,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.arc(0,0,.10,0,Math.PI*2);ctx.fill();
    for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.beginPath();ctx.arc(Math.cos(a)*.31,Math.sin(a)*.31,.04,0,Math.PI*2);ctx.fill();}
  }
  ctx.restore();
  for(let i=0;i<tower.level;i++){
    ctx.fillStyle=color;rounded(ctx,x-.22+i*.16,y+.29,.11,.08,.02);ctx.fill();
  }
  if(hovered){
    ctx.save();ctx.globalAlpha=.16;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,
      TOWERS[tower.kind].reach+.18*(tower.level-1),0,Math.PI*2);ctx.fill();ctx.restore();
  }
}
export function DefenseField({ state, mode, charge, busy, onBuild, onUpgrade }:Props){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const gameRef=useRef(state);
  const hoverRef=useRef<Point|null>(null);
  const [selected,setSelected]=useState<TowerKind>('blaster');
  const [hover,setHover]=useState<Point|null>(null);
  const [notice,setNotice]=useState('');
  gameRef.current=state;
  hoverRef.current=hover;

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)return;
    let frame=0,previous=0;
    let running=true;
    const draw=(now:number)=>{
      if(!running)return;
      if(!document.hidden && now-previous>=32){
        previous=now;
        const rect=canvas.getBoundingClientRect();
        if(rect.width>0){
          const dpr=Math.min(2,window.devicePixelRatio||1);
          const w=Math.round(rect.width*dpr),h=Math.round(rect.width*DEFENSE_ROWS/DEFENSE_COLS*dpr);
          if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
          const cell=w/DEFENSE_COLS;
          ctx.setTransform(cell,0,0,cell,0,0);
          const p=palette(canvas),s=gameRef.current, hovered=hoverRef.current;
          ctx.fillStyle=p.bg;ctx.fillRect(0,0,DEFENSE_COLS,DEFENSE_ROWS);
          for(let y=0;y<DEFENSE_ROWS;y++){
            for(let x=0;x<DEFENSE_COLS;x++){
              const isRoad=pathCell(x,y);
              ctx.fillStyle=isRoad?(mode==='hacker'?'#31364a':'#34344d'):
                (x+y)%2===0?p.panel:p.bg;
              rounded(ctx,x+.035,y+.035,.93,.93,.12);ctx.fill();
              if(isRoad){
                ctx.strokeStyle=p.border;ctx.lineWidth=.018;ctx.stroke();
                ctx.globalAlpha=.16;ctx.fillStyle=p.accent;ctx.fillRect(x+.41,y+.45,.18,.10);ctx.globalAlpha=1;
              }else if((x*13+y*7)%6===0){
                ctx.globalAlpha=.3;ctx.fillStyle=p.muted;
                ctx.beginPath();ctx.arc(x+.18,y+.22,.035,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
              }
              if(hovered && x===hovered.x&&y===hovered.y&&validPlot(x,y)){
                ctx.save();ctx.globalAlpha=.19;ctx.fillStyle=p.accent;
                rounded(ctx,x+.08,y+.08,.84,.84,.13);ctx.fill();ctx.restore();
                ctx.strokeStyle=p.accent;ctx.lineWidth=.04;rounded(ctx,x+.09,y+.09,.82,.82,.12);ctx.stroke();
              }
            }
          }
          // Continuous winding route visually links the spawn and server.
          ctx.strokeStyle=mode==='hacker'?'#86b7c8':'#8776b1';ctx.globalAlpha=.43;
          ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=.19;ctx.setLineDash([.09,.18]);
          ctx.beginPath();DEFENSE_PATH.forEach(([x,y],i)=>i?ctx.lineTo(x+.5,y+.5):ctx.moveTo(x+.5,y+.5));ctx.stroke();
          ctx.setLineDash([]);ctx.globalAlpha=1;
          ctx.fillStyle='#a6e3a1';rounded(ctx,.13,3.19,.55,.62,.10);ctx.fill();
          ctx.fillStyle='#222438';ctx.font='bold .20px sans-serif';ctx.textAlign='center';ctx.fillText('IN',.40,3.57);
          ctx.fillStyle=p.accent;rounded(ctx,11.20,6.16,.65,.66,.13);ctx.fill();
          ctx.fillStyle='#1e2030';ctx.font='bold .20px sans-serif';ctx.fillText('CORE',11.53,6.55);
          // Towers.
          for(const tower of s.towers){
            drawTower(ctx,tower,now,p,!!(hovered&&hovered.x===tower.x&&hovered.y===tower.y));
            if(tower.target!==null && now-tower.lastShotAt<260){
              const target=s.enemies.find(enemy=>enemy.id===tower.target);
              if(target){
                const interp=Math.min(.12,Math.max(0,(Date.now()-s.lastTickAt)/1000));
                const xy=enemyXY(target.progress+enemySpeed(target,Date.now())*interp);
                const color=tower.kind==='blaster'?p.accent:tower.kind==='frost'?'#89dceb':'#fab387';
                ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=1-(now-tower.lastShotAt)/260;
                ctx.lineWidth=tower.kind==='pulse'?.13:.065;ctx.beginPath();
                ctx.moveTo(tower.x+.5,tower.y+.5);ctx.lineTo(xy.x,xy.y);ctx.stroke();
                ctx.fillStyle=color;ctx.beginPath();ctx.arc(xy.x,xy.y,.13,0,Math.PI*2);ctx.fill();ctx.restore();
              }
            }
          }
          // Animated malware: faces, feet, health bars, slow effect.
          for(const enemy of s.enemies){
            const interp=Math.min(.20,Math.max(0,(Date.now()-s.lastTickAt)/1000));
            const xy=enemyXY(enemy.progress+enemySpeed(enemy,Date.now())*interp);
            const color=enemy.kind==='tank'?'#fab387':enemy.kind==='glitch'?'#f38ba8':'#89b4fa';
            if(Date.now()<enemy.slowUntil){
              ctx.strokeStyle='#89dceb';ctx.lineWidth=.05;
              ctx.beginPath();ctx.arc(xy.x,xy.y,.45,0,Math.PI*2);ctx.stroke();
            }
            sprite(ctx,xy.x,xy.y,color,enemy.kind,now,enemy.kind==='tank'?1.1:.85);
            ctx.fillStyle='#1c1b2c';rounded(ctx,xy.x-.32,xy.y-.45,.64,.07,.025);ctx.fill();
            ctx.fillStyle=enemy.hp/enemy.maxHp<.32?'#f38ba8':'#a6e3a1';
            rounded(ctx,xy.x-.32,xy.y-.45,.64*Math.max(0,enemy.hp/enemy.maxHp),.07,.025);ctx.fill();
          }
          // Overlay health/wave in-game without shifting the canvas.
          ctx.fillStyle=p.panel;ctx.globalAlpha=.91;rounded(ctx,.14,.14,2.20,.52,.13);ctx.fill();ctx.globalAlpha=1;
          ctx.fillStyle=p.text;ctx.font='bold .24px sans-serif';ctx.textAlign='left';
          ctx.fillText('WAVE '+s.wave+'   •   '+s.kills+' KOs',.34,.48);
          const healthRatio=Math.max(0,s.health/100);
          ctx.fillStyle=p.panel;ctx.globalAlpha=.9;rounded(ctx,DEFENSE_COLS-2.55,.14,2.4,.54,.12);ctx.fill();ctx.globalAlpha=1;
          ctx.fillStyle=healthRatio<.3?'#f38ba8':'#a6e3a1';
          rounded(ctx,DEFENSE_COLS-2.39,.30,1.43*healthRatio,.20,.07);ctx.fill();
          ctx.fillStyle=p.text;ctx.font='bold .18px sans-serif';ctx.textAlign='right';
          ctx.fillText(s.health+' HP',DEFENSE_COLS-.26,.45);
          if(s.health<=0){
            ctx.fillStyle='#1c1b2c';ctx.globalAlpha=.75;ctx.fillRect(0,0,DEFENSE_COLS,DEFENSE_ROWS);
            ctx.globalAlpha=1;ctx.textAlign='center';ctx.fillStyle='#f38ba8';
            ctx.font='bold .58px sans-serif';ctx.fillText('CORE BREACHED',DEFENSE_COLS/2,DEFENSE_ROWS/2);
            ctx.font='.27px sans-serif';ctx.fillStyle='#fff';
            ctx.fillText('The malware reached your server',DEFENSE_COLS/2,DEFENSE_ROWS/2+.5);
          }
          ctx.setTransform(1,0,0,1,0,0);
        }
      }
      frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);
    return()=>{running=false;cancelAnimationFrame(frame);};
  },[mode]);

  function coordinate(event:React.MouseEvent<HTMLCanvasElement>):Point{
    const r=event.currentTarget.getBoundingClientRect();
    return {x:Math.max(0,Math.min(DEFENSE_COLS-1,Math.floor((event.clientX-r.left)/r.width*DEFENSE_COLS))),
      y:Math.max(0,Math.min(DEFENSE_ROWS-1,Math.floor((event.clientY-r.top)/r.height*DEFENSE_ROWS)))};
  }
  function selectCell(p:Point){
    if(busy || state.health<=0)return;
    const tower=state.towers.find(t=>t.x===p.x&&t.y===p.y);
    if(tower){
      const cost=upgradeCost(tower);
      if(cost===null)setNotice('This tower is fully upgraded.');
      else if(charge<cost)setNotice('Upgrade needs '+cost+' charge. Answer more questions.');
      else {setNotice('');onUpgrade(p.x,p.y);}
    }else if(!validPlot(p.x,p.y))setNotice('Towers go on the land, not on the enemy route.');
    else if(charge<TOWERS[selected].cost)setNotice('Answer questions for '+(TOWERS[selected].cost-charge)+' more charge.');
    else {setNotice('');onBuild(p.x,p.y,selected);}
  }
  const current=hover&&state.towers.find(t=>t.x===hover.x&&t.y===hover.y);
  const need=current?upgradeCost(current):TOWERS[selected].cost;
  return <section className={'defense-shell defense-shell--'+mode} aria-label="2D tower defense">
    <div className="defense-heading">
      <div><h3>{mode==='hacker'?'Hacker Heist':'Circuit Defender'}</h3>
        <p>{mode==='hacker'?'Block incoming malware from your servers.':'Stop the incoming bugs before they reach the core.'}</p></div>
      <span><Bug size={15} aria-hidden="true"/> Wave {state.wave}</span>
    </div>
    <div className="defense-canvas-wrap">
      <canvas ref={canvasRef} tabIndex={0} role="button" aria-label="Tower defense map, click a free land tile to place selected tower. Arrow keys move selection; Enter builds or upgrades."
        onMouseMove={event=>setHover(old=>{const next=coordinate(event);return old?.x===next.x&&old?.y===next.y?old:next;})}
        onMouseLeave={()=>setHover(null)}
        onClick={event=>{const next=coordinate(event);setHover(next);selectCell(next);}}
        onKeyDown={event=>{
          const current=hover||{x:3,y:0};
          const arrows:Record<string,Point>={
            ArrowRight:{x:Math.min(11,current.x+1),y:current.y},
            ArrowLeft:{x:Math.max(0,current.x-1),y:current.y},
            ArrowUp:{x:current.x,y:Math.max(0,current.y-1)},
            ArrowDown:{x:current.x,y:Math.min(7,current.y+1)},
          };
          if(arrows[event.key]){event.preventDefault();setHover(arrows[event.key]!);}
          else if(event.key==='Enter'||event.key===' '){event.preventDefault();selectCell(current);}
        }} />
    </div>
    <div className="defense-shop" role="group" aria-label="Choose a tower to place">
      {byKind.map(entry=>{
        const Icon=entry.icon;
        const tower=TOWERS[entry.id];
        return <button key={entry.id} type="button" className={'defense-shop-item'+(selected===entry.id?' selected':'')}
          aria-pressed={selected===entry.id} onClick={()=>{setSelected(entry.id);setNotice('');}}>
          <Icon size={21} aria-hidden="true"/>
          <span><strong>{entry.label}</strong><small>{entry.note}</small></span>
          <b><Zap size={11}/>{tower.cost}</b>
        </button>;
      })}
    </div>
    <div className="defense-bottom">
      <span>{current?<><ArrowUpCircle size={14}/> Upgrade {current.kind} · {need===null?'MAX':need+' charge'}</>
        :<><Zap size={14}/> Pick a tower, then click empty land to build</>}</span>
      <span>{state.towers.length} towers · {state.kills} defeated · {state.health} core HP</span>
    </div>
    {notice && <p className="defense-notice" role="status">{notice}</p>}
  </section>;
}
