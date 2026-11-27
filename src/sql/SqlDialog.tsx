import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog className="sql-create-dialog" ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <div className="sql-dialog-content">
      <header className="sql-dialog-head"><h2>{title}</h2><button type="button" className="topbar-icon" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={18}/></button></header>
      {children}
    </div>
  </dialog>;
}

