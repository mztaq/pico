import {useEffect, useRef, useState} from 'react';

type TurnstileAPI = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: TurnstileAPI } }

export function BugReportTurnstile({onTokenChange}: {onTokenChange: (token: string | null) => void}) {
  const element = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [status, setStatus] = useState('Loading verification…');
  useEffect(() => {
    let active = true;
    let retry: number | undefined;
    let attempts = 0;
    const mount = (siteKey: string) => {
      if (!active || !element.current) return;
      if (!window.turnstile) {
        if (++attempts > 60) { setStatus('Verification could not load. Please refresh.'); return; }
        retry = window.setTimeout(() => mount(siteKey), 250);
        return;
      }
      widget.current = window.turnstile.render(element.current, {
        sitekey: siteKey,
        theme: 'auto',
        callback: (token: string) => { if (active) { onTokenChange(token); setStatus(''); } },
        'expired-callback': () => { onTokenChange(null); setStatus('Verification expired. Please verify again.'); },
        'error-callback': () => { onTokenChange(null); setStatus('Verification failed. Please retry.'); },
        'timeout-callback': () => { onTokenChange(null); setStatus('Verification timed out. Please retry.'); }
      });
      setStatus('');
    };
    (async () => {
      try {
        const response = await fetch('/api/turnstile-config', {cache: 'no-store'});
        if (!response.ok) throw Error();
        const data: {siteKey?: string} = await response.json();
        if (!active || !data.siteKey) throw Error();
        const existing = document.querySelector('script[data-pico-turnstile]');
        if (!existing) {
          const script = document.createElement('script');
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
          script.async = true;
          script.dataset.picoTurnstile = 'true';
          document.head.appendChild(script);
        }
        mount(data.siteKey);
      } catch { if (active) setStatus('Verification unavailable. Please try again later.'); }
    })();
    return () => {
      active = false;
      window.clearTimeout(retry);
      if (widget.current) window.turnstile?.remove(widget.current);
      onTokenChange(null);
    };
  }, [onTokenChange]);
  return <div className="bug-report-turnstile">
    <div ref={element} />
    {status && <p role="status" className="bug-report-hint">{status}</p>}
  </div>;
}
