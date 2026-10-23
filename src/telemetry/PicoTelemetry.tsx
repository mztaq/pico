import { useEffect, useRef, useState } from 'react';
import './cookie-consent.css';

type Choice = { analytics: boolean; preferences: boolean };
const KEY = 'pico.consent.v1';
const workspaces: Record<string,string> = {
  'Pico | Logic Sim': 'logic',
  'Pico | Python Compiler': 'python',
  'Pico | Pseudocode Compiler': 'pseudocode',
  'Pico | Flowchart Builder': 'flowchart',
  'Pico | CPU Studio': 'cpu',
};

async function post(path: string, value: unknown) {
  const response = await fetch(path, {
    method:'POST', credentials:'same-origin',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(value),
  });
  if (!response.ok) throw new Error('Unable to save Pico privacy settings.');
  return response.json();
}
function storedChoice(): Choice | null {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Choice | null;
    return data && typeof data.analytics === 'boolean' && typeof data.preferences === 'boolean' ? data : null;
  } catch { return null; }
}
export function PicoTelemetry() {
  const [choice,setChoice] = useState<Choice | null>(()=>storedChoice());
  const [editing,setEditing] = useState(false);
  const [draft,setDraft] = useState<Choice>(()=>storedChoice() ?? {analytics:false,preferences:false});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const seconds = useRef(0);
  const lastActivity = useRef(Date.now());
  const workspace = useRef<string | null>(null);

  useEffect(()=>{
    if (!choice?.analytics) return;
    let stopped = false;
    const syncWorkspace = () => {workspace.current = workspaces[document.title] ?? null;};
    syncWorkspace();
    const observer = new MutationObserver(syncWorkspace);
    const title = document.querySelector('title');
    if (title) observer.observe(title,{childList:true,characterData:true,subtree:true});
    const noteActivity = () => {lastActivity.current = Date.now();};
    for(const type of ['pointerdown','keydown','wheel']) window.addEventListener(type,noteActivity,{passive:true});
    let sending = false;
    const flush = async () => {
      if (stopped || sending || seconds.current < 50 || !workspace.current) return;
      const duration = Math.min(60,seconds.current);
      sending = true;
      try {
        await post('/api/usage',{workspace:workspace.current,seconds:duration});
        seconds.current -= duration;
      } catch { /* Don't interrupt compilers when analytics is unavailable. */ }
      finally { sending = false; }
    };
    const timer = window.setInterval(()=>{
      if (!document.hidden && workspace.current && Date.now()-lastActivity.current < 120000) seconds.current++;
      if (seconds.current>=60) void flush();
    },1000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      observer.disconnect();
      for(const type of ['pointerdown','keydown','wheel']) window.removeEventListener(type,noteActivity);
    };
  },[choice?.analytics]);

  const save = async (next:Choice) => {
    setBusy(true);setError('');
    try {
      await post('/api/consent',next);
      localStorage.setItem(KEY,JSON.stringify(next));
      setChoice(next);setDraft(next);setEditing(false);
    } catch {
      setError('Settings were not saved. Check your connection and try again.');
    } finally {setBusy(false);}
  };

  useEffect(() => {
    if (!editing) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && choice) setEditing(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [editing, choice]);

  return <>
    {choice && !editing && <button className="pico-cookie-reopen" type="button"
      onClick={() => { setDraft(choice); setEditing(true); }} aria-label="Open cookie settings">
      Cookie Settings
    </button>}

    {!choice && !editing && <section className="pico-cookie-banner" aria-label="Cookie consent">
      <p>
        We use cookies to remember your settings and improve Pico. Choose what works for you. <a href="#cookies">Cookie Policy</a>
      </p>
      {error && <span className="pico-cookie-error" role="alert">{error}</span>}
      <div className="pico-cookie-actions">
        <button className="pico-cookie-btn pico-cookie-outline" type="button"
          onClick={() => { setDraft({analytics:false, preferences:false}); setEditing(true); }}>
          Cookie Settings
        </button>
        <button className="pico-cookie-btn pico-cookie-neutral" type="button" disabled={busy}
          onClick={() => void save({analytics:false, preferences:false})}>Reject All</button>
        <button className="pico-cookie-btn pico-cookie-primary" type="button" disabled={busy}
          onClick={() => void save({analytics:true, preferences:true})}>Accept All</button>
      </div>
    </section>}

    {editing && <div className="pico-cookie-overlay"
      onMouseDown={event => { if (event.target === event.currentTarget && choice) setEditing(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="pico-cookie-title"
        aria-describedby="pico-cookie-description" className="pico-cookie-modal">
        <header className="pico-cookie-modal-head">
          <div>
            <span className="pico-cookie-eyebrow">PRIVACY PREFERENCES</span>
            <h2 id="pico-cookie-title">Cookie Settings</h2>
          </div>
          {choice && <button className="pico-cookie-close" type="button"
            onClick={() => setEditing(false)} aria-label="Close cookie settings">×</button>}
        </header>
        <p id="pico-cookie-description" className="pico-cookie-description">
          Choose how Pico uses optional cookies. You can update your choices at any time.
        </p>
        <div className="pico-cookie-categories">
          <div className="pico-cookie-category">
            <div><strong>Strictly Necessary</strong><p>Remember your cookie choices.</p></div>
            <span className="pico-cookie-required">Always active</span>
          </div>
          <label className="pico-cookie-category">
            <div><strong>Analytics</strong><p>Measure feature usage to improve Pico.</p></div>
            <input aria-label="Allow analytics cookies" type="checkbox" checked={draft.analytics}
              onChange={event => setDraft(v => ({...v, analytics:event.target.checked}))} />
          </label>
          <label className="pico-cookie-category">
            <div><strong>Preferences</strong><p>Save your settings for future visits in this browser.</p></div>
            <input aria-label="Allow preference cookies" type="checkbox" checked={draft.preferences}
              onChange={event => setDraft(v => ({...v, preferences:event.target.checked}))} />
          </label>
        </div>
        <a className="pico-cookie-policy" href="#cookies" onClick={() => setEditing(false)}>Cookie Policy →</a>
        {error && <p className="pico-cookie-error" role="alert">{error}</p>}
        <div className="pico-cookie-modal-actions">
          <button className="pico-cookie-btn pico-cookie-outline" type="button" disabled={busy}
            onClick={() => void save({analytics:false, preferences:false})}>Reject All</button>
          <button className="pico-cookie-btn pico-cookie-neutral" type="button" disabled={busy}
            onClick={() => void save(draft)}>Save Preferences</button>
          <button className="pico-cookie-btn pico-cookie-primary" type="button" disabled={busy}
            onClick={() => void save({analytics:true, preferences:true})}>Accept All</button>
        </div>
      </section>
    </div>}
  </>;
}
