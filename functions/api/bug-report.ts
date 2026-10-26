import {body, checkOrigin, fail, json, type Context} from '../_lib/core';
import {rateLimit} from '../_lib/rate-limit';
import {reportEmailHtml} from '../_lib/bug-report-email';

const TYPES = ['Bug / Something broken', 'Visual or layout issue', 'Feature request', 'Other feedback'];
const WORKSPACES = ['Home / Other', 'Pseudocode Compiler', 'Python Compiler', 'Flowchart Builder', 'Logic Sim', 'CPU Studio'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestPost = async (ctx: Context): Promise<Response> => {
  const originError = checkOrigin(ctx.request);
  if (originError) return originError;
  if (!ctx.env.RESEND_API_KEY || !ctx.env.BUG_REPORT_TO) return fail(503, 'Bug reporting is not configured');
  if (!ctx.env.DB) return fail(503, 'Database unavailable');
  if (!ctx.request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return fail(415, 'Expected JSON');
  const data = await body(ctx.request);
  if (!data) return fail(400, 'Invalid report');
  const {kind, workspace, description, email} = data;
  if (typeof kind !== 'string' || !TYPES.includes(kind) ||
      typeof workspace !== 'string' || !WORKSPACES.includes(workspace) ||
      typeof description !== 'string' || description.trim().length < 10 || description.length > 3000 ||
      (email !== undefined && (typeof email !== 'string' || email.length > 254 || (email.length > 0 && !emailPattern.test(email))))) {
    return fail(400, 'Check the report fields');
  }
  if (!emailPattern.test(ctx.env.BUG_REPORT_TO)) return fail(503, 'Report recipient is misconfigured');
  try {
    const limited = await rateLimit(ctx, 'bug-report', 3);
    if (limited) return limited;
  } catch {
    return fail(503, 'Report service temporarily unavailable');
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
        subject: '[Pico] ' + kind + ' — ' + workspace,
        text: message,
        html: reportEmailHtml(kind, workspace, description.trim(), replyTo),
        ...(replyTo ? {reply_to: replyTo} : {})
      })
    });
    if (!response.ok) return fail(502, 'Could not deliver the report. Please try again later');
    return json({ok: true});
  } catch {
    return fail(502, 'Could not deliver the report. Please try again later');
  }
};
