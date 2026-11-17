import { DurableObject } from 'cloudflare:workers';
import {
  ARENA_TILES, arenaPool, arenaUnits, answerReward, nodeCost,
  questionAt, scoreFor, visibleQuestion,
} from '../../../src/learning/arenaRules.ts';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const modes = ['classic', 'circuit', 'hacker', 'sprint'];
const nameStyles = ['generated', 'custom'];
const adjectives = ['Beardly', 'Hot', 'Cyber', 'Swift', 'Neon', 'Pixel', 'Cosmic', 'Mighty', 'Chill', 'Turbo', 'Golden', 'Secret', 'Electric', 'Nifty', 'Lucky', 'Epic'];
const animals = ['Wolf', 'Monkey', 'Tiger', 'Falcon', 'Panda', 'Otter', 'Fox', 'Shark', 'Koala', 'Owl', 'Lynx', 'Bear', 'Raven', 'Cobra', 'Gecko', 'Eagle'];
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });
const fail = (status, error) => reply({ error }, status);
const now = () => Date.now();
const key = (length) => [...crypto.getRandomValues(new Uint8Array(length))].map(n => alphabet[n % alphabet.length]).join('');
const secret = () => [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
const random = (max) => crypto.getRandomValues(new Uint32Array(1))[0] % max;
async function sha(raw) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
}
function roomExpired(room) { return !room || now() >= room.expiresAt; }
function roundState(room) {
  if (room.state === 'playing' && now() >= room.startsAt + room.duration * 1000) return 'finished';
  return room.state;
}
async function parseBody(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return null;
  const raw = await request.text();
  if (raw.length > 35000) return null;
  try {
    const body = JSON.parse(raw);
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch { return null; }
}
function questionsValid(values) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 30) return false;
  return values.every((value) => (
    typeof value === 'object' && value !== null &&
    typeof value.prompt === 'string' && value.prompt.trim().length >= 8 && value.prompt.length <= 240 &&
    Array.isArray(value.choices) && value.choices.length === 4 &&
    value.choices.every(option => typeof option === 'string' && option.trim().length >= 1 && option.length <= 120) &&
    Number.isInteger(value.answer) && value.answer >= 0 && value.answer < 4 &&
    (value.explanation === undefined || (typeof value.explanation === 'string' && value.explanation.length <= 350))
  ));
}
function settingsValid(value) {
  if (!value || typeof value !== 'object') return false;
  if (!modes.includes(value.mode) || !nameStyles.includes(value.nicknameMode)) return false;
  if (!Number.isInteger(value.minPlayers) || value.minPlayers < 1 || value.minPlayers > 30) return false;
  if (!Number.isInteger(value.maxPlayers) || value.maxPlayers < value.minPlayers || value.maxPlayers > 30) return false;
  if (![90, 180, 300, 480].includes(value.duration)) return false;
  if (value.questionSource === 'custom') return questionsValid(value.customQuestions);
  return value.questionSource === 'bank' && arenaUnits.includes(value.unit) && arenaPool(value.unit).length > 0;
}
function sanitizedSettings(value) {
  return {
    mode: value.mode, nicknameMode: value.nicknameMode,
    minPlayers: value.minPlayers, maxPlayers: value.maxPlayers,
    duration: value.duration, questionSource: value.questionSource,
    unit: value.questionSource === 'bank' ? value.unit : 'custom',
  };
}
function poolFor(room) {
  return room.settings.questionSource === 'custom' ? room.customQuestions : arenaPool(room.settings.unit);
}
function currentQuestion(room, player) {
  const list = poolFor(room);
  const question = list[(room.seed + player.cursor * 7) % list.length];
  return question;
}
function projectedQuestion(question) {
  return visibleQuestion(question);
}
function boardScore(player, nodes) {
  const levels = nodes.filter(node => node.ownerId === player.id).map(node => node.level);
  return scoreFor(levels, player.correct, player.amplifier) + player.baseScore;
}
function generatedName(room) {
  const used = new Set([...room.players.values()].map(player => player.nickname.toLowerCase()));
  for (let attempt = 0; attempt < 160; attempt++) {
    const guess = adjectives[random(adjectives.length)] + animals[random(animals.length)];
    if (!used.has(guess.toLowerCase())) return guess;
  }
  for (let i = 1; i < 10000; i++) {
    const guess = 'NeonWolf' + i;
    if (!used.has(guess.toLowerCase())) return guess;
  }
  return null;
}
function activePlayers(room) {
  return [...room.players.values()].map((player, index) => ({
    id: player.id, nickname: player.nickname, charge: player.charge,
    streak: player.streak, amplifier: player.amplifier, correct: player.correct,
    answered: player.answered, score: boardScore(player, room.nodes),
    owned: room.nodes.filter(node => node.ownerId === player.id).length,
    color: index % 8,
  })).sort((a, b) => b.score - a.score || b.correct - a.correct || a.nickname.localeCompare(b.nickname));
}
function bodyRequired(body) { return body && typeof body === 'object' && !Array.isArray(body); }

/**
 * One Durable Object instance holds one live room.
 * It does not call ctx.storage: all match data is memory-only.
 * Eviction/redeployment intentionally ends the session.
 */
export class ArenaRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;
    this.queue = Promise.resolve();
  }
  fetch(request) {
    const next = this.queue.then(() => this.handle(request));
    this.queue = next.then(() => {}, () => {});
    return next;
  }
  async handle(request) {
    const command = new URL(request.url).pathname.split('/').pop();
    if (!['create','join','room','start','answer','action','close'].includes(command)) return fail(404, 'Unknown room action.');
    if (command === 'room' && request.method !== 'GET') return fail(405, 'Use GET.');
    if (command !== 'room' && request.method !== 'POST') return fail(405, 'Use POST.');
    if (command === 'create') {
      if (this.room && !roomExpired(this.room)) return fail(409, 'Room code already in use.');
      const data = await parseBody(request);
      if (!settingsValid(data)) return fail(400, 'Invalid match settings or questions.');
      const config = sanitizedSettings(data);
      const hostToken = secret();
      const code = request.headers.get('X-Arena-Code');
      if (!code || !/^[A-HJ-NP-Z2-9]{6}$/.test(code)) return fail(400, 'Invalid room code.');
      this.room = {
        code, settings: config, customQuestions: data.questionSource === 'custom'
          ? data.customQuestions.map((question, index) => ({
            id: 'custom-' + index, topic: 'custom', prompt: question.prompt.trim(),
            choices: question.choices.map(text => text.trim()), answer: question.answer,
            explanation: (question.explanation || 'Check the correct answer above.').trim(),
          })) : null,
        hostHash: await sha(hostToken),
        seed: random(100000), state: 'lobby', startsAt: null,
        duration: config.duration,
        expiresAt: now() + 2 * 60 * 60 * 1000,
        players: new Map(),
        nodes: Array.from({ length: ARENA_TILES }, (_, pos) => ({ pos, ownerId: null, level: 1 })),
      };
      return reply({ code, token: hostToken }, 201);
    }
    const room = this.room;
    if (roomExpired(room)) { this.room = null; return fail(404, 'Room expired or unavailable.'); }
    const bearer = (request.headers.get('Authorization') || '').match(/^Bearer ([a-f0-9]{64})$/);
    let user = null;
    if (command !== 'join') {
      if (!bearer) return fail(401, 'Missing room session.');
      const hash = await sha(bearer[1]);
      if (hash === room.hostHash) user = { role: 'host', player: null };
      else {
        const player = [...room.players.values()].find(value => value.tokenHash === hash);
        if (player) user = { role: 'player', player };
      }
      if (!user) return fail(401, 'Invalid room session.');
    }
    if (command === 'room') {
      const player = user.player;
      return reply({
        code: room.code, state: roundState(room), role: user.role,
        playerId: player?.id || null,
        mode: room.settings.mode, nicknameMode: room.settings.nicknameMode,
        minPlayers: room.settings.minPlayers, maxPlayers: room.settings.maxPlayers,
        questionSource: room.settings.questionSource, unit: room.settings.unit,
        duration: room.duration, startsAt: room.startsAt,
        expiresAt: room.expiresAt / 1000,
        players: activePlayers(room), nodes: room.nodes,
        question: player && roundState(room) === 'playing'
          ? projectedQuestion(currentQuestion(room, player)) : null,
      });
    }
    const body = await parseBody(request);
    if (!bodyRequired(body) || body.code !== room.code) return fail(400, 'Wrong room code or invalid request.');
    if (command === 'join') {
      if (roundState(room) !== 'lobby') return fail(409, 'The match has started.');
      if (room.players.size >= room.settings.maxPlayers) return fail(409, 'Room is full.');
      let nickname = '';
      if (room.settings.nicknameMode === 'generated') nickname = generatedName(room);
      else {
        if (typeof body.nickname !== 'string') return fail(400, 'Enter a nickname.');
        nickname = body.nickname.trim().replace(/\s+/g, ' ');
        if (!/^[A-Za-z0-9 _-]{2,20}$/.test(nickname)) return fail(400, 'Nickname must contain 2–20 letters, digits, spaces, _ or -.');
        if ([...room.players.values()].some(p => p.nickname.toLowerCase() === nickname.toLowerCase()))
          return fail(409, 'Nickname already in use.');
      }
      if (!nickname) return fail(503, 'No nickname available.');
      const playerToken = secret(), id = crypto.randomUUID();
      room.players.set(id, {
        id, nickname, tokenHash: await sha(playerToken),
        charge: 0, streak: 0, amplifier: 0, correct: 0,
        answered: 0, baseScore: 0, cursor: 0, lastAnswerAt: 0,
      });
      return reply({ code: room.code, token: playerToken, nickname }, 201);
    }
    if (command === 'start') {
      if (user.role !== 'host') return fail(403, 'Only the host can start.');
      if (room.state !== 'lobby') return fail(409, 'Match already started.');
      if (room.players.size < room.settings.minPlayers)
        return fail(409, 'Need at least ' + room.settings.minPlayers + ' players.');
      room.state = 'playing'; room.startsAt = now();
      return reply({ ok: true });
    }
    if (command === 'close') {
      if (user.role !== 'host') return fail(403, 'Only the host can end the match.');
      room.state = 'finished';
      return reply({ ok: true });
    }
    if (roundState(room) !== 'playing') return fail(409, 'Round is not active.');
    if (user.role !== 'player') return fail(403, 'Join as a player.');
    const player = user.player;
    if (command === 'answer') {
      const choice = body.choice;
      if (!Number.isInteger(choice) || choice < 0 || choice > 3) return fail(400, 'Choose an answer.');
      const question = currentQuestion(room, player);
      if (body.questionId !== question.id) return fail(409, 'Question has changed.');
      if (now() - player.lastAnswerAt < 800) return fail(429, 'Wait before answering again.');
      player.lastAnswerAt = now();
      const correct = choice === question.answer;
      const reward = answerReward(correct, player.streak, player.amplifier);
      const points = correct
        ? (room.settings.mode === 'sprint' ? 145 : room.settings.mode === 'classic' ? 100 : 20)
          + Math.min(player.streak, 5) * 10 : 0;
      player.charge += reward.charge;
      player.streak = reward.streak;
      player.correct += reward.correct;
      player.answered++;
      player.cursor++;
      player.baseScore += points;
      return reply({
        correct, earned: reward.charge, points,
        correctChoice: question.answer, explanation: question.explanation,
        nextQuestion: projectedQuestion(currentQuestion(room, player)),
      });
    }
    if (command === 'action') {
      if (room.settings.mode === 'classic' || room.settings.mode === 'sprint') return fail(409, 'This mode uses quiz scoring.');
      const kind = body.kind;
      if (kind === 'amplify') {
        if (player.amplifier >= 3) return fail(409, 'Amplifier at maximum.');
        const cost = 70 + player.amplifier * 45;
        if (player.charge < cost) return fail(409, 'Not enough charge.');
        player.charge -= cost;
        player.amplifier++;
        return reply({ ok: true, cost });
      }
      if (kind !== 'capture' && kind !== 'fortify') return fail(400, 'Invalid action.');
      if (!Number.isInteger(body.pos) || body.pos < 0 || body.pos >= ARENA_TILES) return fail(400, 'Invalid node.');
      const node = room.nodes[body.pos];
      if (kind === 'capture' && node.ownerId === player.id) return fail(409, 'Already yours.');
      if (kind === 'fortify' && node.ownerId !== player.id) return fail(403, 'Own the node first.');
      const cost = nodeCost(kind, node);
      if (cost === null || player.charge < cost) return fail(409, 'Insufficient charge or maxed node.');
      player.charge -= cost;
      node.ownerId = player.id;
      node.level = kind === 'capture' ? 1 : Math.min(3, node.level + 1);
      return reply({ ok: true, cost });
    }
    return fail(404, 'Unknown action.');
  }
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const command = path.split('/').pop();
    if (!['create', 'join', 'room', 'start', 'answer', 'action', 'close'].includes(command))
      return fail(404, 'Unknown route.');
    if (command === 'room') {
      const code = new URL(request.url).searchParams.get('code')?.toUpperCase() || '';
      if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) return fail(400, 'Invalid room code.');
      const stub = env.ROOMS.get(env.ROOMS.idFromName('pico-arena:' + code));
      return stub.fetch(request);
    }
    if (command === 'create') {
      if (request.method !== 'POST') return fail(405, 'POST required.');
      const raw = await request.text();
      if (raw.length > 35000) return fail(413, 'Request too large.');
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = key(6);
        const stub = env.ROOMS.get(env.ROOMS.idFromName('pico-arena:' + code));
        const headers = new Headers(request.headers);
        headers.set('X-Arena-Code', code);
        const response = await stub.fetch(new Request(request.url, {
          method: 'POST', headers, body: raw,
        }));
        if (response.status !== 409) return response;
      }
      return fail(503, 'Could not allocate a room code.');
    }
    if (request.method !== 'POST') return fail(405, 'POST required.');
    const raw = await request.text();
    if (raw.length > 35000) return fail(413, 'Request too large.');
    let data;
    try { data = JSON.parse(raw); } catch { return fail(400, 'Invalid JSON.'); }
    const code = typeof data?.code === 'string' ? data.code.trim().toUpperCase() : '';
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) return fail(400, 'Invalid room code.');
    data.code = code;
    const headers = new Headers(request.headers);
    headers.set('Content-Type', 'application/json');
    const stub = env.ROOMS.get(env.ROOMS.idFromName('pico-arena:' + code));
    return stub.fetch(new Request(request.url, { method: 'POST', headers, body: JSON.stringify(data) }));
  },
};
