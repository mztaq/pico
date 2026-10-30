export interface ReleaseAsset {
  id: number;
  name: string;
  label: string | null;
  size: number;
  content_type: string;
  state: string;
}

export interface HostedDownloadManifest {
  chunk: number;
  release?: {
    version: string;
    title: string;
    publishedAt: string;
    prerelease: boolean;
    summary: string;
    notes: string;
  };
  files: Record<string, { size: number; sha256: string; parts: number; version: string }>;
}

export interface Release {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string | null;
  prerelease: boolean;
  draft: boolean;
  assets: ReleaseAsset[];
}

export interface ReleasePage {
  latest: Release | null;
  releases: Release[];
  nextPage: number | null;
  stale: boolean;
}

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Size unavailable';
  if (bytes < 1024) return `${bytes} B`;
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  return `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(bytes / 1024 ** unit)} ${['B', 'KiB', 'MiB', 'GiB'][unit]}`;
}

export function fileFormat(name: string): string {
  const extension = name.match(/\.(tar\.(?:gz|xz|bz2)|[a-z0-9]+)$/i)?.[1];
  return extension ? extension.toUpperCase() : 'File';
}

export function downloadableAssets(release: Release): ReleaseAsset[] {
  return release.assets.filter(asset => asset.state === 'uploaded');
}

export function releaseFromManifest(manifest: HostedDownloadManifest): Release {
  const hostedFiles = Object.entries(manifest.files ?? {});
  const fallbackVersion = hostedFiles[0]?.[1].version;
  const metadata = manifest.release ?? {
    version: fallbackVersion,
    title: 'Pico for Desktop',
    publishedAt: '2026-10-26T18:14:46Z',
    prerelease: false,
    summary: 'Pico is available for Windows, macOS, and Linux.',
    notes: 'Choose the installer for your operating system.',
  };
  if (typeof metadata.version !== 'string' || !metadata.version || typeof metadata.title !== 'string') throw new Error('Invalid release manifest');
  const assets = hostedFiles.map(([name, file], index) => {
    if (!name || !Number.isSafeInteger(file.size) || file.size <= 0 || !/^[0-9a-f]{64}$/.test(file.sha256) || file.version !== metadata.version) throw new Error('Invalid release file');
    return { id: index + 1, name, label: null, size: file.size, content_type: 'application/octet-stream', state: 'uploaded' };
  });
  return {
    id: 1,
    tag_name: metadata.version,
    name: metadata.title,
    body: [metadata.summary, metadata.notes].filter(Boolean).join('\n\n'),
    published_at: metadata.publishedAt,
    prerelease: metadata.prerelease,
    draft: false,
    assets,
  };
}
