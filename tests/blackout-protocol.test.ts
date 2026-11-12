import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const game = readFileSync(new URL('../src/blackout/game.ts', import.meta.url), 'utf8');
const html = readFileSync(new URL('../blackout-protocol/index.html', import.meta.url), 'utf8');
const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/blackout/game.css', import.meta.url), 'utf8');

describe('Blackout Protocol 3D', () => {
  it('parses the TypeScript game module as JavaScript and bundles the graphics engine locally', () => {
    expect(game).toContain("import * as THREE from 'three'");
    expect(game).toContain("import { createTrafficFeed } from './traffic-model'");
    expect(game).toContain("import { isSightBlocked, chooseHackerPhase, hackerAreaIsClear } from './stealth-logic'");
    expect(game).toContain("import { drawTerminalScreen, terminalHitTest } from './terminal-screen'");
    expect(game).toContain("import { routeTo } from './navigation'");
    expect(game).toContain("import { moveGuardWithAvoidance } from './guard-movement'");
    expect(game).toContain("import { renderOfficeFeed } from './office-monitor'");
    expect(game).toContain("import { rankedCoverSpots, formationPosition } from './ai-coordination'");
    expect(game).toContain("import {estimatedBitsPerSecond, formatBandwidth,DEFAULT_BYTES_PER_REQUEST} from './traffic-bandwidth'");
    expect(game).toContain("import {ATTACK_TRAFFIC_SCALE,DEFENSE_WAVE_SCALE,poweredProxyCount,firstUnpoweredProxy,nearestPoweredProxy} from './proxy-mechanics'");
    expect(game).toContain("import {");
    expect(game).toContain("} from './security-response'");
    expect(game).toContain('observeSecurityAlarm(g,activeAlarm)');
    expect(game).toContain("const respondersReturning=g.securityDispatchActive&&patrols.every(p=>");
    expect(game).toContain('if(shouldDispatchSecurity(g,respondersReturning))');
    expect(game).toContain("const firstSweep=g.mode==='attack'");
    expect(game).toContain('p.path=bpGuardRoute(p.agent.position,firstSweep)');
    expect(game).toContain('acknowledgeSecurityDispatch(g)');
    expect(game).toContain('securityOfficersReturned(g)');
    expect(game).toContain("case'burst':g.burst=8;g.risk+=9;flagSecurityIncident(g)");
    expect(game).toContain("function bpApplyQuality()");
    expect(game).toContain("qualitySelect.addEventListener('change'");
    expect(() => new Function(game
      .replace("import * as THREE from 'three';", 'const THREE = {};')
      .replace("import { createTrafficFeed } from './traffic-model';", 'const createTrafficFeed = () => ({});')
      .replace("import { drawTerminalScreen, terminalHitTest } from './terminal-screen';", 'const drawTerminalScreen = () => {}; const terminalHitTest = () => -1;')
      .replace("import { isSightBlocked, chooseHackerPhase, hackerAreaIsClear } from './stealth-logic';", 'const isSightBlocked = () => false; const chooseHackerPhase = () => "working"; const hackerAreaIsClear = () => true;')
      .replace("import { routeTo } from './navigation';", 'const routeTo = () => [];')
      .replace("import { moveGuardWithAvoidance } from './guard-movement';", "const moveGuardWithAvoidance = () => ({point:{x:0,z:0},arrived:false,moved:0});")
      .replace("import { renderOfficeFeed } from './office-monitor';", 'const renderOfficeFeed = () => {};')
      .replace("import { rankedCoverSpots, formationPosition } from './ai-coordination';", 'const rankedCoverSpots = () => []; const formationPosition = () => ({x:0,z:0});')
      .replace("import {estimatedBitsPerSecond, formatBandwidth,DEFAULT_BYTES_PER_REQUEST} from './traffic-bandwidth';", "const estimatedBitsPerSecond = () => 0;const formatBandwidth = () => ''; const DEFAULT_BYTES_PER_REQUEST = 0;")
      .replace("import {ATTACK_TRAFFIC_SCALE,DEFENSE_WAVE_SCALE,poweredProxyCount,firstUnpoweredProxy,nearestPoweredProxy} from './proxy-mechanics';", "const ATTACK_TRAFFIC_SCALE=1;const DEFENSE_WAVE_SCALE=1;const poweredProxyCount=()=>0;const firstUnpoweredProxy=()=>0;const nearestPoweredProxy=()=>-1;")
      .replace(/import \{\s*flagSecurityIncident, observeSecurityAlarm, shouldDispatchSecurity,\s*acknowledgeSecurityDispatch, securityOfficersReturned,\s*\} from '\.\/security-response';/, 'const flagSecurityIncident = () => {};const observeSecurityAlarm = () => {};const shouldDispatchSecurity = () => false;const acknowledgeSecurityDispatch = () => {};const securityOfficersReturned = () => {};const SECURITY_OFFICE_REST_SECONDS = 10;'))).not.toThrow();
    expect(vite).toContain("blackout: resolve(process.cwd(), 'blackout-protocol/index.html')");
    expect(html).toContain('src="/src/blackout/game.ts"');
    expect(html).toContain('src="/pico-logo.svg"');
  });

  it('clears high-load warnings on attack success, failure, court hearings and jail', () => {
    expect(game).toContain("const liveMission=bp.active&&!g.ended&&!courtroom.visible&&!jail.visible&&");
    expect(game).toContain("const urgent=liveMission&&");
    expect(game).toContain("document.body.classList.add('bp-mission-finished')");
    expect(game).toContain("document.body.classList.remove('bp-mission-finished')");
    expect(game).toContain("bpOriginalEnd(win,title,description)");
    expect(game).toContain("$('red-alert').textContent=''");
    expect(css).toContain('body.bp-mission-finished #red-alert.visible{display:none!important;animation:none!important}');
  });

  it('displays the laptop controls directly without a separate traffic panel or E interaction', () => {
    expect(game).toContain("if(game&&!game.ended)bpPaintTerminal()");
    expect(game).toContain("function bpCanUseTerminal()");
    expect(game).toContain("const index=bpTerminalActionAt(event.clientX,event.clientY)");
    expect(game).toContain("if(index>=0){bpTerminalSelect(index);return;}");
    expect(game).toContain("function bpDrawStandbyScreen(ctx,texture)");
    expect(game).not.toContain("NETWORK ACTIVITY");
    expect(game).not.toContain("bpDrawScreen(bpDisplayContext");
    expect(game).toContain("const liveMission=bp.active&&!g.ended");
  });

  it('supports an extended first-person mission with independent patrols', () => {
    expect(game).toContain('const GAME_SECONDS=720;');
    expect(game).toContain('function bpOpenTerminal()');
    expect(game).toContain("e.code==='KeyE'");
    expect(game).toContain('function bpWalkable(x,z)');
    expect(game).toContain('const bpFanRotors=[]');
    expect(game).toContain('function bpMoveGuard(p,dt,g)');
    expect(game).toContain('function bpAssignSecurityDispatch(g)');
    expect(game).toContain("p.state='switching'");
    expect(game).toContain("p.role==='search'");
    expect(game).toContain("bpHackerState=chooseHackerPhase({");
    expect(game).toContain("phase:'working',guardVisible:visible,nearbyGuard:true");
    expect(game).toContain("phase:'escaping',guardVisible:false,nearbyGuard:false");
    expect(game).toContain("if(bpHackerState==='escaping')");
    expect(game).toContain('function bpGuardRoute(from,to)');
    expect(game).toContain('function bpGuardWalkable(x,z)');
    expect(game).toContain('function bpRecoverGuard(p,g)');
    expect(game).toContain('p.stalledFor=(p.stalledFor||0)+dt');
    expect(game).toContain('if(p.stalledFor>1.15)bpRecoverGuard(p,g)');
    expect(game).toContain('moveGuardWithAvoidance(');
    expect(game).toContain('bpFollowHackerRoute(dt,4.15)');
    expect(game).toContain('bpFollowHackerRoute(dt,2.85)');
    expect(game).toContain('bpFollowHackerRoute(dt,3.0)');
    expect(game).toContain('Math.pow(saturation-1,1.14)*2.9');
    expect(game).toContain("p.state='chasing'");
    expect(game).toContain('p.repathAt=g.elapsed+');
    expect(game).toContain("p.path=bpGuardRoute(p.agent.position,destination)");
    expect(game).toContain("const slot=formationPosition(p.lastSeen,attacker.rotation.y,p.approachIndex??0)");
    expect(game).toContain("function bpHackerThreats()");
    expect(game).toContain("const clear=hackerAreaIsClear(guardPositions,bp.player,attacker.position,bpWorkPosition)");
    expect(game).toContain("bpHackerSafeSince+2.5");
    expect(game).toContain("bpPlanHackerReturn()");
    expect(game).toContain("const bpWorkPosition=V(-8.5,0,4.18)");
    expect(game).toContain("bpHackerHoldUntil=g.elapsed+3+bpRandom(g)*2");
    expect(game).not.toContain("const safe=!guardsInHall&&!playerClose");
    expect(game).toContain("function bpPlanHackerCover(g)");
    expect(game).toContain("const points=rankedCoverSpots(");
    expect(game).toContain("function bpFollowHackerRoute(dt,speed)");
    expect(game).toContain("function bpPaintOfficeMonitor()");
    expect(game).toContain("ctx.fillText('ESTIMATED NETWORK THROUGHPUT',35,127)");
    expect(game).toContain("ctx.fillText(formatBandwidth(bits),35,177)");
    expect(game).not.toContain("bpDrawScreen(bpDisplayContext");
    expect(game).not.toContain("NETWORK ACTIVITY");
    expect(game).toContain("if(game&&!game.ended)bpPaintTerminal()");
    expect(game).toContain("const hovered=bpTerminalActionAt(e.clientX,e.clientY)");
    expect(game).toContain("function bpCanUseTerminal()");
    expect(game).toContain("const index=bpTerminalActionAt(event.clientX,event.clientY)");
    expect(game).toContain("if(index>=0){bpTerminalSelect(index);return;}");
    expect(game).toContain("bpTerminalRaycaster.intersectObject(mesh,false)");
    expect(game).toContain("function bpDrawStandbyScreen(ctx,texture)");
    expect(game).toContain("const locked=document.pointerLockElement===renderer.domElement&&!bp.terminal");
    expect(game).toContain("if(!bpCanUseTerminal())return;");
    expect(game).toContain("connected:game.mode!=='attack'||!bpAttackLaptopCarried");
    expect(game).toContain("bytesPerRequest:game.requestFeed?.averageBytesPerRequest");
    expect(game).toContain("bitsPerSecond:estimatedBitsPerSecond(game.traffic");
    expect(game).toContain("const bpSearchWindowSeconds=24");
    expect(game).toContain("const bpMaxChaseSeconds=8");
    expect(game).not.toContain('const bpDispatchRestSeconds=100');
    expect(game).toContain("bpLaptopRig.visible=!(game?.mode==='attack'&&bpAttackLaptopCarried&&!bp.third)");
    expect(game).toContain("bp.player.copy(mode==='attack'?V(-8.3,0,6.15):V(23.0,0,-3.55))");
    expect(game).toContain('const bpOfficeConsoleX=23.15');
    expect(game).not.toContain("bpHackerState==='fleeing'");
    expect(game).not.toContain('const bpHackerEscape=[');
    expect(game).toContain('bpGuardCanSee(p.agent,attacker.position,13)');
    expect(game).toContain("p.state='returning'");
    expect(game).toContain("p.state='idle'");
    expect(game).toContain('const bpWorkPosition=V(-8.5,0,4.18)');
    expect(game).toContain("endGame(false,'CAUGHT BY SECURITY'");
    expect(game).toContain('new THREE.PerspectiveCamera(84, 1, .07, 120)');
    expect(game).toContain('if(!bp.active || !game || game.ended){');
    expect(game).not.toContain('if(!bp.active || !game || game.ended || bp.terminal){');
    expect(game).toContain("if(game || $('home').hidden || $('home').classList.contains('hidden'))return;");
    expect(game).toContain('if(game&&!game.ended)return;');
    expect(game).toContain("if(mode!=='attack'&&mode!=='defend')return;");
    expect(game).toContain("$('home').hidden=true;$('home').inert=true;");
    expect(game).toContain("$('home').hidden=false;$('home').inert=false;");
    expect(game).toContain('const bpLaptopRig=new THREE.Group()');
    expect(game).toContain('function bpToggleAttackLaptop()');
    expect(game).toContain("e.code==='KeyF'");
    expect(game).toContain("bpHackerState='packing'");
    expect(game).toContain("if(bpHackerState==='escaping')");
    expect(game).toContain("const courtroom=new THREE.Group()");
    expect(game).toContain("g.courtPhase='hearing'");
    expect(game).toContain("g.courtPhase='detention'");
    expect(game).toContain('const bpJudge=character(');
    expect(game).toContain("focus('courtroom')");
    expect(game).toContain('function bpGuardRoute(from,to)');
    expect(game).toContain('bpRandomSearchTarget(g)');
    expect(game).toContain("box(23,-.19,0,17,.35,24,concrete)");
    expect(game).toContain('function bpPowerProxy(index)');
    expect(game).toContain("function bpDisableProxy(index,who='intruder')");
    expect(game).toContain('function bpNearbyProxy(position,range=2.55,poweredOnly=false)');
    expect(game).toContain("game.proxySabotage={index:proxyIndex,until:game.elapsed+2.2}");
    expect(game).toContain("bpDisableProxy(task.index,'intruder')");
    expect(game).toContain("if(game.mode==='defend'&&!proxy.userData.powered)");
    expect(game).toContain('function bpPlanHackerProxySabotage(g)');
    expect(game).toContain("bpHackerState='sabotaging'");
    expect(game).toContain("bpDisableProxy(bpHackerTargetProxy,'the hooded suspect')");
    expect(game).toContain("const targetRps=(750+g.bots*185+(g.burst>0?14500:0))*ATTACK_TRAFFIC_SCALE");
    expect(game).toContain("const targetRps=(3800+g.bots*118+(g.attackerWave>0?4700:0))*DEFENSE_WAVE_SCALE");
    expect(game).toContain("p.state=p.path.length?'coolingTravel':'returning'");
    expect(game).toContain("p.state='coolingFix'");
    expect(game).toContain("function bpTriggerCoolingIssue(g)");
    expect(game).toContain("bpTriggerCoolingIssue(g)");
    expect(game).toContain("COOLING RESTORED / OFFICER COMPLETED REPAIR");
    expect(game).toContain("bpCoolingIndicator.material=red");
    expect(game).toContain('game.proxies=poweredProxyCount(proxyObjects)');
    expect(game).toContain('bpGuardSetReturn(p)');
    expect(game).not.toContain('DEFENDERS ARE DEPLOYING PROXY SERVERS');
    expect(game).toContain('function bpTerminalActionAt(x,y)');
    expect(game).toContain('bpTerminalRaycaster.intersectObject(mesh,false)');
    expect(game).toContain('function bpGuardCanSee(');
    expect(game).toContain('function bpWorldEvents()');
    expect(game).toContain("if(bp?.active)return;");
  });

  it('has a wall-mounted live graph and an adaptive graphics setting', () => {
    expect(game).toContain('function bpWallGraph(t)');
    expect(game).toContain('const bpWallHistory=[]');
    expect(game).toContain('const bpWallDisplay=new THREE.Mesh(');
    expect(game).toContain('const latest=(g?.requestFeed?.recent??[]).slice(-3).reverse();');
    expect(game).toContain('bpSmoothedRpm');
    expect(game).toContain('bpFanBlurMaterial.opacity');
    expect(game).toContain('const bpCourtDetail=new THREE.Group()');
    expect(game).toContain('const bpRackDetail=new THREE.Group()');
    expect(game).toContain('new THREE.InstancedMesh(');
    expect(game).toContain('bpRackDetail.visible=!lowQuality');
    expect(game).toContain("ctx.setTransform(1,0,0,1,0,0)");
    expect(game).toContain('this.fanWhine.frequency.setTargetAtTime');
    expect(game).toContain("box(-10.55,2.20,2.2,1.65,4.35,1.88,darkMetal)");
    expect(html).toContain('bp-skeleton-main');
    expect(html).not.toContain('INITIALIZING 3D ENVIRONMENT');
    expect(html).not.toContain('id="feed"');
    expect(game).toContain("const gpuCores=Number(navigator.hardwareConcurrency)||4");
    expect(html).toContain('id="quality"');
    expect(html).not.toContain('FICTIONAL NETWORK SIMULATION');
  });
});
