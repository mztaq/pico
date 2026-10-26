/** Branded, email-client-friendly report template. All report fields are HTML-escaped. */
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char] ?? char));

export function reportEmailHtml(kind: string, workspace: string, description: string, replyTo?: string): string {
  const detail = (label: string, value: string, last = false) =>
    `<tr>
      <td style="padding:12px 0;${last ? '' : 'border-bottom:1px solid #f0eff3;'}color:#797988;font-size:13px;width:112px;vertical-align:top;">${label}</td>
      <td style="padding:12px 0;${last ? '' : 'border-bottom:1px solid #f0eff3;'}color:#232333;font-size:14px;font-weight:600;vertical-align:top;overflow-wrap:anywhere;">${escapeHtml(value)}</td>
    </tr>`;

  return `<!doctype html><html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fafafa;color:#232333;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;">
<tr><td align="center" style="padding:28px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e9e8ee;border-radius:12px;">
<tr><td style="padding:25px 28px 21px;border-bottom:1px solid #eeedf2;">
  <div style="font-size:14px;font-weight:800;letter-spacing:-.3px;color:#252337;">Pico<span style="color:#8066ca;">.</span>
    <span style="font-size:11px;font-weight:600;letter-spacing:.5px;color:#9995a8;margin-left:9px;">BUG REPORT</span>
  </div>
  <h1 style="margin:17px 0 0;font-size:22px;line-height:1.3;font-weight:700;color:#232333;">New report received</h1>
</td></tr>
<tr><td style="padding:17px 28px 6px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    ${detail('Report type', kind)}
    ${detail('Workspace', workspace)}
    ${detail('Reply to', replyTo || 'No email provided', true)}
  </table>
</td></tr>
<tr><td style="padding:16px 28px 28px;">
  <div style="margin-bottom:10px;font-size:13px;font-weight:700;color:#45435b;">Description</div>
  <div style="padding:15px 17px;background:#f7f7fa;border:1px solid #ebebf1;border-radius:8px;color:#333244;font-size:14px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(description)}</div>
</td></tr>
<tr><td style="padding:14px 28px;border-top:1px solid #eeedf2;color:#9996a4;font-size:11px;line-height:1.5;">
  Sent from Pico · Report a Bug
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
