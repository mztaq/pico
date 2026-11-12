type Point = readonly [x: number, height: number, z: number];
type Face = { points: Point[]; fill: string; depth: number };
type Material = readonly [top: string, right: string, front: string];

const yaw = 0.32;
const pitch = 0.62;
const cos = Math.cos(yaw);
const sin = Math.sin(yaw);
const tilt = Math.sin(pitch);
const lift = Math.cos(pitch);
const scale = 43;
export const sceneWidth = 880;
export const sceneHeight = 400;
const laneZ = [-2.8, 0, 2.8];
const names = ['NORTH', 'CENTRAL', 'SOUTH'];

const board: Material = ['#3e6085', '#1a314e', '#264263'];
const ice: Material = ['#77a8d0', '#274c72', '#4c79a3'];
const rack: Material = ['#849fc9', '#344670', '#4d6999'];
const bot: Material = ['#d7abff', '#65428e', '#a974d5'];
const relay: Material = ['#7df5e0', '#156c79', '#27a997'];
const hot: Material = ['#fff1a4', '#c05b24', '#ffae48'];
const cold: Material = ['#b6ffff', '#428cac', '#66ddeb'];

function project([x, y, z]: Point): [number, number] {
  return [
    sceneWidth / 2 + (x * cos - z * sin) * scale,
    213 + ((x * sin + z * cos) * tilt - y * lift) * scale,
  ];
}

function drawFace(ctx: CanvasRenderingContext2D, points: Point[], fill: string) {
  ctx.beginPath();
  for (const [i, point] of points.entries()) {
    const [x, y] = project(point);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = '#142539';
  ctx.lineWidth = 1.25;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function box(faces: Face[], x: number, y: number, z: number, w: number, h: number, d: number, colors: Material) {
  const a: Point = [x, y + h, z];
  const b: Point = [x + w, y + h, z];
  const c: Point = [x + w, y + h, z + d];
  const e: Point = [x, y + h, z + d];
  const frontLeft: Point = [x, y, z + d];
  const frontRight: Point = [x + w, y, z + d];
  const backRight: Point = [x + w, y, z];
  const depth = (x + w / 2) * sin + (z + d / 2) * cos;
  faces.push(
    { points: [b, backRight, frontRight, c], fill: colors[1], depth },
    { points: [e, c, frontRight, frontLeft], fill: colors[2], depth },
    { points: [a, b, c, e], fill: colors[0], depth },
  );
}

function drawFaces(ctx: CanvasRenderingContext2D, faces: Face[]) {
  for (const face of faces) drawFace(ctx, face.points, face.fill);
}

export type ArenaState = {
  focus: number;
  shielded: number;
  defended: boolean;
  offline: boolean;
  defense: boolean;
  stage: number;
};

export function drawBoard(ctx: CanvasRenderingContext2D, foreground: CanvasRenderingContext2D, state: ArenaState) {
  const sky = ctx.createLinearGradient(0, 0, 0, sceneHeight);
  sky.addColorStop(0, state.defense ? '#1d3a58' : '#121d37');
  sky.addColorStop(1, state.defense ? '#436a8e' : '#263d64');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, sceneWidth, sceneHeight);

  const floor: Face[] = [];
  box(floor, -8.2, -0.68, -4.3, 16.4, 0.68, 8.6, state.defense ? ice : board);
  drawFaces(ctx, floor);
  const surfaces: Face[] = [];
  const props: Face[] = [];
  const barriers = state.defense ? ice : rack;
  for (let x = -7.9; x < 7; x += 2.4) {
    box(props, x, 0, -4.15, 2.15, 0.66, 0.38, barriers);
    box(props, x + 0.36, 0.32, -3.76, 0.58, 0.13, 0.04, state.defense ? cold : hot);
  }
  for (let x = -7.9; x < 7; x += 2.4) {
    box(surfaces, x, 0, 3.88, 2.1, 0.16, 0.27, barriers);
  }
  for (const [i, z] of laneZ.entries()) {
    const active = i === state.focus;
    const lane: Material = active
      ? state.defense ? ['#398fa1', '#205272', '#29627c'] : ['#a36941', '#613b30', '#76503b']
      : ['#283e60', '#1c304c', '#263c59'];
    box(surfaces, -6.5, 0, z - 0.66, 13, 0.08, 1.32, lane);
    for (let x = -4.7; x < 5.2; x += 1.15) {
      box(surfaces, x, 0.081, z - 0.04, 0.36, 0.016, 0.08, active ? state.defense ? cold : hot : board);
    }
    box(props, -7.35, 0.1, z - 0.7, 1.4, 0.29, 1.4, board);
    box(props, -7.12, 0.39, z - 0.43, 0.26, 0.23, 0.88, board);
    box(props, -6.43, 0.39, z - 0.43, 0.26, 0.23, 0.88, board);
    box(props, -7.15, 0.58, z - 0.52, 1, 0.64, 1.04, bot);
    box(props, -6.84, 1.22, z - 0.12, 0.26, 0.26, 0.24, bot);
    box(props, -7.06, 0.73, z + 0.524, 0.77, 0.35, 0.016, board);
    box(props, -7.03, 0.81, z + 0.525, 0.23, 0.14, 0.027, cold);
    box(props, -6.63, 0.81, z + 0.525, 0.23, 0.14, 0.027, cold);
    if (i === state.shielded || (state.defended && active)) {
      box(props, 2.7, 0.09, z - 0.78, 0.82, 1.32, 0.22, relay);
      box(props, 2.7, 0.09, z + 0.56, 0.82, 1.32, 0.22, relay);
      box(props, 2.7, 1.41, z - 0.78, 0.82, 0.22, 1.56, relay);
    }
  }

  const racks = Math.min(3, 1 + Math.floor(state.stage / 2));
  for (let i = 0; i < racks; i++) {
    const z = (i - (racks - 1) / 2) * 2.35;
    box(props, 5.25, 0.09, z - 0.93, 2.05, 0.24, 1.86, board);
    box(props, 5.45, 0.33, z - 0.73, 1.65, 2.25, 1.46, rack);
    for (let bay = 0; bay < 3; bay++) {
      const height = 0.58 + bay * 0.6;
      box(props, 5.59, height, z + 0.735, 1.35, 0.36, 0.08, board);
      box(props, 6.61, height + 0.11, z + 0.82, 0.17, 0.13, 0.035, state.offline ? hot : relay);
    }
  }
  drawFaces(ctx, surfaces);
  foreground.clearRect(0, 0, sceneWidth, sceneHeight);
  drawFaces(foreground, props.sort((a, b) => a.depth - b.depth));
  for (const [i, z] of laneZ.entries()) {
    const [x, y] = project([-4.9, 0, z + 0.95]);
    foreground.font = 'bold 17px system-ui';
    foreground.fillStyle = i === state.focus ? '#fff0ba' : '#f2f7ff';
    foreground.fillText(names[i], x, y);
  }
}

export function drawPackets(ctx: CanvasRenderingContext2D, traffic: readonly number[], time: number, defense: boolean, lite: boolean, gate: number) {
  const faces: Face[] = [];
  for (const [lane, z] of laneZ.entries()) {
    const count = Math.min(lite ? 2 : 5, Math.ceil((traffic[lane] ?? 0) / 12));
    for (let i = 0; i < count; i++) {
      const phase = (time / 1450 + (i + 0.4) / count) % 1;
      const end = lane === gate && i % 2 === 0 ? 2.35 : 4.85;
      box(faces, -5.7 + (end + 5.7) * phase, 0.14, z - 0.19, 0.42, 0.24, 0.38, defense ? cold : hot);
    }
  }
  drawFaces(ctx, faces.sort((a, b) => a.depth - b.depth));
}
