import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

type ActiveDrag<T> = { kind: T; label: string; pointerId: number; startX: number; startY: number; moved: boolean };
type DragPreview = { label: string; x: number; y: number };

/**
 * Drag palette items with pointer events instead of HTML5 draggable/dataTransfer.
 * Windows WebView2/Tauri can hand native HTML drag feedback to the OS ("Copy"
 * and a document icon), interrupting the drop. Click-to-add still works.
 */
export function usePalettePointerDrag<T extends string>(onDrop: (kind: T, x: number, y: number) => void) {
  const active = useRef<ActiveDrag<T> | null>(null);
  const callback = useRef(onDrop);
  callback.current = onDrop;
  const suppressClick = useRef(false);
  const clearClickTimer = useRef<number | undefined>(undefined);
  const [preview, setPreview] = useState<DragPreview | null>(null);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = active.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
      drag.moved = true;
      setPreview({ label: drag.label, x: event.clientX, y: event.clientY });
    };
    const finish = (event: PointerEvent) => {
      const drag = active.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      active.current = null;
      setPreview(null);
      if (drag.moved) {
        suppressClick.current = true;
        callback.current(drag.kind, event.clientX, event.clientY);
        window.clearTimeout(clearClickTimer.current);
        clearClickTimer.current = window.setTimeout(() => { suppressClick.current = false; }, 0);
      }
    };
    const cancel = () => { active.current = null; setPreview(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', finish, true);
    window.addEventListener('pointercancel', cancel, true);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('pointercancel', cancel, true);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', escape);
      window.clearTimeout(clearClickTimer.current);
    };
  }, []);

  const start = (event: ReactPointerEvent<HTMLButtonElement>, kind: T, label: string) => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    active.current = { kind, label, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const click = (onClick: () => void) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    onClick();
  };
  return { start, click, preview };
}
