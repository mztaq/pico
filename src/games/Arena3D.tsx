import { useEffect, useRef } from 'react';
import { drawBoard, drawPackets, sceneHeight, sceneWidth, type ArenaState } from './arena-scene';

export function Arena3D({
  traffic, focus, shielded = -1, defended = false, offline = false,
  defense = false, stage = 0, lite = false, animate = false,
}: Pick<ArenaState, 'focus'> & Partial<ArenaState> & {
  traffic: readonly number[]; lite?: boolean; animate?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const packets = useRef<HTMLCanvasElement>(null);
  const props = useRef<HTMLCanvasElement>(null);
  const width = lite ? sceneWidth / 2 : sceneWidth;
  const height = lite ? sceneHeight / 2 : sceneHeight;

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d', { alpha: false });
    const foreground = props.current?.getContext('2d');
    if (!ctx || !foreground) return;
    ctx.setTransform(width / sceneWidth, 0, 0, height / sceneHeight, 0, 0);
    foreground.setTransform(width / sceneWidth, 0, 0, height / sceneHeight, 0, 0);
    drawBoard(ctx, foreground, { focus, shielded, defended, offline, defense, stage });
  }, [focus, shielded, defended, offline, defense, stage, width, height]);

  useEffect(() => {
    const layer = packets.current;
    const ctx = layer?.getContext('2d');
    if (!ctx || !layer) return;
    ctx.setTransform(width / sceneWidth, 0, 0, height / sceneHeight, 0, 0);
    const gate = defended ? focus : shielded;
    const paint = (time: number) => {
      ctx.clearRect(0, 0, sceneWidth, sceneHeight);
      drawPackets(ctx, traffic, time, defense, lite, gate);
    };
    paint(performance.now());
    if (!animate || !traffic.some(Boolean)) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let interval: number | undefined;
    let visible = true;
    const sync = () => {
      window.clearInterval(interval);
      interval = !visible || document.hidden || motion.matches
        ? undefined : window.setInterval(() => paint(performance.now()), lite ? 100 : 50);
    };
    const observer = typeof IntersectionObserver === 'undefined' ? undefined :
      new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer?.observe(layer);
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', sync);
    sync();
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', sync);
      window.clearInterval(interval);
    };
  }, [traffic, width, height, animate, lite, defense, defended, focus, shielded]);

  return <div className="arcade-arena" role="img" aria-label="3D battlefield with three bot lanes, defensive gates and server racks">
    <canvas ref={canvas} width={width} height={height} aria-hidden="true" />
    <canvas ref={packets} width={width} height={height} aria-hidden="true" />
    <canvas ref={props} width={width} height={height} aria-hidden="true" />
  </div>;
}
