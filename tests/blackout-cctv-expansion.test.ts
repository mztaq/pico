import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const game=readFileSync(new URL('../src/blackout/game.ts',import.meta.url),'utf8');
const nav=readFileSync(new URL('../src/blackout/navigation.ts',import.meta.url),'utf8');

describe('Live in-world CCTV system and expanded data center',()=>{
  it('includes four true 3D cameras with distinct observation locations',()=>{
    expect(game).toContain("const bpCctvModels=[");
    for(const id of ['CAM 01','CAM 02','CAM 03','CAM 04'])
      expect(game).toContain(id);
    expect(game).toContain('new THREE.PerspectiveCamera(69,16/9,.1,110)');
    expect(game).toContain('new THREE.WebGLRenderTarget(');
    expect(game).toContain('renderer.render(scene,feed.cam)');
    expect(game).toContain('renderer.setRenderTarget(original)');
  });
  it('updates CCTV incrementally and avoids recursive CCTV reflections',()=>{
    expect(game).toContain('if(bpCctvTick<(lowQuality?.31:.055))return');
    expect(game).toContain('for(const plane of bpCctvPlanes)plane.visible=false');
    expect(game).toContain('for(const plane of bpCctvPlanes)plane.visible=true');
    expect(game).toContain('target.setSize(lowQuality?256:448,lowQuality?144:252)');
  });
  it('adds west hall equipment without losing full navigation coverage',()=>{
    expect(game).toContain('[-37,-8],[-37,-3],[-37,3],[-37,8]');
    expect(game).toContain('if(x < -44.2 || x > 31.1');
    expect(nav).toContain('minX:-44.3,maxX:31');
    expect(game).toContain("label('WEST SERVER HALL / COLD AISLE'");
  });
  it('shows simulated request packets and keeps the traffic clock ahead of NPC updates',()=>{
    expect(game).toContain('function bpAnimateRequestPackets(t)');
    expect(game).toContain('const count=active?Math.min(lowQuality?28:70');
    expect(game).toContain('const p=packets[i];p.visible=i<count');
    expect(game).toContain('p.position.copy(requestCurve.getPointAt(progress))');
    expect(game).not.toContain('const p=packets[i];p.visible=false;');
    expect(game).toContain('try{bpAnimateRequestPackets(visualTime);}');
    const firstNetworkTick=game.indexOf('bpOriginalStep(dt);',game.indexOf('stepGame=function(dt)'));
    const firstNpcTick=game.indexOf('bpNpcUpdate(dt);',game.indexOf('stepGame=function(dt)'));
    expect(firstNetworkTick).toBeGreaterThan(0);
    expect(firstNetworkTick).toBeLessThan(firstNpcTick);
  });
  it('spins every built fan at idle and isolates cooling animation from display updates',()=>{
    expect(game).toContain('let bpSmoothedRpm=850');
    expect(game).toContain('function bpAnimateFans(dt)');
    expect(game).toContain('const targetRpm=850+(g?.fanLoad||0)');
    expect(game).toContain('for(const rotor of bpFanRotors)rotor.rotation.z+=visibleRps*Math.PI*2*dt');
    expect(game).toContain('bpFanRotors[i].visible=true');
    expect(game).toContain('try{bpAnimateFans(dt);}');
    expect(game.indexOf('try{bpAnimateFans(dt);}')).toBeLessThan(game.indexOf('try{animateScene(visualTime,dt);}'));
  });
  it('starts fan motors at normal idle levels and only ramps after response',()=>{
    expect(game).toContain('this.fan.gain.value=.038');
    expect(game).toContain('this.vent.gain.value=.026');
    expect(game).toContain('const fanSurge=g.securityDispatchActive &&');
    expect(game).toContain('g.fanLoad+=(Number(fanSurge)-g.fanLoad)');
    expect(game).toContain('const GAME_SECONDS=1080');
  });
});
