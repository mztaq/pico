import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { picoIsOnline } from './pico-connection';
import './offline-status.css';

/** Non-blocking notice, backed by a real origin probe for desktop webviews. */
export function OfflineStatus() {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  useEffect(() => {
    let active = true;
    let sequence = 0;
    const check = async () => {
      const current = ++sequence;
      if (!navigator.onLine) { setOffline(true); return; }
      const online = await picoIsOnline();
      if (active && current === sequence) setOffline(!online);
    };
    const onOffline = () => { ++sequence; setOffline(true); };
    const onOnline = () => { void check(); };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    void check();
    const timer = window.setInterval(() => { void check(); }, 12000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);
  if (!offline) return null;
  return <aside className="pico-offline-status" role="status" aria-live="polite">
    <WifiOff size={17} aria-hidden="true" />
    <span><strong>You're offline</strong><small>Workspaces still work. Reports and syncing need internet.</small></span>
  </aside>;
}
