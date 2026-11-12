import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const game = readFileSync(new URL('../src/blackout/game.ts', import.meta.url), 'utf8');
const html = readFileSync(new URL('../blackout-protocol/index.html', import.meta.url), 'utf8');
const vite = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');

describe('Blackout Protocol 3D', () => {
  it('parses the TypeScript game module as JavaScript and bundles the graphics engine locally', () => {
    expect(game).toContain("import * as THREE from 'three'");
    expect(game).toContain("import { createTrafficFeed } from './traffic-model'");
    expect(game).toContain("import { isSightBlocked, chooseHackerPhase } from './stealth-logic'");
    expect(game).toContain("import { drawTerminalScreen, terminalHitTest } from './terminal-screen'");
    expect(() => new Function(game
      .replace("import * as THREE from 'three';", 'const THREE = {};')
      .replace("import { createTrafficFeed } from './traffic-model';", 'const createTrafficFeed = () => ({});')
      .replace("import { drawTerminalScreen, terminalHitTest } from './terminal-screen';", 'const drawTerminalScreen = () => {}; const terminalHitTest = () => -1;')
      .replace("import { isSightBlocked, chooseHackerPhase } from './stealth-logic';", 'const isSightBlocked = () => false; const chooseHackerPhase = () => "working";'))).not.toThrow();
    expect(vite).toContain("blackout: resolve(process.cwd(), 'blackout-protocol/index.html')");
    expect(html).toContain('src="/src/blackout/game.ts"');
    expect(html).toContain('src="/pico-logo.svg"');
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
    expect(game).toContain("bpHackerState=chooseHackerPhase({phase:'working'");
    expect(game).toContain("bpHackerState=chooseHackerPhase({phase:'escaping'");
    expect(game).toContain("if(bpHackerState==='escaping')");
    expect(game).not.toContain("bpHackerState==='fleeing'");
    expect(game).toContain('const bpHackerEscape=[');
    expect(game).toContain('bpGuardCanSee(p.agent,attacker.position,10)');
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
    expect(game).toContain('const bpOfficePassage=');
    expect(game).toContain("box(23,-.19,0,17,.35,24,concrete)");
    expect(game).toContain('function bpPowerProxy(index)');
    expect(game).toContain("g.proxies++");
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
