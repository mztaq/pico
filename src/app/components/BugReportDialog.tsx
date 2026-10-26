import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { Bug, ImagePlus, X } from 'lucide-react';
import './bug-report.css';

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const SCREENSHOT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const WORKSPACES = ['Home / Other', 'Pseudocode Compiler', 'Python Compiler', 'Flowchart Builder', 'Logic Sim', 'CPU Studio'];

export function BugReportDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const [workspace, setWorkspace] = useState('Home / Other');
  const [kind, setKind] = useState('Bug / Something broken');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');

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

  const attachScreenshot = (file: File | undefined) => {
    if (!file) return;
    if (!SCREENSHOT_TYPES.has(file.type)) {
      setFileError('Use a PNG, JPG, or WebP image.');
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setFileError('Screenshots must be 5 MB or smaller.');
      return;
    }
    setScreenshot(file);
    setFileError('');
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    attachScreenshot(event.target.files?.[0]);
    event.target.value = '';
  };

  const onPaste = (event: ClipboardEvent<HTMLElement>) => {
    const image = Array.from(event.clipboardData.files).find(file => file.type.startsWith('image/'));
    if (!image) return;
    event.preventDefault();
    attachScreenshot(image);
  };

  return <div className="bug-report-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section ref={dialogRef} className="bug-report-dialog" role="dialog" aria-modal="true" aria-labelledby="bug-report-title" aria-describedby="bug-report-intro" onPaste={onPaste}>
      <header className="bug-report-header">
        <span className="bug-report-mark" aria-hidden="true"><Bug size={19} /></span>
        <div>
          <h2 id="bug-report-title">Report an issue</h2>
          <p id="bug-report-intro">Tell us what went wrong in Pico.</p>
        </div>
        <button type="button" className="bug-report-close" aria-label="Close report form" onClick={onClose}><X size={18} /></button>
      </header>
      <form className="bug-report-form" onSubmit={event => event.preventDefault()}>
        <div className="bug-report-field">
          <label htmlFor="bug-report-kind">Report type</label>
          <select id="bug-report-kind" value={kind} onChange={event => setKind(event.target.value)}>
            <option>Bug / Something broken</option>
            <option>Visual or layout issue</option>
            <option>Feature request</option>
            <option>Other feedback</option>
          </select>
        </div>
        <div className="bug-report-field">
          <label htmlFor="bug-report-workspace">Workspace</label>
          <select id="bug-report-workspace" value={workspace} onChange={event => setWorkspace(event.target.value)}>
            {WORKSPACES.map(name => <option key={name}>{name}</option>)}
          </select>
        </div>
        <div className="bug-report-field">
          <label htmlFor="bug-report-description">What happened?</label>
          <textarea id="bug-report-description" value={description} onChange={event => setDescription(event.target.value)} rows={4} maxLength={3000} placeholder="What were you doing? What happened, and what did you expect?" />
        </div>
        <div className="bug-report-field">
          <label htmlFor="bug-report-email">Your email <span>(optional)</span></label>
          <input id="bug-report-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Only if you'd like a reply" maxLength={254} />
        </div>
        <div className="bug-report-field">
          <label htmlFor="bug-report-screenshot">Screenshot <span>(optional)</span></label>
          <div className="bug-report-file-row">
            <ImagePlus size={18} aria-hidden="true" />
            <input id="bug-report-screenshot" type="file" accept="image/png,image/jpeg,image/webp" onChange={onFileChange} aria-describedby="bug-report-file-hint" />
          </div>
          <p id="bug-report-file-hint" className="bug-report-hint">PNG, JPG, or WebP · Up to 5 MB · You can also paste a screenshot.</p>
          {screenshot && <div className="bug-report-attachment"><span>{screenshot.name} ({(screenshot.size / 1024 / 1024).toFixed(2)} MB)</span><button type="button" onClick={() => setScreenshot(null)} aria-label="Remove screenshot"><X size={14} /></button></div>}
          {fileError && <p className="bug-report-error" role="alert">{fileError}</p>}
        </div>
        <footer className="bug-report-footer">
          <p>Email delivery and screenshot storage are not connected yet. This is a preview of the report form.</p>
          <div className="bug-report-actions">
            <button type="button" className="bug-report-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="bug-report-submit" disabled title="Email delivery is not configured yet">Send report</button>
          </div>
        </footer>
      </form>
    </section>
  </div>;
}
