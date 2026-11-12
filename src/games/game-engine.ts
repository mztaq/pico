export const lanes = ['North', 'Central', 'South'] as const;
export const missions = [
  { name: 'Corner Shop', detail: 'A single rack with a narrow uplink.' },
  { name: 'Relay Station', detail: 'A proxy soaks up traffic in the busiest lane.' },
  { name: 'Cloud District', detail: 'A load balancer shifts protection between lanes.' },
  { name: 'Mirror Vault', detail: 'Backup racks keep the service alive longer.' },
  { name: 'Storm Core', detail: 'Shielded lanes rotate and the core repairs itself.' },
] as const;
export const waves = [
  'The First Flood', 'Proxy Pressure', 'Camouflage', 'Rush Hour',
  'Rolling Bursts', 'Switchback', 'Triple Threat', 'The Botnet King',
] as const;

export const attackShop = {
  bots: { name: 'Bot squad', info: 'Every pulse hits harder.', cost: 25 },
  battery: { name: 'Battery', info: 'Start with more energy and recharge faster.', cost: 20 },
  cooling: { name: 'Cooling', info: 'Burst and Split recharge faster.', cost: 30 },
  slot: { name: 'Burst module', info: 'Burst becomes stronger on every upgrade.', cost: 35 },
} as const;
export const defenseShop = {
  proxy: { name: 'Reverse proxies', info: 'Intercept bot traffic before it reaches the racks.', cost: 18, max: 4 },
  filter: { name: 'Traffic filters', info: 'Catch more bots, especially with Strict filtering.', cost: 15, max: 4 },
  balance: { name: 'Load balancer', info: 'Reduce the cost of traffic concentrated in one lane.', cost: 16, max: 3 },
  capacity: { name: 'Server racks', info: 'Handle more requests per second.', cost: 20, max: 5 },
  backup: { name: 'Backup server', info: 'Switch over during a wave to restore health.', cost: 22, max: 3 },
} as const;

export type AttackUpgrade = keyof typeof attackShop;
export type DefenseUpgrade = keyof typeof defenseShop;
export type Profile = {
  coins: number;
  cleared: number;
  rebirths: number;
  perks: { power: number; energy: number };
  upgrades: Record<AttackUpgrade, number>;
};
export type DefenseProfile = {
  budget: number;
  cleared: number;
  best: number;
  upgrades: Record<DefenseUpgrade, number>;
};
export const freshAttack = (): Profile => ({
  coins: 0, cleared: 0, rebirths: 0, perks: { power: 0, energy: 0 },
  upgrades: { bots: 0, battery: 0, cooling: 0, slot: 0 },
});
export const freshDefense = (): DefenseProfile => ({
  budget: 34, cleared: 0, best: 0,
  upgrades: { proxy: 0, filter: 0, balance: 0, capacity: 0, backup: 0 },
});
export const price = (base: number, level: number) => base + 12 * level;
export const attackLimit = 4;
export const availablePerks = (p: Profile) => p.rebirths - p.perks.power - p.perks.energy;
export function rebirth(p: Profile): Profile {
  return p.cleared === missions.length
    ? { ...freshAttack(), rebirths: p.rebirths + 1, perks: p.perks }
    : p;
}
export type Move = 'pulse' | 'burst' | 'split';
export const moves: Record<Move, { name: string; energy: number }> = {
  pulse: { name: 'Pulse', energy: 7 },
  burst: { name: 'Burst', energy: 23 },
  split: { name: 'Split', energy: 16 },
};
type Status = 'live' | 'won' | 'lost';
export type Attack = {
  mission: number; seconds: number; energy: number; integrity: number; offline: number;
  cooldowns: Record<Move, number>; traffic: number[]; status: Status;
};
export const maxEnergy = (p: Profile) => 100 + p.upgrades.battery * 15 + p.perks.energy * 8;
export function startAttack(mission: number, p: Profile): Attack {
  return {
    mission, seconds: 0, energy: maxEnergy(p), integrity: 100, offline: 0,
    cooldowns: { pulse: 0, burst: 0, split: 0 }, traffic: [0, 0, 0], status: 'live',
  };
}
export const attackDuration = 24;
export function shieldedLane(a: Attack) {
  if (a.mission === 0) return -1;
  if (a.mission === 1) return 1;
  return (Math.floor(a.seconds / 3) + a.mission) % lanes.length;
}
export function attackMove(a: Attack, p: Profile, move: Move, lane: number): Attack {
  const cost = moves[move].energy;
  if (a.status !== 'live' || a.energy < cost || a.cooldowns[move] > 0) return a;
  const shield = shieldedLane(a);
  const power = 1 + 0.16 * p.upgrades.bots + 0.06 * p.perks.power;
  const resistance = 1 + a.mission * 0.15 + p.rebirths * 0.12;
  const traffic = lanes.map((_, i) => move === 'split' ? 8 : i === lane
    ? (move === 'burst' ? 31 + 4 * p.upgrades.slot : 13) : 0);
  const damage = traffic.reduce((total, force, i) => total + force * (i === shield ? 0.25 : 1), 0);
  const integrity = Math.max(0, a.integrity - damage * power / resistance);
  return {
    ...a, energy: a.energy - cost, integrity,
    cooldowns: { ...a.cooldowns, [move]: move === 'pulse' ? 1 : Math.max(2, (move === 'burst' ? 5 : 4) - p.upgrades.cooling) },
    traffic,
  };
}
export function attackTick(a: Attack, p: Profile): Attack {
  if (a.status !== 'live') return a;
  const seconds = a.seconds + 1;
  const offline = a.integrity === 0 ? a.offline + 1 : 0;
  const status = offline >= 3 ? 'won' : seconds >= attackDuration ? 'lost' : 'live';
  return {
    ...a, seconds, status, offline,
    integrity: a.integrity === 0 ? 0 : Math.min(100, a.integrity + (a.mission >= 3 ? 2 : 0)),
    energy: Math.min(maxEnergy(p), a.energy + 8 + p.upgrades.battery * 2),
    cooldowns: {
      pulse: Math.max(0, a.cooldowns.pulse - 1),
      burst: Math.max(0, a.cooldowns.burst - 1),
      split: Math.max(0, a.cooldowns.split - 1),
    },
    traffic: a.traffic.map(force => force * 0.36),
  };
}
export function attackReward(a: Attack, p: Profile): Profile {
  return {
    ...p, cleared: Math.max(p.cleared, a.mission + 1),
    coins: p.coins + 24 + a.mission * 9 + (a.seconds <= 12 ? 12 : 0),
  };
}

export type Policy = 'Open' | 'Balanced' | 'Strict';
export const policies: Policy[] = ['Open', 'Balanced', 'Strict'];
export type Defense = {
  wave: number; endless: boolean; seconds: number; integrity: number; served: number;
  visitors: number; traffic: number[]; proxyLoad: number; latency: number;
  route: number; policy: Policy; backups: number; status: Status;
};
export const waveDuration = 15;
export const startDefense = (wave: number, endless: boolean, p: DefenseProfile): Defense => ({
  wave, endless, seconds: 0, integrity: 100, served: 0, visitors: 0,
  traffic: [0, 0, 0], proxyLoad: 0, latency: 0,
  route: 1, policy: 'Balanced', backups: p.upgrades.backup, status: 'live',
});
export const serviceRate = (d: Defense) => d.visitors ? Math.round(100 * d.served / d.visitors) : 100;
export function switchBackup(d: Defense): Defense {
  return d.status === 'live' && d.backups > 0 && d.integrity < 100
    ? { ...d, backups: d.backups - 1, integrity: Math.min(100, d.integrity + 36) }
    : d;
}
export function defenseTick(d: Defense, p: DefenseProfile): Defense {
  if (d.status !== 'live') return d;
  const seconds = d.seconds + 1;
  const level = d.wave + (d.endless ? waves.length : 0);
  const burstLane = (Math.floor(seconds / 3) + level) % lanes.length;
  const force = 17 + level * 6;
  const traffic = lanes.map((_, i) => force * (i === burstLane ? 1.65 : level >= 6 ? 0.85 : 0.45));
  const totalBots = traffic.reduce((total, bots) => total + bots, 0);
  const { proxy, filter, balance, capacity } = p.upgrades;
  const routedBots = traffic[d.route];
  const inspect = d.policy === 'Strict' ? 0.49 : d.policy === 'Balanced' ? 0.25 : 0.04;
  const passedBots = totalBots * (1 - inspect - filter * 0.08);
  const proxyRemoved = Math.min(passedBots, proxy * (15 + 13 * routedBots / totalBots));
  const remaining = passedBots - proxyRemoved;
  const concentration = Math.max(...traffic) / totalBots;
  const burden = remaining * (1 + Math.max(0, concentration - 0.35 - balance * 0.13));
  const visitors = 32 + Math.min(level, 25) * 2 + (level >= 3 && seconds % 5 < 2 ? 13 : 0);
  const allowed = visitors * (d.policy === 'Strict' ? 0.71 : d.policy === 'Balanced' ? 0.97 : 1);
  const rackCapacity = 69 + capacity * 23;
  const load = (burden + allowed) / rackCapacity;
  const served = d.served + allowed / Math.max(1, load);
  const allVisitors = d.visitors + visitors;
  const integrity = Math.max(0, d.integrity - Math.max(0, load - 1) * 16);
  const status = integrity <= 0 ? 'lost' : seconds < waveDuration ? 'live'
    : served / allVisitors >= 0.78 ? 'won' : 'lost';
  return {
    ...d, seconds, integrity, served, visitors: allVisitors, traffic, status,
    proxyLoad: proxy ? Math.round(100 * passedBots / (proxy * 35)) : 0,
    latency: Math.round(15 + Math.max(0, load - 0.55) * 115),
  };
}
export function defenseReward(d: Defense, p: DefenseProfile): DefenseProfile {
  return {
    ...p, budget: p.budget + 18 + (serviceRate(d) >= 92 ? 7 : 0),
    cleared: d.endless ? p.cleared : Math.max(p.cleared, d.wave + 1),
    best: d.endless ? Math.max(p.best, d.wave + 1) : p.best,
  };
}
