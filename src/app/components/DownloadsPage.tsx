import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, Download, FileArchive, Package, RefreshCw } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';
import { loadSettings } from '../../storage/settings';
import { contrastRatio, cssVariables, getTheme } from '../themes';
import { downloadableAssets, fileFormat, formatSize, releaseFromManifest, type HostedDownloadManifest, type Release, type ReleaseAsset, type ReleasePage } from '../../releases/types';
import '../../styles/downloads.css';

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
function ReleaseDate({ value }: { value: string | null }) {
  return value && Number.isFinite(Date.parse(value)) ? <time dateTime={value}>{dateFormat.format(new Date(value))}</time> : <span>Date unavailable</span>;
}

// These labels describe explicit installer formats and architecture tokens, not inferred compatibility.
export function assetPlatform(asset: ReleaseAsset): string {
  if (/\.(exe|msi)$/i.test(asset.name)) return 'Windows';
  if (/\.(dmg|pkg)$/i.test(asset.name)) return 'macOS';
  if (/\.(deb|rpm|appimage)$/i.test(asset.name)) return 'Linux';
  return 'Other files';
}
export function assetArchitecture(name: string): string | null {
  const token = name.match(/(?:^|[._-])(aarch64|arm64|x86_64|amd64|x64|i686|i386|x86)(?=[._-]|$)/i)?.[1].toLowerCase();
  if (!token) return null;
  return ['aarch64', 'arm64'].includes(token) ? 'ARM64' : ['amd64', 'x64', 'x86_64'].includes(token) ? 'x64' : 'x86';
}

// A deliberately small, safe Markdown subset. Raw HTML is always rendered as text.
function inlineNotes(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    return link ? <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}<span className="downloads-sr-only"> (opens in a new tab)</span></a> : part;
  });
}
export function ReleaseNotes({ body }: { body: string | null }) {
  if (!body?.trim()) return <p>No release notes were provided.</p>;
  return <div className="release-notes">{body.trim().split(/\r?\n\s*\r?\n/).map((block, index) => {
    const lines = block.split(/\r?\n/);
    if (lines.every(line => /^[-*] /.test(line))) return <ul key={index}>{lines.map((line, i) => <li key={i}>{inlineNotes(line.slice(2))}</li>)}</ul>;
    if (/^#{1,6} /.test(block)) return <h4 key={index}>{inlineNotes(block.replace(/^#{1,6} /, ''))}</h4>;
    return <p key={index}>{inlineNotes(block)}</p>;
  })}</div>;
}

function AssetGroups({ release, onDownload }: { release: Release; onDownload: (name: string) => void }) {
  const assets = downloadableAssets(release);
  if (!assets.length) return <p className="downloads-empty-files">No download files have been attached to this release yet.</p>;
  return <div className="download-platforms">{['Windows', 'macOS', 'Linux', 'Other files'].map(platform => {
    const files = assets.filter(asset => assetPlatform(asset) === platform);
    if (!files.length) return null;
    return <section className="download-platform" key={platform} aria-label={`${platform} downloads`}>
      <h3><span className="download-platform-mark">{platform === 'Other files' ? <FileArchive size={26} aria-hidden="true" /> : <PlatformIcon platform={platform} />}</span>{platform}</h3>
      <ul>{files.map(asset => <li key={asset.id}>
        <div className="download-file-meta"><span>{fileFormat(asset.name)}</span>{assetArchitecture(asset.name) && <span>{assetArchitecture(asset.name)}</span>}<span>{formatSize(asset.size)}</span></div>
        <span className="download-filename">{asset.name}</span>
        {asset.label && <p className="download-file-label">{asset.label}</p>}
        <a className="download-action" href={`/downloads/${encodeURIComponent(asset.name)}`} onClick={() => onDownload(asset.name)} aria-label={`Download ${asset.name}`}><Download size={16} aria-hidden="true" />Download<span className="download-action-format">{fileFormat(asset.name)}</span></a>
      </li>)}</ul>
    </section>;
  })}</div>;
}

export default function DownloadsPage() {
  const [settings] = useState(loadSettings);
  const theme = getTheme(settings.theme);
  const [data, setData] = useState<ReleasePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [retryAt, setRetryAt] = useState(0);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    for (const [property, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(property, value);
    document.documentElement.style.colorScheme = theme.appearance;
  }, [theme]);
  useEffect(() => {
    if (!retryAt) return;
    const update = () => setRetrySeconds(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  async function load(signal: AbortSignal) {
    setLoading(true); setError('');
    try {
      let response = await fetch('/download-assets/manifest.json', { signal, headers: { Accept: 'application/json' } });
      if (!response.ok && window.location.hostname !== 'picompiler.pages.dev') {
        response = await fetch('https://picompiler.pages.dev/download-assets/manifest.json', { signal, headers: { Accept: 'application/json' } });
      }
      if (!response.ok) {
        const seconds = Number(response.headers.get('Retry-After'));
        if (Number.isFinite(seconds) && seconds > 0) setRetryAt(Date.now() + seconds * 1000);
        throw new Error('Releases are temporarily unavailable. Please try again shortly.');
      }
      const manifest = await response.json() as HostedDownloadManifest;
      const release = releaseFromManifest(manifest);
      const result: ReleasePage = { latest: release, releases: [release], nextPage: null, stale: false };
      if (signal.aborted) return;
      setData(result);
      setRetryAt(0); setRetrySeconds(0);
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : 'Release information could not be loaded.');
    } finally { if (!signal.aborted) setLoading(false); }
  }
  useEffect(() => {
    const controller = new AbortController(); pending.current = controller;
    void load(controller.signal);
    return () => pending.current?.abort();
  }, [retry]);
  const onDownload = (name: string) => setNotice(`Requesting ${name}. Your browser will show the download when it starts.`);
  const previous = data?.releases.filter(release => release.id !== data.latest?.id) ?? [];
  const latest = data?.latest;

  return <div className="downloads-page" data-pico-theme={theme.id} style={{ ...cssVariables(theme), '--download-on-accent': contrastRatio(theme.accent, '#000000') >= 4.5 ? '#000000' : '#ffffff' } as React.CSSProperties}>
    <div className="downloads-shell">
      <header className="downloads-header">
        <a className="downloads-brand" href="/" aria-label="Pico home"><img src="/pico-logo.svg" alt="" width="32" height="32" />Pico<span className="brand-period">.</span></a>
        <nav aria-label="Main navigation"><a href="/"><ArrowLeft size={16} aria-hidden="true" />Workspaces</a><a href="/downloads" aria-current="page">Downloads</a></nav>
      </header>
      <main id="downloads-main">
        <div className="downloads-intro"><span className="downloads-eyebrow">YOUR WORKSPACE, ON YOUR DESKTOP</span><h1>Download Pico<span>.</span></h1><p>Choose your installer and make yourself at home.<br />The latest release, all in one place.</p></div>
        {loading && !data && <div className="downloads-loading" role="status"><RefreshCw size={22} aria-hidden="true" /><p>Finding the latest Pico release…</p><div className="downloads-skeleton" aria-hidden="true" /></div>}
        {error && <div className="downloads-feedback" role="alert"><h2>We couldn’t load the release</h2><p>{error}</p><button className="downloads-secondary" disabled={loading || retrySeconds > 0} onClick={() => setRetry(value => value + 1)}><RefreshCw size={16} aria-hidden="true" />{retrySeconds > 0 ? `Try again in ${retrySeconds}s` : 'Try again'}</button></div>}
        {data?.stale && <p className="downloads-feedback" role="status">Showing the last available release information. Updates are temporarily unavailable.</p>}
        {latest && <section className="latest-release" aria-labelledby="latest-release-title">
          <div className="release-heading"><div><span className="release-badge"><Check size={13} aria-hidden="true" />Latest stable</span><h2 id="latest-release-title">{latest.name || latest.tag_name}</h2><div className="release-meta"><code>{latest.tag_name}</code><span aria-hidden="true">·</span><ReleaseDate value={latest.published_at} /></div></div><Package className="release-heading-icon" size={40} strokeWidth={1.25} aria-hidden="true" /></div>
          <p className="release-summary">{latest.body?.trim().split(/\r?\n\s*\r?\n/)[0] ? inlineNotes(latest.body.trim().split(/\r?\n\s*\r?\n/)[0]) : 'Choose from the files provided with this release.'}</p>
          <AssetGroups release={latest} onDownload={onDownload} />
          <details className="release-notes-disclosure"><summary><ChevronDown size={16} aria-hidden="true" />Release notes &amp; installation details</summary><ReleaseNotes body={latest.body} /></details>
        </section>}
        {data && !latest && <section className="downloads-feedback"><Package size={28} aria-hidden="true" /><h2>{data.releases.length ? 'No stable release yet' : 'The first release is on its way'}</h2><p>{data.releases.length ? 'Preview builds are listed below. They may include unfinished features.' : 'There are no published releases to download yet. You can keep using Pico in your browser.'}</p><a className="downloads-secondary" href="/">Open Pico<ArrowUpRight size={16} aria-hidden="true" /></a></section>}
        <p className="download-notice" role="status" aria-live="polite">{notice}</p>
        {data && <section className="release-history" aria-labelledby="release-history-title"><div className="release-history-heading"><div><span className="downloads-eyebrow">RELEASE ARCHIVE</span><h2 id="release-history-title">{latest ? 'Previous releases' : 'Available releases'}</h2></div><span>{previous.length} loaded</span></div>
          {previous.length === 0 ? <p className="downloads-empty-history">{data.nextPage ? 'More releases are available below.' : 'No previous releases to show yet. Future releases will appear here automatically.'}</p> : previous.map(release => <details className="release-history-item" key={release.id}><summary><ChevronDown size={18} aria-hidden="true" /><span className="release-history-name"><strong>{release.name || release.tag_name}</strong><code>{release.tag_name}</code></span><span className={`release-badge${release.prerelease ? ' release-badge-preview' : ''}`}>{release.prerelease ? 'Prerelease' : 'Stable'}</span><ReleaseDate value={release.published_at} /></summary><div className="release-history-body">{release.prerelease && <p className="downloads-preview-note">Preview release — may include unfinished features.</p>}<AssetGroups release={release} onDownload={onDownload} /><h3>Release notes</h3><ReleaseNotes body={release.body} /></div></details>)}
        </section>}
        <aside className="downloads-browser-note"><div><h2>Prefer to stay in your browser?</h2><p>Your Pico workspaces are always a click away.</p></div><a className="downloads-secondary" href="/">Open Pico<ArrowUpRight size={16} aria-hidden="true" /></a></aside>
      </main>
      <footer className="downloads-footer"><span>Pico<span className="brand-period">.</span></span><nav aria-label="Pico information"><a href="/#team">Pico Team</a><a href="/#privacy">Privacy</a><a href="https://github.com/mztaq/pico" target="_blank" rel="noopener noreferrer">Source code<span className="downloads-sr-only"> (opens in a new tab)</span><ArrowUpRight size={13} aria-hidden="true" /></a></nav></footer>
    </div>
  </div>;
}
