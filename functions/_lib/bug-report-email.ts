/** Email-safe Pico report template. Inline styles work in Gmail and Outlook. */
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char] ?? char));

export function reportEmailHtml(kind: string, workspace: string, description: string, replyTo?: string): string {
  const detail = (label: string, value: string) =>
    `<tr><td style="padding:10px 0;color:#77758b;width:115px;font-size:13px;vertical-align:top">${label}</td><td style="padding:10px 0;color:#27263a;font-weight:600;font-size:14px;vertical-align:top">${escapeHtml(value)}</td></tr>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f3f2f8;font-family:Arial,Helvetica,sans-serif;color:#27263a">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f2f8"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e7e4f0;border-radius:12px">
<tr><td style="padding:28px 30px 22px;border-bottom:1px solid #e7e4f0">
<div style="font-size:12px;letter-spacing:1.5px;font-weight:700;color:#7865bb">PICO · BUG REPORTS</div>
<h1 style="font-size:25px;line-height:1.25;margin:12px 0 8px">New report received</h1>
<p style="color:#77758b;font-size:14px;margin:0">Someone submitted feedback through Pico.</p>
</td></tr>
<tr><td style="padding:24px 30px 10px">
<h2 style="font-size:12px;letter-spacing:1px;color:#7865bb;margin:0 0 12px">REPORT DETAILS</h2>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
${detail('Report type',kind)}${detail('Workspace',workspace)}${detail('Reply email',replyTo || 'Not provided')}
</table></td></tr>
<tr><td style="padding:12px 30px 30px">
<h2 style="font-size:12px;letter-spacing:1px;color:#7865bb;margin:0 0 12px">WHAT HAPPENED</h2>
<div style="padding:18px;background:#f7f6fb;border:1px solid #e7e4f0;border-left:4px solid #7865bb;border-radius:6px;font-size:14px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(description)}</div>
</td></tr>
<tr><td style="padding:17px 30px;border-top:1px solid #e7e4f0;color:#9390a0;font-size:12px">Sent automatically from Pico's Report a Bug form.</td></tr>
</table></td></tr></table></body></html>`;
}
