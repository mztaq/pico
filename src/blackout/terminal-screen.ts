/** Painted directly onto the in-world laptop/operations display.
 * Pure layout and hit-testing are shared by mouse input and rendering.
 * No HTML menu is positioned over the 3D scene.
 */
export type TerminalMode = 'attack' | 'defend';
export interface TerminalActionView {
  id: string;
  title: string;
  description: string;
  available: boolean;
  cooldown: number;
}
export interface TerminalView {
  mode: TerminalMode;
  actions: TerminalActionView[];
  traffic: number;
  bytesPerRequest?: number;
  health: number;
  proxies: number;
  progress: number;
  elapsed: number;
  hovered: number;
  focused?: boolean;
}
export interface HitBox { x: number; y: number; width: number; height: number }
export function terminalActionBoxes(width: number, height: number, count: number): HitBox[] {
  const compact = height < 680;
  const top = compact ? 108 : 132;
  const buttonHeight = compact ? 88 : 100;
  const gap = compact ? 10 : 12;
  return Array.from({length: count}, (_, i) => ({
    x: 44, y: top + i * (buttonHeight + gap),
    width: width - 88, height: buttonHeight,
  }));
}
export function terminalHitTest(
  x: number, y: number, width: number, height: number, count: number,
): number {
  return terminalActionBoxes(width, height, count).findIndex(
    r => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height,
  );
}
function rounded(ctx: CanvasRenderingContext2D, rect: HitBox, radius = 13) {
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
}
export function drawTerminalScreen(ctx: CanvasRenderingContext2D, view: TerminalView) {
  const {width: w, height: h} = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#111324'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#212337'; ctx.fillRect(0, 0, w, 91);
  ctx.fillStyle = view.mode === 'attack' ? '#cba6f7' : '#89b4fa';
  ctx.fillRect(0, 0, 8, h);
  ctx.font = '700 29px "DM Sans",sans-serif';
  ctx.fillStyle = '#e5e7ff';
  ctx.fillText(view.mode === 'attack' ? 'Pico  /  Controls' : 'Pico  /  Security controls', 44, 44);
  ctx.font = '16px "JetBrains Mono",monospace';
  ctx.fillStyle = '#afb6cf';
  ctx.fillText(view.focused ? 'CLICK AN ACTION OR PRESS 1–4    ·    ESC TO LEAVE' : 'SELECT AN ACTION DIRECTLY ON THIS SCREEN', 44, 72);
  ctx.textAlign = 'right';
  ctx.font = '700 18px "JetBrains Mono",monospace';
  ctx.fillStyle = '#a6e3a1';
  ctx.fillText('ONLINE', w - 44, 44);
  ctx.textAlign = 'left';

  const boxes = terminalActionBoxes(w, h, view.actions.length);
  view.actions.forEach((action, i) => {
    const rect = boxes[i];
    const hover = view.hovered === i;
    rounded(ctx, rect);
    ctx.fillStyle = !action.available ? '#252639' : hover ? '#393653' : '#2b2d41';
    ctx.fill();
    ctx.strokeStyle = hover ? '#cba6f7' : '#50536b';
    ctx.lineWidth = hover ? 3 : 1.5; ctx.stroke();
    ctx.fillStyle = '#cba6f7'; ctx.font = '700 23px "JetBrains Mono",monospace';
    ctx.fillText(String(i + 1).padStart(2, '0'), rect.x + 18, rect.y + 38);
    ctx.font = '700 24px "DM Sans",sans-serif';
    ctx.fillStyle = action.available ? '#e1e4f6' : '#969cb3';
    ctx.fillText(action.title, rect.x + 74, rect.y + 39, rect.width - 250);
    ctx.fillStyle = '#aeb5cc'; ctx.font = '18px "DM Sans",sans-serif';
    ctx.fillText(action.description, rect.x + 74, rect.y + 73, rect.width - 140);
    ctx.font = '700 15px "JetBrains Mono",monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = action.available ? '#a6e3a1' : '#f9e2af';
    ctx.fillText(action.cooldown > 0 ? Math.ceil(action.cooldown) + 's' : action.available ? 'READY' : 'LOCKED',
      rect.x + rect.width - 21, rect.y + 34);
    ctx.textAlign = 'left';
  });
  const footer = h - 98;
  ctx.fillStyle = '#8992ab'; ctx.font = '700 15px "JetBrains Mono",monospace';
  ctx.fillText(view.mode === 'attack' ? 'EXPOSURE' : 'CASE EVIDENCE', 44, footer + 9);
  ctx.fillStyle = '#a6adc8'; ctx.textAlign = 'right';
  ctx.fillText('EDGE PROXIES ' + view.proxies + '  •  HEALTH ' + Math.round(view.health) + '%', w - 44, footer + 9);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#34394d'; ctx.fillRect(44, footer + 28, w - 88, 12);
  ctx.fillStyle = view.progress >= 75 ? '#f38ba8' : '#cba6f7';
  ctx.fillRect(44, footer + 28, (w - 88) * Math.min(1, Math.max(0, view.progress / 100)), 12);
  ctx.fillStyle = '#a6adc8'; ctx.font = '16px "JetBrains Mono",monospace';
  ctx.fillText(view.mode==='attack'?'F  PICK UP / RECONNECT LAPTOP':'SECURITY ROOM / OPERATIONS',44,h-26);
  ctx.textAlign = 'right';
  ctx.fillText(view.focused?'ESC  BACK TO ROOM':'CLICK  SELECT ACTION',w-44,h-26);
  ctx.textAlign = 'left';
}
