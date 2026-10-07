import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Bell, Check, Sparkles, X } from 'lucide-react';
import './updates.css';

export interface ChangelogEntry {
  id: string;
  date: string;
  update: string;
}

export const LAST_SEEN_UPDATE_KEY = 'pico.updates.lastSeen.v1';
const POLL_INTERVAL_MS = 30_000;
const EXIT_ANIMATION_MS = 240;

export function parseChangelog(contents: string): ChangelogEntry[] {
  return contents.split(/\r?\n/).flatMap((line, lineIndex) => {
    const match = line.trim().match(/^\[(\d{4}-\d{2}-\d{2})\]\s*:\s*(.+?)\s*$/);
    if (!match) return [];
    const date = match[1]!;
    const [year, month, day] = date.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(year!, month! - 1, day!));
    if (parsedDate.getUTCFullYear() !== year || parsedDate.getUTCMonth() !== month! - 1 || parsedDate.getUTCDate() !== day) return [];
    return [{ id: `${lineIndex + 1}:${date}:${match[2]}`, date, update: match[2]! }];
  });
}

function readLastSeen(): string {
  try { return localStorage.getItem(LAST_SEEN_UPDATE_KEY) ?? ''; }
  catch { return ''; }
}

function writeLastSeen(id: string) {
  try { localStorage.setItem(LAST_SEEN_UPDATE_KEY, id); }
  catch { /* Changelog viewing still works when browser storage is unavailable. */ }
}

export function UpdateCenter() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [seenId, setSeenId] = useState(readLastSeen);
  const [toast, setToast] = useState<ChangelogEntry | null>(null);
  const [exiting, setExiting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const latestRef = useRef<ChangelogEntry | null>(null);
  const exitTimer = useRef<number | null>(null);
  const seenRef = useRef(seenId);

  const markSeen = useCallback((entry: ChangelogEntry | null) => {
    if (!entry) return;
    seenRef.current = entry.id;
    setSeenId(entry.id);
    writeLastSeen(entry.id);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/logs.txt', { cache: 'no-store' });
      if (!response.ok) return;
      const nextEntries = parseChangelog(await response.text());
      const latest = nextEntries.at(-1) ?? null;
      latestRef.current = latest;
      setEntries(nextEntries);
      if (!latest) return;

      const storedSeenId = seenRef.current;
      if (latest.id === storedSeenId) return;
      const seenIndex = nextEntries.findIndex(entry => entry.id === storedSeenId);
      const hasUnseen = storedSeenId === '' || seenIndex === -1 || seenIndex < nextEntries.length - 1;
      if (hasUnseen) {
        if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
        setExiting(false);
        setToast(latest);
      }
    } catch {
      // The workspace remains usable if the local changelog file is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, POLL_INTERVAL_MS);
    const onFocus = () => { void refresh(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    };
  }, [refresh]);

  useEffect(() => {
    if (!dialogOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setDialogOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialogOpen]);

  const openDialog = () => {
    markSeen(latestRef.current);
    setToast(null);
    setExiting(false);
    setDialogOpen(true);
  };

  const dismissToast = () => {
    if (!toast || exiting) return;
    markSeen(toast);
    setExiting(true);
    exitTimer.current = window.setTimeout(() => {
      setToast(current => current?.id === toast.id ? null : current);
      setExiting(false);
      exitTimer.current = null;
    }, EXIT_ANIMATION_MS);
  };

  const unseen = Boolean(entries.length && entries.at(-1)?.id !== seenId);

  return <>
    <button className={`toolbar-button update-trigger ${unseen ? 'has-unseen' : ''}`} type="button" onClick={openDialog} aria-label={unseen ? 'View updates, new updates available' : 'View updates'} title="View updates">
      <Bell size={16} /> <span>Updates</span>{unseen && <i className="update-unread-dot" aria-hidden="true" />}
    </button>

    {toast && <aside className={`update-toast ${exiting ? 'is-exiting' : ''}`} role="status" aria-live="polite" key={toast.id}>
      <div className="update-toast-icon"><Sparkles size={17} /></div>
      <div className="update-toast-copy">
        <div className="update-toast-heading">New update <span>{toast.date}</span></div>
        <p>{toast.update}</p>
        <button className="update-toast-link" type="button" onClick={openDialog}>View updates <ArrowRight size={14} /></button>
      </div>
      <button className="update-toast-close" type="button" aria-label="Dismiss update notification" onClick={dismissToast}><X size={15} /></button>
    </aside>}

    {dialogOpen && <div className="update-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDialogOpen(false); }}>
      <section className="update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-dialog-title">
        <header className="update-dialog-header">
          <div className="update-dialog-mark"><Sparkles size={17} /></div>
          <div><h2 id="update-dialog-title">What’s new</h2><p>Product updates, kept right here on your device.</p></div>
          <button className="update-dialog-close" type="button" aria-label="Close updates" onClick={() => setDialogOpen(false)}><X size={17} /></button>
        </header>
        <div className="update-dialog-list">
          {entries.length === 0 ? <div className="update-empty">No updates have been posted yet.</div> : [...entries].reverse().map((entry, index) => <article className="update-entry" key={entry.id}>
            <div className="update-entry-marker">{index === 0 ? <Check size={13} /> : <span />}</div>
            <div className="update-entry-content"><time dateTime={entry.date}>{entry.date}</time><p>{entry.update}</p></div>
            {index === 0 && <span className="update-latest-label">LATEST</span>}
          </article>)}
        </div>
        <footer className="update-dialog-footer"><span><span className="update-local-indicator" /> Stored locally · refreshes automatically</span><button type="button" onClick={() => setDialogOpen(false)}>Done</button></footer>
      </section>
    </div>}
  </>;
}
