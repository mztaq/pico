export interface ReleaseAsset {
  id: number;
  name: string;
  label: string | null;
  size: number;
  content_type: string;
  state: string;
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
