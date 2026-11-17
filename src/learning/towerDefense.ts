/**
 * Pico Defender. Shared deterministic 2D tower-defense rules for solo and
 * Cloudflare room multiplayer. Canvas rendering is intentionally separate.
 * No randomness, external images, WebGL, timers or storage in the engine.
 */
export const DEFENSE_COLS = 12;
export const DEFENSE_ROWS = 8;
export const DEFENSE_PATH = [
  [0,3],[1,3],[2,3],[2,2],[2,1],[3,1],[4,1],[5,1],
  [5,2],[5,3],[5,4],[6,4],[7,4],[8,4],[8,5],[8,6],[9,6],[10,6],[11,6],
] as const;
const road = new Set<string>(DEFENSE_PATH.map(([x,y]) => x+','+y));
export type DefenseMode = 'circuit' | 'hacker';
export type TowerKind = 'blaster' | 'frost' | 'pulse';
export type EnemyKind = 'bug' | 'tank' | 'glitch';
export type Tower = {
  x: number; y: number; kind: TowerKind; level: number;
  readyAt: number; lastShotAt: number; target: number | null;
};
export type Enemy = {
  id: number; kind: EnemyKind; progress: number; hp: number; maxHp: number; slowUntil: number;
};
export type DefenseState = {
  startedAt: number; lastTickAt: number; lastSpawnAt: number; spawnIndex: number;
  nextId: number; wave: number; health: number; kills: number; escaped: number;
  towers: Tower[]; enemies: Enemy[];
};
export const TOWERS: Record<TowerKind, { label: string; cost: number; damage: number; reach: number; cooldown: number }> = {
  blaster: { label: 'Blaster', cost: 65, damage: 22, reach: 2.7, cooldown: 0.72 },
  frost: { label: 'Frost', cost: 90, damage: 10, reach: 2.5, cooldown: 1.18 },
  pulse: { label: 'Pulse', cost: 125, damage: 15, reach: 2.1, cooldown: 1.58 },
};
export function pathCell(x: number, y: number) { return road.has(x+','+y); }
export function validPlot(x: number, y: number) {
  return Number.isInteger(x) && Number.isInteger(y)
    && x >= 0 && x < DEFENSE_COLS && y >= 0 && y < DEFENSE_ROWS && !pathCell(x,y);
}
export function defenseStart(startedAt: number): DefenseState {
  return { startedAt, lastTickAt: startedAt, lastSpawnAt: startedAt + 3200,
    nextId: 0, spawnIndex: 0, wave: 1, health: 100, kills: 0, escaped: 0,
    towers: [], enemies: [] };
}
export function enemyXY(progress: number) {
  const step = Math.max(0, Math.min(DEFENSE_PATH.length - 1, Math.floor(progress)));
  const [x,y] = DEFENSE_PATH[step]!;
  const [nx,ny] = DEFENSE_PATH[Math.min(step+1, DEFENSE_PATH.length-1)]!;
  const fractional = Math.max(0, Math.min(1, progress - step));
  return { x: x + (nx-x)*fractional + .5, y: y + (ny-y)*fractional + .5 };
}
export function upgradeCost(tower: Tower): number | null {
  return tower.level >= 3 ? null : 55 + tower.level * 40;
}
export function placeTower(state: DefenseState, x: number, y: number, kind: TowerKind):
  { state: DefenseState; cost: number } | null {
  if (!(kind in TOWERS) || !validPlot(x,y) || state.health <= 0 ||
    state.towers.some(t=>t.x===x && t.y===y)) return null;
  if (state.towers.length >= 32) return null;
  return { cost: TOWERS[kind].cost, state: { ...state, towers: [...state.towers,
    { x,y,kind,level:1,readyAt:state.lastTickAt,lastShotAt:0,target:null }] } };
}
export function upgradeTower(state: DefenseState, x: number, y: number):
  { state: DefenseState; cost: number } | null {
  const i=state.towers.findIndex(t=>t.x===x&&t.y===y);
  if(i<0 || state.health<=0)return null;
  const cost=upgradeCost(state.towers[i]!);
  if(cost===null)return null;
  return { cost, state:{...state,towers:state.towers.map((t,j)=>j===i?{...t,level:t.level+1}:t)} };
}
export function enemySpeed(enemy: Enemy, at: number) {
  const base = enemy.kind==='tank' ? .36 : enemy.kind==='glitch' ? .78 : .54;
  return at<enemy.slowUntil ? base*.44 : base;
}
function enemyFor(index:number,wave:number):Enemy {
  const kind: EnemyKind = index%7===5?'tank':index%5===4?'glitch':'bug';
  const base=kind==='tank'?90:kind==='glitch'?35:48;
  const hp=Math.round(base*(1+(wave-1)*.13));
  return {id:index,kind,progress:0,hp,maxHp:hp,slowUntil:0};
}
function sqDist(a:{x:number;y:number},b:{x:number;y:number}) {
  return (a.x-b.x)**2+(a.y-b.y)**2;
}
export function advanceDefense(original:DefenseState, until:number):DefenseState {
  if(!Number.isFinite(until)||until<=original.lastTickAt||original.health<=0)return original;
  const state:DefenseState={...original, towers:original.towers.map(t=>({...t})),
    enemies:original.enemies.map(e=>({...e}))};
  // 120 ms simulation ticks keep CPU use low and make browser/Worker results consistent.
  // Catch up at most 90 seconds per request; remaining time is handled on later polls.
  const stop=Math.min(until,state.lastTickAt+90000);
  let safety=0;
  while(state.lastTickAt<stop && safety++<850){
    const next=Math.min(stop,state.lastTickAt+120);
    const dt=(next-state.lastTickAt)/1000;
    state.lastTickAt=next;
    state.wave=Math.min(12,1+Math.floor(Math.max(0,next-state.startedAt)/26000));
    const spawnGap=Math.max(1050,3100-state.wave*155);
    if(next>=state.lastSpawnAt+spawnGap && next-state.startedAt>=5000 && state.enemies.length<34){
      const enemy=enemyFor(state.spawnIndex,state.wave);
      enemy.id=state.nextId++;
      state.enemies.push(enemy); state.spawnIndex++;
      state.lastSpawnAt=next;
    }
    for(const enemy of state.enemies)enemy.progress+=enemySpeed(enemy,next)*dt;
    const arrived=state.enemies.filter(enemy=>enemy.progress>=DEFENSE_PATH.length-1);
    if(arrived.length){
      state.escaped+=arrived.length;
      state.health=Math.max(0,state.health-arrived.reduce((sum,e)=>sum+(e.kind==='tank'?18:10),0));
      state.enemies=state.enemies.filter(enemy=>enemy.progress<DEFENSE_PATH.length-1);
    }
    if(state.health<=0)break;
    for(const tower of state.towers){
      if(next<tower.readyAt)continue;
      const cfg=TOWERS[tower.kind]; const origin={x:tower.x+.5,y:tower.y+.5};
      const targets=state.enemies.filter(e=>e.hp>0 &&
        sqDist(origin,enemyXY(e.progress))<=(cfg.reach+.18*(tower.level-1))**2)
        .sort((a,b)=>b.progress-a.progress);
      if(!targets.length){tower.target=null;continue;}
      const chosen=targets[0]!;
      const damage=Math.round(cfg.damage*(1+(tower.level-1)*.6));
      if(tower.kind==='pulse'){
        targets.filter(e=>sqDist(enemyXY(e.progress),enemyXY(chosen.progress))<=1.7**2)
          .forEach(e=>{e.hp-=damage;});
      }else{
        chosen.hp-=damage;
        if(tower.kind==='frost')chosen.slowUntil=next+1350;
      }
      tower.target=chosen.id;tower.lastShotAt=next;tower.readyAt=next+cfg.cooldown*1000;
    }
    const gone=state.enemies.filter(e=>e.hp<=0);
    if(gone.length){state.kills+=gone.length;state.enemies=state.enemies.filter(e=>e.hp>0);}
  }
  return state;
}
export function defenseScore(state:DefenseState):number {
  return state.kills*45 + state.towers.reduce((s,t)=>s+50*t.level,0)
    + Math.max(0,state.health)*4;
}
export function defenseSummary(state:DefenseState){
  return {wave:state.wave,health:state.health,kills:state.kills,escaped:state.escaped,
    towers:state.towers.length,score:defenseScore(state)};
}
