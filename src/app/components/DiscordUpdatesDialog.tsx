import { useEffect, useRef } from 'react';
import { CalendarDays, Sparkles, X } from 'lucide-react';
import type { DiscordUpdate } from '../discordUpdates';

interface Props {
  updates: DiscordUpdate[];
  onClose: () => void;
}

function formattedDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export function DiscordUpdatesDialog({ updates, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onCloseRef.current(); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...document.querySelectorAll<HTMLElement>('.updates-dialog button:not([disabled]), .updates-dialog a[href], .updates-dialog [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return <div className="updates-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="updates-dialog" role="dialog" aria-modal="true" aria-labelledby="updates-title" aria-describedby="updates-description">
      <header className="updates-header">
        <span className="updates-mark"><Sparkles size={17} aria-hidden="true" /></span>
        <div className="updates-heading"><p className="updates-eyebrow">PICO RELEASE NOTES</p><h2 id="updates-title">What’s new</h2><p id="updates-description">Recent updates from the Pico team.</p></div>
        <button ref={closeRef} className="updates-close" aria-label="Close updates" onClick={onClose}><X size={17} /></button>
      </header>
      <div className="updates-list">
        {updates.map(update => <article className="update-card" key={update.id}>
          <div className="update-meta"><span className={`update-category update-category-${update.category}`}>{update.category === 'update' ? 'UPDATE' : update.category.toUpperCase()}</span><time dateTime={update.timestamp}><CalendarDays size={12} aria-hidden="true" />{formattedDate(update.timestamp)}</time></div>
          <p className="update-content">{update.content}</p>
        </article>)}
      </div>
      <footer className="updates-footer"><span>Only human-authored posts are shown.</span><button className="updates-done" onClick={onClose}>Got it</button></footer>
    </section>
  </div>;
}
