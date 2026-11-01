import {useEffect, useRef, useState} from 'react';
import {CheckCircle2, CircleAlert, X} from 'lucide-react';

export function BugReportNotice({type, message, onClose}: {
  type: 'success' | 'error' | 'queued'; message: string; onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(6);
  useEffect(() => {
    closeRef.current?.focus();
    const started = Date.now();
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, 6 - Math.floor((Date.now() - started) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) onClose();
    }, 200);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); window.clearInterval(timer); };
  }, [onClose]);
  return <div className="bug-report-notice-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className={'bug-report-notice bug-report-notice--' + type} role="alertdialog" aria-modal="true" aria-labelledby="bug-report-notice-title" aria-describedby="bug-report-notice-message">
      <div className="bug-report-notice-icon" aria-hidden="true">
        {type === 'success' ? <CheckCircle2 size={30} /> : <CircleAlert size={30} />}
      </div>
      <h2 id="bug-report-notice-title">{type === 'success' ? 'Report sent!' : type === 'queued' ? 'Saved for sending' : 'Something went wrong'}</h2>
      <p id="bug-report-notice-message">{message}</p>
      <p className="bug-report-notice-timer">Closing automatically in {secondsLeft}s</p>
      <div className="bug-report-notice-progress" aria-hidden="true"><div /></div>
      <button ref={closeRef} type="button" className="bug-report-notice-close" onClick={onClose}>
        {type === 'success' ? 'Done' : 'Close'} <X size={15} aria-hidden="true" />
      </button>
    </section>
  </div>;
}
