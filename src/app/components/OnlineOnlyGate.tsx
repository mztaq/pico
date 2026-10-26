import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, WifiOff } from 'lucide-react';
import './online-only.css';

type ConnectionStatus = 'checking' | 'online' | 'offline';
const CHECK_INTERVAL_MS = 15_000;
const CHECK_TIMEOUT_MS = 6_000;

// A same-origin request, rather than navigator.onLine alone, verifies that Pico
// itself is reachable. The unique URL and no-store setting bypass HTTP caches.
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
  const [hasConnected, setHasConnected] = useState(false);
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
      if (connected) setHasConnected(true);
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

  // Keep already-open workspaces mounted so drafts and editor state survive
  // disconnections, but make the entire app inaccessible until reconnected.
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    root.inert = status !== 'online';
    root.style.visibility = status === 'online' ? '' : 'hidden';
    return () => {
      root.inert = false;
      root.style.visibility = '';
    };
  }, [status]);

  return (
    <>
      {hasConnected ? children : null}
      {status !== 'online' && createPortal(
        <div className="pico-connection-screen" role="alert" aria-live="polite">
          <main className="pico-connection-card">
            <div className="pico-connection-brand">
              <img src="/pico-logo.svg" alt="" />
              Pico<span>.</span>
            </div>
            <div className="pico-connection-icon"><WifiOff size={26} aria-hidden="true" /></div>
            <h1>{status === 'checking' ? 'Connecting to Pico…' : "You're offline"}</h1>
            <p>Pico requires an internet connection to work. Please reconnect to continue.</p>
            <button type="button" onClick={() => { void check(); }}>
              <RefreshCw size={16} aria-hidden="true" />
              Try again
            </button>
            <div className="pico-connection-footnote">Pico will reconnect automatically when the connection returns.</div>
          </main>
        </div>,
        document.body,
      )}
    </>
  );
}
