import { compile } from '../../../src/language/index.ts';
import { execute } from '../../../src/runtime/interpreter.ts';
import { challengeById } from '../../../src/learning/challenges.ts';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const tokenPattern = /^Bearer ([a-f0-9]{64})$/;
const codePattern = /^[A-HJ-NP-Z2-9]{6}$/;
const nicknamePattern = /^[A-Za-z0-9 _-]{2,24}$/;
const nowSeconds = () => Math.floor(Date.now() / 1000);

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
function fail(status, message) { return reply({ error: message }, status); }

async function digest(value) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
function secret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
function joinCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}
async function readJson(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) return null;
  if (Number(request.headers.get('content-length') || 0) > 13000) return null;
  const raw = await request.text();
  if (raw.length > 13000) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}
async function gate(env, request, action, limit, seconds = 60) {
  // Submission limits are per student session, not shared by a whole school's Wi-Fi IP.
  const identity = action === 'submit' ? (request.headers.get('Authorization') || 'unknown') :
    (request.headers.get('CF-Connecting-IP') || 'unknown');
  const window = Math.floor(nowSeconds() / seconds) * seconds;
  const bucket = await digest(action + ':' + identity + ':' + window);
  const record = await env.DB.prepare(
    'INSERT INTO pico_classroom_limits(bucket,window,hits) VALUES(?,?,1) ' +
    'ON CONFLICT(bucket,window) DO UPDATE SET hits=hits+1 RETURNING hits'
  ).bind(bucket, window).first();
  return Number(record?.hits || 0) <= limit;
}
function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return origin === new URL(request.url).origin;
}
async function roomFor(context, code) {
  if (!codePattern.test(code)) return null;
  return context.env.DB.prepare(
    'SELECT id,join_code,challenge_id,host_token_hash,state,expires_at FROM pico_classroom_rooms ' +
    'WHERE join_code=? AND expires_at>?'
  ).bind(code, nowSeconds()).first();
}
async function member(context, room) {
  const raw = context.request.headers.get('Authorization') || '';
  const match = raw.match(tokenPattern);
  if (!match) return null;
  const tokenHash = await digest(match[1]);
  if (tokenHash === room.host_token_hash) return { role: 'host' };
  const player = await context.env.DB.prepare(
    'SELECT id,nickname FROM pico_classroom_players WHERE room_id=? AND token_hash=?'
  ).bind(room.id, tokenHash).first();
  return player ? { role: 'student', player } : null;
}
async function listScores(context, room) {
  const rows = await context.env.DB.prepare(
    'SELECT p.id,p.nickname,p.joined_at,r.passed,r.total,r.attempts ' +
    'FROM pico_classroom_players p LEFT JOIN pico_classroom_results r ON r.player_id=p.id AND r.room_id=p.room_id ' +
    'WHERE p.room_id=? ORDER BY COALESCE(r.passed,-1) DESC,p.joined_at ASC LIMIT 30'
  ).bind(room.id).all();
  return (rows.results || []).map(row => ({
    id: row.id, nickname: row.nickname, passed: row.passed, total: row.total,
    attempts: row.attempts,
  }));
}

async function createRoom(context, body) {
  const challenge = challengeById(typeof body?.challengeId === 'string' ? body.challengeId : '');
  if (!challenge) return fail(400, 'Choose a valid challenge.');
  if (!await gate(context.env, context.request, 'create', 3, 3600)) return fail(429, 'Too many new rooms. Try again later.');
  const id = crypto.randomUUID();
  const hostToken = secret();
  const hash = await digest(hostToken);
  const created = nowSeconds();
  // Remove expired classroom records. D1 enforces cascading foreign keys.
  await context.env.DB.batch([
    context.env.DB.prepare('DELETE FROM pico_classroom_rooms WHERE expires_at<?').bind(created),
    context.env.DB.prepare('DELETE FROM pico_classroom_limits WHERE window<?').bind(created - 86400),
  ]);
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = joinCode();
    try {
      await context.env.DB.prepare(
        'INSERT INTO pico_classroom_rooms(id,join_code,challenge_id,host_token_hash,created_at,expires_at) ' +
        'VALUES(?,?,?,?,?,?)'
      ).bind(id, code, challenge.id, hash, created, created + 7200).run();
      return reply({ code, token: hostToken, challengeId: challenge.id, expiresAt: created + 7200 }, 201);
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
  return fail(503, 'Unable to create room.');
}

async function joinRoom(context, body) {
  if (!await gate(context.env, context.request, 'join', 120)) return fail(429, 'Too many join attempts. Try later.');
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  const nickname = typeof body?.nickname === 'string' ? body.nickname.trim().replace(/\s+/g, ' ') : '';
  if (!nicknamePattern.test(nickname)) return fail(400, 'Use 2–24 letters, numbers, spaces, - or _.');
  const room = await roomFor(context, code);
  if (!room || room.state !== 'open') return fail(404, 'This classroom is unavailable.');
  const token = secret();
  const tokenHash = await digest(token);
  const id = crypto.randomUUID();
  try {
    const insertion = await context.env.DB.prepare(
      'INSERT INTO pico_classroom_players(id,room_id,nickname,token_hash,joined_at) ' +
      'SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM pico_classroom_players WHERE room_id=?)<30'
    ).bind(id, room.id, nickname, tokenHash, nowSeconds(), room.id).run();
    if (!insertion.meta?.changes) return fail(409, 'Classroom full (30 students).');
  } catch {
    return fail(409, 'That nickname is already taken in this room.');
  }
  return reply({ code: room.join_code, token, nickname, challengeId: room.challenge_id }, 201);
}

async function describeRoom(context, code) {
  const room = await roomFor(context, code);
  if (!room) return fail(404, 'Room not found or expired.');
  const user = await member(context, room);
  if (!user) return fail(401, 'Classroom access denied.');
  const challenge = challengeById(room.challenge_id);
  if (!challenge) return fail(503, 'Challenge unavailable.');
  const players = await listScores(context, room);
  return reply({
    code: room.join_code, state: room.state, expiresAt: room.expires_at,
    role: user.role, nickname: user.role === 'student' ? user.player.nickname : undefined,
    challenge: { id: challenge.id, title: challenge.title, task: challenge.task,
      starter: challenge.starter, level: challenge.level },
    players,
  });
}

async function submit(context, body) {
  if (!await gate(context.env, context.request, 'submit', 8)) return fail(429, 'Too many submissions. Try later.');
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  const source = body?.source;
  if (typeof source !== 'string' || !source.trim() || source.length > 12000) return fail(400, 'Code must be 1–12,000 characters.');
  const room = await roomFor(context, code);
  if (!room || room.state !== 'open') return fail(404, 'Room closed or expired.');
  const user = await member(context, room);
  if (!user || user.role !== 'student') return fail(401, 'Student session required.');
  const challenge = challengeById(room.challenge_id);
  if (!challenge) return fail(503, 'Challenge unavailable.');

  let ast;
  try { ast = compile(source).ast; }
  catch (error) { return fail(400, error instanceof Error ? error.message.slice(0, 280) : 'Pseudocode contains an error.'); }
  let passed = 0;
  for (const test of challenge.cases) {
    try {
      const run = execute(ast, test.inputs, { trace: false, limit: 3000, mcpFast: true });
      const expected = test.expected.map(v => v.trim());
      const output = run.output.map(v => v.trim());
      if (expected.length === output.length && expected.every((v, i) => v === output[i])) passed++;
    } catch {
      // Runtime errors count as an incorrect test, rather than leaking execution details.
    }
  }
  const submitted = nowSeconds();
  await context.env.DB.prepare(
    'INSERT INTO pico_classroom_results(room_id,player_id,passed,total,attempts,submitted_at) VALUES(?,?,?,?,1,?) ' +
    'ON CONFLICT(room_id,player_id) DO UPDATE SET ' +
    'passed=MAX(pico_classroom_results.passed,excluded.passed),' +
    'total=excluded.total,attempts=pico_classroom_results.attempts+1,submitted_at=excluded.submitted_at'
  ).bind(room.id, user.player.id, passed, challenge.cases.length, submitted).run();
  return reply({ passed, total: challenge.cases.length });
}

async function closeRoom(context, body) {
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  const room = await roomFor(context, code);
  if (!room) return fail(404, 'Room not found or expired.');
  const user = await member(context, room);
  if (!user || user.role !== 'host') return fail(403, 'Only the room host can close it.');
  await context.env.DB.prepare('UPDATE pico_classroom_rooms SET state=? WHERE id=?').bind('closed', room.id).run();
  return reply({ ok: true });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return fail(503, 'Classroom requires a D1 database binding named DB.');
  const action = new URL(request.url).pathname.split('/').pop();
  if (!['create','join','room','submit','close'].includes(action)) return fail(404, 'Not found.');
  if (request.method !== (action === 'room' ? 'GET' : 'POST')) return fail(405, 'Method not allowed.');
  if (request.method === 'POST' && !sameOrigin(request)) return fail(403, 'Invalid origin.');
  try {
    if (action === 'room') {
      const code = new URL(request.url).searchParams.get('code')?.toUpperCase() || '';
      return await describeRoom(context, code);
    }
    const body = await readJson(request);
    if (!body) return fail(400, 'Invalid JSON request.');
    if (action === 'create') return await createRoom(context, body);
    if (action === 'join') return await joinRoom(context, body);
    if (action === 'submit') return await submit(context, body);
    return await closeRoom(context, body);
  } catch (error) {
    console.error('Classroom request failed', action, String(error));
    return fail(503, 'Classroom is temporarily unavailable.');
  }
}
