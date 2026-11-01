import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import './offline-status.css';

/** A non-blocking notice. Offline workspaces remain fully interactive. */
export function OfflineStatus() {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  if (!offline) return null;
  return <aside className="pico-offline-status" role="status" aria-live="polite">
    <WifiOff size={17} aria-hidden="true" />
    <span><strong>You're offline</strong><small>Workspaces still work. Reports and syncing need internet.</small></span>
  </aside>;
}
