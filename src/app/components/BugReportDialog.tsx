import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { Bug, ImagePlus, X } from 'lucide-react';
import './bug-report.css';
import {BugReportTurnstile} from './BugReportTurnstile';

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_SCREENSHOT_BYTES = 10 * 1024 * 1024;
const MAX_SCREENSHOTS = 5;
const SCREENSHOT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const WORKSPACES = ['Home / Other', 'Pseudocode Compiler', 'Python Compiler', 'Flowchart Builder', 'Logic Sim', 'CPU Studio', 'Binary Lab'];

export function BugReportDialog({ onClose, onResult }: { onClose: () => void; onResult: (type: 'success' | 'error', message: string) => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const [workspace, setWorkspace] = useState('');
  const [kind, setKind] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [sending, setSending] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLSelectElement>('select')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      ) ?? []);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose]);

  const attachScreenshots = (files: File[]) => {
    if (!files.length) return;
    const invalid = files.find(file => !SCREENSHOT_TYPES.has(file.type) || file.size < 16 || file.size > MAX_SCREENSHOT_BYTES);
    if (invalid) {
      setFileError('Each image must be a PNG, JPG, or WebP between 16 bytes and 5 MB.');
      return;
    }
    const next = [...screenshots];
    for (const file of files) {
      if (next.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) continue;
      next.push(file);
    }
    if (next.length > MAX_SCREENSHOTS) {
      setFileError('You can attach up to 5 screenshots.');
      return;
    }
    if (next.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_SCREENSHOT_BYTES) {
      setFileError('Screenshots must be 10 MB or less in total.');
      return;
    }
    setScreenshots(next);
    setFileError('');
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    attachScreenshots(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const onPaste = (event: ClipboardEvent<HTMLElement>) => {
    const images = Array.from(event.clipboardData.files).filter(file => file.type.startsWith('image/'));
    if (!images.length) return;
    event.preventDefault();
    attachScreenshots(images);
  };

  const submitReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending || !turnstileToken || !kind || !workspace) return;
    if (description.trim().length < 10) return;
    setSending(true);
    try {
      const fields = {kind, workspace, description: description.trim(), email: email.trim(), turnstileToken};
      const payload = new FormData();
      Object.entries(fields).forEach(([key, value]) => payload.set(key, value));
      for (const screenshot of screenshots) payload.append('screenshots', screenshot, screenshot.name);
      const response = await fetch('/api/bug-report', {
        method: 'POST',
        ...(screenshots.length ? {body: payload} : {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(fields)})
      });
      const result: {ok?: boolean; error?: string; screenshotAttached?: boolean; screenshotsAttached?: number} = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Could not send report');
      if (screenshots.length && result.screenshotsAttached !== screenshots.length) throw new Error('Report sent, but some screenshots may not have been attached. Please try again.');
      onResult('success', screenshots.length ? `Report and ${screenshots.length} screenshot${screenshots.length === 1 ? '' : 's'} sent successfully!` : 'Thanks for helping improve Pico!');
    } catch (error) {
      onResult('error', error instanceof Error ? error.message : 'Could not send report. Please try again.');
    } finally { setSending(false); }
  };

  return <div className="bug-report-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section ref={dialogRef} className="bug-report-dialog" role="dialog" aria-modal="true" aria-labelledby="bug-report-title" aria-describedby="bug-report-intro" onPaste={onPaste}>
      <header className="bug-report-header">
        <span className="bug-report-mark" aria-hidden="true"><Bug size={19} /></span>
        <div>
          <h2 id="bug-report-title">Report an issue</h2>
          <p id="bug-report-intro">Describe what went wrong in Pico.</p>
        </div>
        <button type="button" className="bug-report-close" aria-label="Close report form" onClick={onClose}><X size={18} /></button>
      </header>
      <form className="bug-report-form" onSubmit={submitReport}>
        <div className="bug-report-field">
          <label htmlFor="bug-report-kind">Report type</label>
          <select required id="bug-report-kind" value={kind} onChange={event => setKind(event.target.value)}>
            <option value="" disabled>Choose a report type</option>
            <option>Bug / Something broken</option>
            <option>Visual or layout issue</option>
            <option>Feature request</option>
            <option>Other feedback</option>
          </select>
        </div>
        <div className="bug-report-field">
          <label htmlFor="bug-report-workspace">Workspace</label>
          <select required id="bug-report-workspace" value={workspace} onChange={event => setWorkspace(event.target.value)}>
            <option value="" disabled>Choose a workspace</option>
            {WORKSPACES.map(name => <option key={name}>{name}</option>)}
          </select>
        </div>
        <div className="bug-report-field">
          <label htmlFor="bug-report-description">What happened?</label>
          <textarea required minLength={10} id="bug-report-description" value={description} onChange={event => setDescription(event.target.value)} rows={4} maxLength={3000} placeholder="What were you doing? What happened, and what did you expect?" />
        </div>
        <div className="bug-report-field">
          <label htmlFor="bug-report-email">Your email <span>(optional)</span></label>
          <input id="bug-report-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Only if you'd like a reply" maxLength={254} />
        </div>
        <div className="bug-report-field">
          <label htmlFor="bug-report-screenshot">Screenshots <span>(optional)</span></label>
          <div className="bug-report-file-row">
            <ImagePlus size={18} aria-hidden="true" />
            <input id="bug-report-screenshot" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={onFileChange} aria-describedby="bug-report-file-hint" />
          </div>
          <p id="bug-report-file-hint" className="bug-report-hint">PNG, JPG, or WebP.</p>
          {screenshots.map((file, index) => <div className="bug-report-attachment" key={file.name + '-' + file.size + '-' + file.lastModified + '-' + index}><span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span><button type="button" onClick={() => { setScreenshots(current => current.filter((_, i) => i !== index)); setFileError(''); }} aria-label={'Remove ' + file.name}><X size={14} /></button></div>)}
          {fileError && <p className="bug-report-error" role="alert">{fileError}</p>}
        </div>
        <BugReportTurnstile onTokenChange={setTurnstileToken} />
        <footer className="bug-report-footer">
          <p>Reports and optional screenshots are delivered by email.</p>
          <div className="bug-report-actions">
            <button type="button" className="bug-report-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="bug-report-submit" disabled={sending || !turnstileToken}>{sending ? "Sending…" : "Send report"}</button>
          </div>
        </footer>
      </form>
    </section>
  </div>;
}
