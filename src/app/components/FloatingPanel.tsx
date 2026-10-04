import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

interface FloatingPanelProps {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  className?: string;
  /** Which edge of the anchor the panel lines up with. */
  align?: 'right' | 'left';
  /** Space between the anchor and the panel. */
  gap?: number;
  /** Smallest distance kept between the panel and the window edges. */
  margin?: number;
  children: ReactNode;
}

interface PanelBox { top: number; left: number; width: number; maxHeight: number; }

/**
 * A dropdown that is positioned relative to the viewport and clamped so it can
 * never leave the screen: it flips above the anchor when there is more room
 * there, is pulled back inside the horizontal margins, and scrolls internally
 * once its content is taller than the space available.
 */
export function FloatingPanel({ anchor, open, className = '', align = 'right', gap = 8, margin = 10, children }: FloatingPanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<PanelBox | null>(null);

  useLayoutEffect(() => {
    if (!open) { setBox(null); return; }
    const place = () => {
      const target = anchor.current;
      const element = panel.current;
      if (!target || !element) return;
      const rect = target.getBoundingClientRect();
      const next = computePanelBox({
        anchor: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
        naturalHeight: element.scrollHeight,
        preferredWidth: element.offsetWidth || 300,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        align, gap, margin,
      });
      setBox(previous => previous && previous.top === next.top && previous.left === next.left && previous.width === next.width && previous.maxHeight === next.maxHeight ? previous : next);
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    observer?.observe(document.documentElement);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      observer?.disconnect();
    };
  }, [open, anchor, align, gap, margin]);

  if (!open) return null;
  return <div
    ref={panel}
    className={`floating-panel ${className}`.trim()}
    style={box
      ? { top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight }
      : { top: 0, left: 0, visibility: 'hidden' }}
  >
    {children}
  </div>;
}

export interface PlacementInput {
  /** Anchor position in viewport coordinates. */
  anchor: { top: number; bottom: number; left: number; right: number };
  /** How tall the panel would like to be, and how wide it prefers to be. */
  naturalHeight: number;
  preferredWidth: number;
  viewport: { width: number; height: number };
  align?: 'right' | 'left';
  gap?: number;
  margin?: number;
}

/**
 * Work out where an anchored panel goes. The result is always fully inside the
 * viewport: it opens below the anchor, flips above it when that side has more
 * room, is pulled inside the horizontal margins, and is capped with an internal
 * scroll when its content is taller than the space available.
 */
export function computePanelBox({ anchor, naturalHeight, preferredWidth, viewport, align = 'right', gap = 8, margin = 10 }: PlacementInput): PanelBox {
  const width = Math.min(preferredWidth, Math.max(200, viewport.width - margin * 2));
  const spaceBelow = viewport.height - anchor.bottom - gap - margin;
  const spaceAbove = anchor.top - gap - margin;
  const openBelow = naturalHeight <= spaceBelow || spaceBelow >= spaceAbove;
  const maxHeight = Math.max(160, Math.min(openBelow ? spaceBelow : spaceAbove, Math.max(naturalHeight, 160)));
  const top = openBelow ? anchor.bottom + gap : Math.max(margin, anchor.top - gap - maxHeight);
  const preferredLeft = align === 'right' ? anchor.right - width : anchor.left;
  const left = Math.min(Math.max(margin, preferredLeft), Math.max(margin, viewport.width - width - margin));
  return { top, left, width, maxHeight };
}
