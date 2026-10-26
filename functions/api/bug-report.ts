import {readJsonBody, checkOrigin, fail, json, type Context} from '../_lib/core';
import {rateLimit} from '../_lib/rate-limit';
import {reportEmailHtml} from '../_lib/bug-report-email';

const TYPES = ['Bug / Something broken', 'Visual or layout issue', 'Feature request', 'Other feedback'];
const WORKSPACES = ['Home / Other', 'Pseudocode Compiler', 'Python Compiler', 'Flowchart Builder', 'Logic Sim', 'CPU Studio'];
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const imageType = (bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | null => {
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') return 'image/webp';
  return null;
};
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestPost = async (ctx: Context): Promise<Response> => {
  const originError = checkOrigin(ctx.request);
  if (originError) return originError;
  if (!ctx.env.RESEND_API_KEY || !ctx.env.BUG_REPORT_TO) return fail(503, 'Bug reporting is not configured');
  if (!ctx.env.DB) return fail(503, 'Database unavailable');
  if (!ctx.env.TURNSTILE_SECRET_KEY || !ctx.env.TURNSTILE_SITE_KEY) return fail(503, 'Verification is not configured');
  const contentType = ctx.request.headers.get('content-type') ?? '';
  const multipart = /^multipart\/form-data(?:\s*;|$)/i.test(contentType);
  if (!multipart && !/^application\/json(?:\s*;|$)/i.test(contentType)) return fail(415, 'Expected JSON or multipart form');
  let data: Record<string, unknown> | null = null;
  let tooLarge = false;
  let screenshot: File | null = null;
  if (multipart) {
    const limit = MAX_SCREENSHOT_BYTES + 16 * 1024;
    const declared = Number(ctx.request.headers.get('content-length') ?? 0);
    if (declared > limit) return fail(413, 'Upload exceeds 5 MB');
    if (!ctx.request.body) return fail(400, 'Invalid report');
    const reader = ctx.request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > limit) { void reader.cancel().catch(() => {}); return fail(413, 'Upload exceeds 5 MB'); }
        chunks.push(value);
      }
    } catch { return fail(400, 'Invalid upload'); } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try {
      const parsed = await new Request(ctx.request.url, {method:'POST', headers:{'content-type':contentType}, body:bytes}).formData();
      const fields: Record<string, unknown> = {};
      for (const [key, value] of parsed) {
        if (key === 'screenshot') { if (screenshot || !(value instanceof File)) return fail(400, 'Invalid screenshot'); screenshot = value; }
        else if (typeof value !== 'string' || !['kind','workspace','description','email','turnstileToken'].includes(key) || key in fields) return fail(400, 'Invalid report fields');
        else fields[key] = value;
      }
      data = fields;
    } catch { return fail(400, 'Invalid upload'); }
  } else {
    ({data, tooLarge} = await readJsonBody(ctx.request));
  }
  if (tooLarge) return fail(413, 'Report exceeds 4 KB limit');
  if (!data) return fail(400, 'Invalid report');
  const {kind, workspace, description, email, turnstileToken} = data;
  if (typeof kind !== 'string' || !TYPES.includes(kind) ||
      typeof workspace !== 'string' || !WORKSPACES.includes(workspace) ||
      typeof description !== 'string' || description.trim().length < 10 || description.length > 3000 ||
      (email !== undefined && (typeof email !== 'string' || email.length > 254 || (email.length > 0 && !emailPattern.test(email))))) {
    return fail(400, 'Check the report fields');
  }
  if (typeof turnstileToken !== 'string' || !/^[A-Za-z0-9._-]{1,2048}$/.test(turnstileToken)) return fail(400, 'Verification required');
  if (screenshot && (screenshot.size < 16 || screenshot.size > MAX_SCREENSHOT_BYTES ||
      !['image/png','image/jpeg','image/webp'].includes(screenshot.type))) return fail(400, 'Invalid screenshot or storage unavailable');
  if (!emailPattern.test(ctx.env.BUG_REPORT_TO)) return fail(503, 'Report recipient is misconfigured');
  try {
    const limited = await rateLimit(ctx, 'bug-report', 5);
    if (limited) return limited;
  } catch {
    return fail(503, 'Report service temporarily unavailable');
  }
  try {
    const form = new FormData();
    form.set('secret', ctx.env.TURNSTILE_SECRET_KEY);
    form.set('response', turnstileToken);
    const ip = ctx.request.headers.get('CF-Connecting-IP');
    if (ip) form.set('remoteip', ip);
    const verified = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {method: 'POST', body: form, signal: AbortSignal.timeout(7000)});
    if (!verified.ok) return fail(503, 'Verification temporarily unavailable');
    const result: {success?: boolean; hostname?: string} = await verified.json();
    if (!result.success || result.hostname !== new URL(ctx.request.url).hostname) return fail(403, 'Verification failed. Please try again');
  } catch {
    return fail(503, 'Verification temporarily unavailable');
  }
  let attachment: {filename: string; content: string} | undefined;
  if (screenshot) {
    const bytes = new Uint8Array(await screenshot.arrayBuffer());
    const actualType = imageType(bytes);
    if (!actualType || actualType !== screenshot.type) return fail(400, 'Invalid image contents');
    const ext = actualType === 'image/png' ? 'png' : actualType === 'image/jpeg' ? 'jpg' : 'webp';
    // Base64 encode in bounded chunks to avoid stack overflows on 5 MB images.
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    attachment = {filename: 'pico-screenshot.' + ext, content: btoa(binary)};
  }
  const replyTo = typeof email === 'string' && email ? email : undefined;
  const message = [
    'New Pico report', '',
    'Type: ' + kind, 'Workspace: ' + workspace,
    'Reply email: ' + (replyTo ?? '(not provided)'), '',
    'Description:', description.trim()
  ].join('\n');
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {'Authorization': 'Bearer ' + ctx.env.RESEND_API_KEY, 'Content-Type': 'application/json'},
      body: JSON.stringify({
        from: 'Pico Bug Reports <onboarding@resend.dev>',
        to: [ctx.env.BUG_REPORT_TO],
        subject: '[Pico #' + crypto.randomUUID().slice(0, 12).toUpperCase() + '] ' + kind + ' — ' + workspace,
        text: message,
        html: reportEmailHtml(kind, workspace, description.trim(), replyTo),
        ...(attachment ? {attachments: [attachment]} : {}),
        ...(replyTo ? {reply_to: replyTo} : {})
      })
    });
    if (!response.ok) return fail(502, 'Could not deliver the report. Please try again later');
    return json({ok: true});
  } catch {
    return fail(502, 'Could not deliver the report. Please try again later');
  }
};
