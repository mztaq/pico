import { useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';

interface ResizeHandleProps {
  /** Pointer movement axis: x changes a column width; y changes a row height. */
  axis: 'x' | 'y';
  label: string;
  onResize: (delta: number) => void;
  className?: string;
}

/** Small accessible splitter. Drag with a pointer or use the arrow keys. */
export function ResizeHandle({ axis, label, onResize, className = '' }: ResizeHandleProps) {
  const pointer = useRef<{ id: number; position: number } | null>(null);
  const vertical = axis === 'x';
  const [dragging, setDragging] = useState(false);

  function coordinate(event: ReactPointerEvent<HTMLDivElement>) {
    return vertical ? event.clientX : event.clientY;
  }
  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    setDragging(true);
    pointer.current = { id: event.pointerId, position: coordinate(event) };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointer.current || pointer.current.id !== event.pointerId) return;
    const position = coordinate(event);
    const delta = position - pointer.current.position;
    if (delta !== 0) onResize(delta);
    pointer.current.position = position;
  }
  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointer.current?.id !== event.pointerId) return;
    pointer.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const negative = vertical ? ['ArrowLeft', 'ArrowUp'] : ['ArrowUp', 'ArrowLeft'];
    const positive = vertical ? ['ArrowRight', 'ArrowDown'] : ['ArrowDown', 'ArrowRight'];
    if (negative.includes(event.key)) { event.preventDefault(); onResize(-10); }
    if (positive.includes(event.key)) { event.preventDefault(); onResize(10); }
  }

  return <div
    className={`panel-resize-handle ${vertical ? 'resize-handle-x' : 'resize-handle-y'} ${className} ${dragging ? 'is-dragging' : ''}`.trim()}
    role="separator"
    aria-orientation={vertical ? 'vertical' : 'horizontal'}
    aria-label={label}
    aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
    tabIndex={0}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerUp}
    onLostPointerCapture={() => { pointer.current = null; setDragging(false); }}
    onKeyDown={onKeyDown}
  ><span className="resize-handle-grip" aria-hidden="true" /></div>;
}
