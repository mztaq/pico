import { describe, expect, it } from 'vitest';
import {
  attackDuration, attackMove, attackReward, attackTick, availablePerks,
  defenseReward, defenseShop, defenseTick, freshAttack, freshDefense, missions, price, rebirth, serviceRate,
  shieldedLane, startAttack, startDefense, switchBackup, waves,
} from './game-engine';

describe('Server Siege', () => {
  it('can clear the campaign with basic controls and can rebirth', () => {
    let profile = freshAttack();
    for (const [mission] of missions.entries()) {
      let round = startAttack(mission, profile);
      for (let tick = 0; tick < attackDuration && round.status === 'live'; tick++) {
        const lane = (shieldedLane(round) + 1) % 3;
        round = attackMove(round, profile, 'burst', lane);
        round = attackMove(round, profile, 'pulse', lane);
        round = attackTick(round, profile);
      }
      expect(round.status).toBe('won');
      profile = attackReward(round, profile);
    }
    expect(profile.cleared).toBe(missions.length);
    expect(profile.coins).toBeGreaterThan(100);
    const reset = rebirth(profile);
    expect(reset.coins).toBe(0);
    expect(reset.cleared).toBe(0);
    expect(availablePerks(reset)).toBe(1);
  });

  it('enforces cooldowns and times out idle runs', () => {
    const profile = freshAttack();
    const initial = startAttack(0, profile);
    const fired = attackMove(initial, profile, 'burst', 0);
    expect(attackMove(fired, profile, 'burst', 0)).toBe(fired);
    let idle = initial;
    for (let tick = 0; tick < attackDuration; tick++) idle = attackTick(idle, profile);
    expect(idle.status).toBe('lost');
    expect(attackTick(idle, profile)).toBe(idle);
  });
});

describe('Server Defense', () => {
  it('can clear every campaign wave on earned budget and set an Endless record', () => {
    let profile = freshDefense();
    const build = ['proxy', 'proxy', null, 'proxy', 'capacity', 'capacity', 'filter', 'capacity', 'filter'] as const;
    for (const [wave, key] of build.entries()) {
      if (key) {
        const level = profile.upgrades[key];
        const cost = price(defenseShop[key].cost, level);
        expect(profile.budget).toBeGreaterThanOrEqual(cost);
        profile = { ...profile, budget: profile.budget - cost,
          upgrades: { ...profile.upgrades, [key]: level + 1 } };
      }
      const endless = wave === waves.length;
      let round = startDefense(endless ? 0 : wave, endless, profile);
      while (round.status === 'live') round = defenseTick(round, profile);
      expect(round.status).toBe('won');
      expect(serviceRate(round)).toBeGreaterThanOrEqual(78);
      profile = defenseReward(round, profile);
    }
    expect(profile.cleared).toBe(waves.length);
    expect(profile.best).toBe(1);
  });

  it('makes strict filtering costly and consumes a backup on failover', () => {
    const profile = freshDefense();
    const initial = startDefense(0, false, profile);
    let strict = { ...initial, policy: 'Strict' as const };
    let round = defenseTick(strict, profile);
    while (round.status === 'live') round = defenseTick(round, profile);
    expect(round.status).toBe('lost');
    expect(serviceRate(round)).toBeLessThan(78);
    strict = { ...strict, backups: 1, integrity: 65 };
    expect(switchBackup(strict)).toMatchObject({ backups: 0, integrity: 100 });
  });
});
