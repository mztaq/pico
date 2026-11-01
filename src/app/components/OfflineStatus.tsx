import { useEffect, useRef, useState } from 'react';
import { WifiOff, X } from 'lucide-react';
import { picoIsOnline } from './pico-connection';
import './offline-status.css';

export function OfflineStatus() {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [isHome, setIsHome] = useState(() => document.title === 'Pico | Home');
  const [showPopup, setShowPopup] = useState(false);
  const lastOffline = useRef(!navigator.onLine);
  const homeRef = useRef(document.title === 'Pico | Home');
  useEffect(() => {
    let active = true;
    let sequence = 0;
    const updateStatus = (next: boolean) => {
      if (next && !lastOffline.current && !homeRef.current) setShowPopup(true);
      if (!next) setShowPopup(false);
      lastOffline.current = next;
      setOffline(next);
    };
    const updateHome = () => {
      homeRef.current = document.title === 'Pico | Home';
      setIsHome(homeRef.current);
    };
    const title = document.querySelector('title');
    const observer = new MutationObserver(updateHome);
    if (title) observer.observe(title, {childList: true, characterData: true, subtree: true});
    const check = async () => {
      const current = ++sequence;
      if (!navigator.onLine) { updateStatus(true); return; }
      const online = await picoIsOnline();
      if (active && current === sequence) updateStatus(!online);
    };
    const onOffline = () => { ++sequence; updateStatus(true); };
    const onOnline = () => { void check(); };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    void check();
    const timer = window.setInterval(() => { void check(); }, 12000);
    return () => {
      active = false;
      observer.disconnect();
      window.clearInterval(timer);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);
  if (!offline) return null;
  return <>
    {isHome && <aside className="pico-offline-status" role="status" aria-live="polite">
      <WifiOff size={17} aria-hidden="true" />
      <span><strong>You're offline</strong><small>Workspaces still work. Reports and syncing need internet.</small></span>
    </aside>}
    {!isHome && showPopup && <div className="pico-offline-backdrop" role="presentation">
      <section className="pico-offline-dialog" role="dialog" aria-modal="true" aria-labelledby="pico-offline-heading">
        <button type="button" className="pico-offline-close" aria-label="Dismiss offline notice" onClick={() => setShowPopup(false)}><X size={17}/></button>
        <WifiOff size={23} aria-hidden="true"/>
        <h2 id="pico-offline-heading">You're offline</h2>
        <p>Your workspace still works. Reports and syncing need internet.</p>
        <button type="button" className="pico-offline-continue" onClick={() => setShowPopup(false)}>Continue working</button>
      </section>
    </div>}
  </>;
}
