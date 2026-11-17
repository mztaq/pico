import {
  ARENA_TILES, ARENA_ROUND_SECONDS, ARENA_ROOM_CAPACITY, arenaPool, arenaUnits,
  answerReward, nodeCost, questionAt, visibleQuestion, scoreFor,
} from '../../../src/learning/arenaRules.ts';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codePattern = /^[A-HJ-NP-Z2-9]{6}$/;
const tokenPattern = /^Bearer ([a-f0-9]{64})$/;
const namePattern = /^[A-Za-z0-9 _-]{2,20}$/;
const timestamp = () => Math.floor(Date.now() / 1000);
const noStore = { 'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: noStore }); }
function error(status, message) { return json({ error: message }, status); }
async function digest(raw) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, '0')).join('');
}
function token() { return [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join(''); }
function code() { return [...crypto.getRandomValues(new Uint8Array(6))].map(n => alphabet[n % alphabet.length]).join(''); }
async function bodyOf(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) return null;
  if (Number(request.headers.get('content-length') || 0) > 4096) return null;
  const raw = await request.text();
  if (raw.length > 4096) return null;
  try { const value = JSON.parse(raw); return value && typeof value === 'object' && !Array.isArray(value) ? value : null; }
  catch { return null; }
}
async function throttle(env, request, action, limit, period = 60) {
  const identity = action === 'create' || action === 'join'
    ? (request.headers.get('CF-Connecting-IP') || 'unknown')
    : (request.headers.get('Authorization') || 'unknown');
  const window = Math.floor(timestamp() / period) * period;
  const bucket = await digest('arena:' + action + ':' + identity + ':' + window);
  const result = await env.DB.prepare(
    'INSERT INTO pico_arena_limits(bucket,window,hits) VALUES(?,?,1) ' +
    'ON CONFLICT(bucket,window) DO UPDATE SET hits=hits+1 RETURNING hits'
  ).bind(bucket, window).first();
  return Number(result?.hits || 0) <= limit;
}
async function roomFor(env, joinCode) {
  if (!codePattern.test(joinCode)) return null;
  return env.DB.prepare('SELECT * FROM pico_arena_rooms WHERE join_code=? AND expires_at>?')
    .bind(joinCode, timestamp()).first();
}
function roomState(room) {
  if (room.state === 'playing' && room.starts_at !== null &&
    timestamp() >= Number(room.starts_at) + Number(room.duration)) return 'finished';
  return room.state;
}
async function identity(context, room) {
  const found = (context.request.headers.get('Authorization') || '').match(tokenPattern);
  if (!found) return null;
  const hash = await digest(found[1]);
  if (hash === room.host_token_hash) return { role: 'host', player: null };
  const player = await context.env.DB.prepare(
    'SELECT * FROM pico_arena_players WHERE room_id=? AND token_hash=?'
  ).bind(room.id, hash).first();
  return player ? { role: 'player', player } : null;
}
function publicPlayer(row, nodes, index) {
  const owned = nodes.filter(node => node.ownerId === row.id);
  return {
    id: row.id, nickname: row.nickname, charge: row.charge, streak: row.streak,
    amplifier: row.amplifier, correct: row.correct, answered: row.answered,
    owned: owned.length,
    score: scoreFor(owned.map(node => node.level), row.correct, row.amplifier),
    color: index % 8,
  };
}
async function stateOf(context, room, user) {
  const [playerRows, nodeRows] = await Promise.all([
    context.env.DB.prepare('SELECT id,nickname,charge,streak,amplifier,correct,answered,question_cursor,joined_at FROM pico_arena_players WHERE room_id=? ORDER BY joined_at,id LIMIT 30').bind(room.id).all(),
    context.env.DB.prepare('SELECT pos,owner_id,level FROM pico_arena_nodes WHERE room_id=? ORDER BY pos').bind(room.id).all(),
  ]);
  const nodes = (nodeRows.results || []).map(row => ({ pos: Number(row.pos),
    ownerId: row.owner_id, level: Number(row.level) }));
  const players = (playerRows.results || []).map((row, index) => publicPlayer(row, nodes, index))
    .sort((a, b) => b.score - a.score || b.correct - a.correct || a.nickname.localeCompare(b.nickname));
  const current = user.role === 'player'
    ? (playerRows.results || []).find(row => row.id === user.player.id) : null;
  const state = roomState(room);
  const pool = arenaPool(room.unit);
  const question = current && state === 'playing' && pool.length
    ? visibleQuestion(questionAt(room.unit, room.seed, current.question_cursor)) : null;
  return json({
    code: room.join_code, state, unit: room.unit,
    startsAt: room.starts_at, duration: room.duration, expiresAt: room.expires_at,
    role: user.role, playerId: current?.id ?? null, question,
    players, nodes,
  });
}
async function create(context, body) {
  const unit = typeof body?.unit === 'string' ? body.unit : '';
  if (!arenaUnits.includes(unit) || !arenaPool(unit).length) return error(400, 'Choose a topic.');
  if (!await throttle(context.env, context.request, 'create', 4, 3600)) return error(429, 'Too many new games. Try later.');
  const hostToken = token(), id = crypto.randomUUID();
  const now = timestamp(), duration = ARENA_ROUND_SECONDS, seed = crypto.getRandomValues(new Uint32Array(1))[0] % 100000;
  await context.env.DB.batch([
    context.env.DB.prepare('DELETE FROM pico_arena_rooms WHERE expires_at<?').bind(now),
    context.env.DB.prepare('DELETE FROM pico_arena_limits WHERE window<?').bind(now - 86400),
  ]);
  for (let attempt = 0; attempt < 4; attempt++) {
    const joinCode = code();
    try {
      const statements = [
        context.env.DB.prepare('INSERT INTO pico_arena_rooms(id,join_code,unit,host_token_hash,seed,duration,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)')
          .bind(id, joinCode, unit, await digest(hostToken), seed, duration, now, now + 3600),
        ...Array.from({ length: ARENA_TILES }, (_, pos) =>
          context.env.DB.prepare('INSERT INTO pico_arena_nodes(room_id,pos) VALUES(?,?)').bind(id, pos)),
      ];
      await context.env.DB.batch(statements);
      return json({ code: joinCode, token: hostToken }, 201);
    } catch (reason) {
      if (attempt === 3) throw reason;
    }
  }
  return error(503, 'Unable to create game.');
}
async function join(context, body) {
  if (!await throttle(context.env, context.request, 'join', 120)) return error(429, 'Too many attempts.');
  const joinCode = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  const nickname = typeof body?.nickname === 'string' ? body.nickname.trim().replace(/\s+/g, ' ') : '';
  if (!namePattern.test(nickname)) return error(400, 'Use a nickname of 2–20 letters or numbers.');
  const room = await roomFor(context.env, joinCode);
  if (!room || roomState(room) !== 'lobby') return error(404, 'Game is unavailable or already started.');
  const playerToken = token(), id = crypto.randomUUID();
  try {
    const result = await context.env.DB.prepare(
      'INSERT INTO pico_arena_players(id,room_id,nickname,token_hash,joined_at) ' +
      'SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM pico_arena_players WHERE room_id=?) < ? ' +
      'AND (SELECT state FROM pico_arena_rooms WHERE id=?) = ?'
    ).bind(id, room.id, nickname, await digest(playerToken), timestamp(),
      room.id, ARENA_ROOM_CAPACITY, room.id, 'lobby').run();
    if (!result.meta?.changes) return error(409, 'This game is full or has started.');
  } catch { return error(409, 'Nickname already in use.'); }
  return json({ code: joinCode, token: playerToken }, 201);
}
async function start(context, body) {
  const room = await roomFor(context.env, String(body?.code || '').toUpperCase());
  if (!room) return error(404, 'Game not found.');
  const user = await identity(context, room);
  if (!user || user.role !== 'host') return error(403, 'Only the host starts the game.');
  if (roomState(room) !== 'lobby') return error(409, 'Game already started.');
  const participants = await context.env.DB.prepare('SELECT COUNT(*) AS total FROM pico_arena_players WHERE room_id=?').bind(room.id).first();
  if (Number(participants?.total || 0) < 1) return error(409, 'At least one player must join.');
  const result = await context.env.DB.prepare(
    'UPDATE pico_arena_rooms SET state=?,starts_at=? WHERE id=? AND state=?'
  ).bind('playing', timestamp(), room.id, 'lobby').run();
  if (!result.meta?.changes) return error(409, 'Game already started.');
  return json({ ok: true });
}
async function answer(context, body) {
  const room = await roomFor(context.env, String(body?.code || '').toUpperCase());
  if (!room || roomState(room) !== 'playing') return error(409, 'No active round.');
  const user = await identity(context, room);
  if (!user || user.role !== 'player') return error(403, 'Join as a player.');
  if (!await throttle(context.env, context.request, 'answer', 35)) return error(429, 'Answering too quickly.');
  const choice = body?.choice;
  if (!Number.isInteger(choice) || choice < 0 || choice > 3) return error(400, 'Choose an answer.');
  const player = user.player;
  const question = questionAt(room.unit, room.seed, player.question_cursor);
  if (body?.questionId !== question.id) return error(409, 'Question has changed. Refresh your game.');
  const correct = choice === question.answer;
  const reward = answerReward(correct, player.streak, player.amplifier);
  const now = timestamp();
  const updated = await context.env.DB.prepare(
    'UPDATE pico_arena_players SET charge=charge+?,streak=?,correct=correct+?,answered=answered+1,' +
    'question_cursor=question_cursor+1,last_answer_at=? WHERE id=? AND room_id=? AND question_cursor=? AND last_answer_at<=?'
  ).bind(reward.charge, reward.streak, reward.correct, now, player.id, room.id,
    player.question_cursor, now - 1).run();
  if (!updated.meta?.changes) return error(429, 'Wait a moment before answering again.');
  return json({ correct, earned: reward.charge, explanation: question.explanation,
    correctChoice: question.answer,
    nextQuestion: visibleQuestion(questionAt(room.unit, room.seed, player.question_cursor + 1)) });
}
async function action(context, body) {
  const room = await roomFor(context.env, String(body?.code || '').toUpperCase());
  if (!room || roomState(room) !== 'playing') return error(409, 'Round is not active.');
  const user = await identity(context, room);
  if (!user || user.role !== 'player') return error(403, 'Join as a player.');
  if (!await throttle(context.env, context.request, 'action', 45)) return error(429, 'Too many actions.');
  const kind = body?.kind, player = user.player;
  if (kind === 'amplify') {
    if (player.amplifier >= 3) return error(409, 'Amplifier already at maximum.');
    const cost = 70 + player.amplifier * 45;
    const updated = await context.env.DB.prepare(
      'UPDATE pico_arena_players SET charge=charge-?,amplifier=amplifier+1 WHERE id=? AND charge>=? AND amplifier=?'
    ).bind(cost, player.id, cost, player.amplifier).run();
    if (!updated.meta?.changes) return error(409, 'Not enough charge or upgrade changed.');
    return json({ ok: true, cost });
  }
  if (kind !== 'capture' && kind !== 'fortify') return error(400, 'Invalid action.');
  const pos = body?.pos;
  if (!Number.isInteger(pos) || pos < 0 || pos >= ARENA_TILES) return error(400, 'Invalid node.');
  const node = await context.env.DB.prepare(
    'SELECT owner_id,level FROM pico_arena_nodes WHERE room_id=? AND pos=?'
  ).bind(room.id, pos).first();
  if (!node) return error(404, 'Node unavailable.');
  if (kind === 'capture' && node.owner_id === player.id) return error(409, 'You already own this node.');
  if (kind === 'fortify' && node.owner_id !== player.id) return error(403, 'Only your node can be upgraded.');
  const cost = nodeCost(kind, { pos, ownerId: node.owner_id, level: node.level });
  if (cost === null) return error(409, 'Maximum node level.');
  const reserved = await context.env.DB.prepare('UPDATE pico_arena_players SET charge=charge-? WHERE id=? AND charge>=?')
    .bind(cost, player.id, cost).run();
  if (!reserved.meta?.changes) return error(409, 'Not enough charge.');
  let updated;
  try {
    updated = kind === 'capture'
      ? await context.env.DB.prepare(
        'UPDATE pico_arena_nodes SET owner_id=?,level=1 WHERE room_id=? AND pos=? AND owner_id IS ? AND level=?'
      ).bind(player.id, room.id, pos, node.owner_id, node.level).run()
      : await context.env.DB.prepare(
        'UPDATE pico_arena_nodes SET level=level+1 WHERE room_id=? AND pos=? AND owner_id=? AND level=?'
      ).bind(room.id, pos, player.id, node.level).run();
  } catch (reason) {
    await context.env.DB.prepare('UPDATE pico_arena_players SET charge=charge+? WHERE id=?').bind(cost, player.id).run();
    throw reason;
  }
  if (!updated.meta?.changes) {
    await context.env.DB.prepare('UPDATE pico_arena_players SET charge=charge+? WHERE id=?').bind(cost, player.id).run();
    return error(409, 'Node changed. Try another.');
  }
  return json({ ok: true, cost });
}
async function close(context, body) {
  const room = await roomFor(context.env, String(body?.code || '').toUpperCase());
  if (!room) return error(404, 'Game unavailable.');
  const user = await identity(context, room);
  if (!user || user.role !== 'host') return error(403, 'Only the host can end a match.');
  await context.env.DB.prepare('UPDATE pico_arena_rooms SET state=? WHERE id=?').bind('finished', room.id).run();
  return json({ ok: true });
}
export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return error(503, 'Multiplayer requires a Cloudflare D1 database binding named DB.');
  const command = new URL(request.url).pathname.split('/').pop();
  if (!['create','join','room','start','answer','action','close'].includes(command)) return error(404, 'Not found.');
  if (request.method !== (command === 'room' ? 'GET' : 'POST')) return error(405, 'Method not allowed.');
  if (request.method === 'POST' && request.headers.get('Origin') !== new URL(request.url).origin)
    return error(403, 'Invalid origin.');
  try {
    if (command === 'room') {
      const room = await roomFor(env, new URL(request.url).searchParams.get('code')?.toUpperCase() || '');
      if (!room) return error(404, 'Game not found or expired.');
      const user = await identity(context, room);
      if (!user) return error(401, 'Game session unavailable.');
      return stateOf(context, room, user);
    }
    const body = await bodyOf(request);
    if (!body) return error(400, 'Invalid JSON.');
    switch (command) {
      case 'create': return create(context, body);
      case 'join': return join(context, body);
      case 'start': return start(context, body);
      case 'answer': return answer(context, body);
      case 'action': return action(context, body);
      case 'close': return close(context, body);
      default: return error(404, 'Not found.');
    }
  } catch (reason) {
    console.error('Circuit Clash request failed', command, String(reason));
    return error(503, 'Match temporarily unavailable.');
  }
}
