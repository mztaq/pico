import { github, json, UpstreamError, type FunctionContext } from '../../src/server/github.ts';
import type { Release, ReleasePage } from '../../src/releases/types.ts';

export async function onRequestGet(context: FunctionContext): Promise<Response> {
  const pageText = new URL(context.request.url).searchParams.get('page') ?? '1';
  if (!/^[1-9]\d{0,5}$/.test(pageText)) return json({ error: 'Invalid release page.' }, 400);
  const page = Number(pageText);
  try {
    const [listing, latest] = await Promise.all([
      github(`/releases?per_page=20&page=${page}`, context),
      github('/releases/latest', context),
    ]);
    if (!listing.response.ok) throw new UpstreamError(listing.response.status);
    const releases = (await listing.response.json() as Release[]).filter(release => !release.draft);
    const stable = latest.response.ok ? await latest.response.json() as Release : null;
    const data: ReleasePage = {
      latest: stable && !stable.draft && !stable.prerelease ? stable : null,
      releases,
      nextPage: listing.response.headers.get('Link')?.includes('rel="next"') ? page + 1 : null,
      stale: listing.stale || latest.stale,
    };
    return json(data);
  } catch (error) {
    return json({ error: 'Releases are temporarily unavailable. Please try again shortly.' }, 503,
      { 'Retry-After': error instanceof UpstreamError ? error.retryAfter : '60' });
  }
}
