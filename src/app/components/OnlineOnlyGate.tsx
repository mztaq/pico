import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, WifiOff } from 'lucide-react';
import './online-only.css';

type ConnectionStatus = 'checking' | 'online' | 'offline';
const CHECK_INTERVAL_MS = 15_000;
const CHECK_TIMEOUT_MS = 6_000;

// The probe must come from Pico's server, never the offline service worker cache.
export async function checkPicoConnection(signal: AbortSignal): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const response = await fetch(`/pico-online.txt?check=${Date.now()}`, {
      cache: 'no-store',
      signal,
    });
    return response.ok && (await response.text()).trim() === 'pico-online';
  } catch {
    return false;
  }
}

export function OnlineOnlyGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [retrying, setRetrying] = useState(false);
  const activeCheck = useRef<AbortController | null>(null);
  const sequence = useRef(0);

  const check = useCallback(async () => {
    const checkNumber = ++sequence.current;
    activeCheck.current?.abort();
    const controller = new AbortController();
    activeCheck.current = controller;

    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }

    const timeout = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    try {
      const connected = await checkPicoConnection(controller.signal);
      if (checkNumber !== sequence.current) return;
      setStatus(connected ? 'online' : 'offline');
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    void check();
    const onOffline = () => {
      ++sequence.current;
      activeCheck.current?.abort();
      setStatus('offline');
    };
    const onOnline = () => { void check(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(() => { void check(); }, CHECK_INTERVAL_MS);
    return () => {
      ++sequence.current;
      activeCheck.current?.abort();
      window.clearInterval(interval);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  // Show the homepage immediately while checking, but prevent interaction until
  // Pico responds. Keep the current workspace mounted under the offline overlay.
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    root.inert = status !== 'online';
    return () => {
      root.inert = false;
    };
  }, [status]);

  const retry = async () => {
    setRetrying(true);
    try { await check(); }
    finally { setRetrying(false); }
  };

  return (
    <>
      {children}
      {status === 'offline' && createPortal(
        <div className="pico-connection-screen" role="presentation">
          <main className="pico-connection-card" role="dialog" aria-modal="true" aria-labelledby="pico-offline-title" aria-describedby="pico-offline-description">
            <div className="pico-connection-icon"><WifiOff size={22} aria-hidden="true" /></div>
            <h1 id="pico-offline-title">You're offline</h1>
            <p id="pico-offline-description">Connect to the internet to use Pico.</p>
            <button type="button" onClick={() => { void retry(); }} disabled={retrying}>
              <RefreshCw size={16} aria-hidden="true" />
              {retrying ? 'Checking…' : 'Try again'}
            </button>
          </main>
        </div>,
        document.body,
      )}
    </>
  );
}
