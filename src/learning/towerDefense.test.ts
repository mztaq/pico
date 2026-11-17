import { describe, expect, it } from 'vitest';
import {
  DEFENSE_COLS, DEFENSE_ROWS, DEFENSE_PATH, TOWERS, activateFirewall, FIREWALL_COST,
  advanceDefense, defenseStart,
  defenseScore, enemyXY, pathCell, placeTower, upgradeCost, upgradeTower, validPlot,
} from './towerDefense';

describe('Pico Defender: real tower defense rules', () => {
  it('has a contiguous winding route and never allows building on it or outside the map', () => {
    const seen = new Set<string>();
    for (let i=0;i<DEFENSE_PATH.length;i++) {
      const [x,y] = DEFENSE_PATH[i]!;
      expect(x).toBeGreaterThanOrEqual(0);expect(x).toBeLessThan(DEFENSE_COLS);
      expect(y).toBeGreaterThanOrEqual(0);expect(y).toBeLessThan(DEFENSE_ROWS);
      expect(pathCell(x,y)).toBe(true);
      expect(validPlot(x,y)).toBe(false);
      if(i>0){
        const [previousX,previousY]=DEFENSE_PATH[i-1]!;
        expect(Math.abs(x-previousX)+Math.abs(y-previousY)).toBe(1);
      }
      seen.add(x+','+y);
    }
    expect(seen.size).toBe(DEFENSE_PATH.length);
    expect(validPlot(-1,2)).toBe(false);
    expect(validPlot(3,0)).toBe(true);
    expect(enemyXY(0).x).toBeCloseTo(.5);
  });

  it('builds and upgrades towers only on available plots', () => {
    const start=defenseStart(0);
    expect(placeTower(start,0,3,'blaster')).toBeNull();
    expect(placeTower(start,-1,1,'blaster')).toBeNull();
    const move=placeTower(start,3,2,'blaster');
    expect(move?.cost).toBe(TOWERS.blaster.cost);
    expect(start.towers).toHaveLength(0);
    expect(move?.state.towers).toHaveLength(1);
    expect(placeTower(move!.state,3,2,'frost')).toBeNull();
    const upgrade=upgradeTower(move!.state,3,2);
    expect(upgrade?.cost).toBe(95);
    expect(upgrade?.state.towers[0]?.level).toBe(2);
    expect(move?.state.towers[0]?.level).toBe(1);
    const third=upgradeTower(upgrade!.state,3,2);
    expect(third?.state.towers[0]?.level).toBe(3);
    expect(upgradeCost(third!.state.towers[0]!)).toBeNull();
    expect(upgradeTower(third!.state,3,2)).toBeNull();
  });

  it('spawns moving enemies in waves and damages the core when they escape', () => {
    const empty=defenseStart(0);
    const first=advanceDefense(empty,15_000);
    expect(first.enemies.length+first.escaped).toBeGreaterThan(0);
    expect(first.enemies.some(enemy=>enemy.progress>0)).toBe(true);
    let extended=first;
    for(let t=30_000;t<=120_000;t+=15_000)extended=advanceDefense(extended,t);
    expect(extended.escaped).toBeGreaterThan(0);
    expect(extended.health).toBeLessThan(100);
    expect(extended.health).toBeGreaterThanOrEqual(0);
  });

  it('real towers independently target and destroy enemies, awarding score', () => {
    let defended=defenseStart(0);
    for(const [x,y,kind] of [
      [3,2,'blaster'], [4,2,'blaster'], [6,3,'frost'], [7,3,'pulse'], [9,5,'blaster'],
    ] as const) {
      const move=placeTower(defended,x,y,kind);
      expect(move).not.toBeNull();
      defended=move!.state;
    }
    defended=advanceDefense(defended,55_000);
    expect(defended.kills).toBeGreaterThan(0);
    expect(defended.towers.some(tower=>tower.lastShotAt>0)).toBe(true);
    expect(defenseScore(defended)).toBeGreaterThan(0);
    expect(defended.health).toBeGreaterThanOrEqual(0);
  });

  it('gives Hacker Heist a real, paid firewall slowdown with a cooldown', () => {
    const beginning=defenseStart(0,'hacker');
    expect(activateFirewall(defenseStart(0,'circuit'),5000)).toBeNull();
    const protectedRun=activateFirewall(beginning,5000);
    expect(protectedRun?.cost).toBe(FIREWALL_COST);
    expect(protectedRun?.state.firewallUntil).toBe(12_000);
    expect(protectedRun?.state.firewallReadyAt).toBe(32_000);
    expect(activateFirewall(protectedRun!.state,12_001)).toBeNull();
    expect(activateFirewall(protectedRun!.state,32_000)).not.toBeNull();

    // Starting from identical state, a protected wave should progress less.
    let ordinary=defenseStart(0,'hacker');
    let shielded=activateFirewall(ordinary,5000)!.state;
    ordinary=advanceDefense(ordinary,11_000);
    shielded=advanceDefense(shielded,11_000);
    expect(shielded.enemies[0]?.progress).toBeLessThan(ordinary.enemies[0]!.progress);
  });

  it('advances deterministically with the same inputs, without hidden mutation', () => {
    const start=placeTower(defenseStart(0),4,2,'frost')!.state;
    const once=advanceDefense(start,32_000);
    const again=advanceDefense(start,32_000);
    expect(once).toEqual(again);
    expect(start.enemies).toHaveLength(0);
    const later=advanceDefense(once,42_000);
    expect(later.lastTickAt).toBe(42_000);
    expect(once.lastTickAt).toBe(32_000);
  });
});
