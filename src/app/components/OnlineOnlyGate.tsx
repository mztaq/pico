import { useCallback, useEffect, useRef, useState, type ReactNode, type MouseEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, WifiOff } from 'lucide-react';
import { HomeScreen } from './HomeScreen';
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
  const [hasConnected, setHasConnected] = useState(false);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);
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
      if (connected) {
        setHasConnected(true);
        setShowOfflineMessage(false);
      }
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

  // Preserve the real workspace in memory, but keep it hidden and inert offline.
  // The offline homepage is a separate, nonfunctional view outside #root.
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

  const blockOfflineAction = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element) || !event.target.closest('button, a, [role="button"]')) return;
    event.preventDefault();
    event.stopPropagation();
    setShowOfflineMessage(true);
  };
  const blockOfflineKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!(event.target instanceof Element) || !event.target.closest('button, a, [role="button"]')) return;
    event.preventDefault();
    event.stopPropagation();
    setShowOfflineMessage(true);
  };

  const retry = async () => {
    setRetrying(true);
    try { await check(); }
    finally { setRetrying(false); }
  };

  return (
    <>
      {hasConnected ? children : null}
      {status === 'offline' && createPortal(
        <div className="pico-offline-home" onClickCapture={blockOfflineAction} onKeyDownCapture={blockOfflineKeyboard}>
          <HomeScreen onChoose={() => setShowOfflineMessage(true)} />
        </div>,
        document.body,
      )}
      {(status === 'checking' || (status === 'offline' && showOfflineMessage)) && createPortal(
        <div className="pico-connection-screen" role="presentation">
          <main className="pico-connection-card" role="dialog" aria-modal="true" aria-labelledby="pico-offline-title" aria-describedby="pico-offline-description">
            <div className="pico-connection-brand">
              <img src="/pico-logo.svg" alt="" />
              Pico<span>.</span>
            </div>
            <div className="pico-connection-icon"><WifiOff size={26} aria-hidden="true" /></div>
            <h1 id="pico-offline-title">{status === 'checking' ? 'Connecting to Pico…' : "You're offline"}</h1>
            <p id="pico-offline-description">Pico requires an internet connection to work. Please reconnect to continue.</p>
            <button type="button" onClick={() => { void retry(); }} disabled={retrying}>
              <RefreshCw size={16} aria-hidden="true" />
              {retrying ? 'Checking…' : 'Try again'}
            </button>
            <div className="pico-connection-footnote">Pico will reconnect automatically when the connection returns.</div>
          </main>
        </div>,
        document.body,
      )}
    </>
  );
}
