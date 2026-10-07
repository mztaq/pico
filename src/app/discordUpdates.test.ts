import { describe, expect, it, vi } from 'vitest';
import { fetchDiscordUpdates, isBlockedContent } from './discordUpdates';

const config = { channelId: '1557441068629233694', botToken: 'test-token' };
const message = (id: string, content: string, timestamp: string, extra: Record<string, unknown> = {}) => ({
  id, content, timestamp, author: { id: `author-${id}`, username: 'member', ...((extra.author as object | undefined) ?? {}) },
  ...Object.fromEntries(Object.entries(extra).filter(([key]) => key !== 'author')),
});

function okResponse(payload: unknown) {
  return { ok: true, json: async () => payload } as Response;
}

describe('Discord updates', () => {
  it('rejects obvious profanity and basic spacing, punctuation, Unicode and repeat-character bypasses', () => {
    expect(isBlockedContent('F.U.C.K')).toBe(true);
    expect(isBlockedContent('f u c k')).toBe(true);
    expect(isBlockedContent('fuuuuck')).toBe(true);
    expect(isBlockedContent('аѕѕ')).toBe(true);
    expect(isBlockedContent('classroom classic')).toBe(false);
  });

  it('shows safe human posts only and sorts newest first with daily/weekly labels', async () => {
    const payload = [
      message('old', 'Weekly update: archive cleanup', '2026-10-01T10:00:00Z'),
      message('bot', 'Daily update: automated note', '2026-10-03T10:00:00Z', { author: { bot: true } }),
      message('unsafe', 'Please go k.i.l.l yourself', '2026-10-04T10:00:00Z'),
      message('hook', 'Daily update: webhook note', '2026-10-05T10:00:00Z', { webhook_id: 'webhook-1' }),
      message('new', '[Daily] Shipped a new tutorial', '2026-10-06T10:00:00Z'),
    ];
    const fetcher = vi.fn(async () => okResponse(payload));
    const updates = await fetchDiscordUpdates(config, fetcher as unknown as typeof fetch);
    expect(updates.map(({ id }) => id)).toEqual(['new', 'old']);
    expect(updates[0]?.category).toBe('daily');
    expect(updates[1]?.category).toBe('weekly');
    expect(JSON.stringify(updates)).not.toContain('yourself');
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/channels/1557441068629233694/messages?limit=100'), expect.objectContaining({ cache: 'no-store', credentials: 'omit' }));
  });

  it('does not make a request when configuration is missing', async () => {
    const fetcher = vi.fn();
    expect(await fetchDiscordUpdates({ channelId: '', botToken: '' }, fetcher as unknown as typeof fetch)).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('fails gracefully for an invalid response without exposing any response text', async () => {
    const fetcher = vi.fn(async () => okResponse({ unexpected: 'unsafe response text' }));
    const updates = await fetchDiscordUpdates({ channelId: '123456789012346', botToken: 'test-token' }, fetcher as unknown as typeof fetch);
    expect(updates).toEqual([]);
    expect(JSON.stringify(updates)).not.toContain('unsafe response text');
  });

  it('reuses only safe cached messages in memory if a later request fails', async () => {
    const channel = '1557441068629233694';
    await fetchDiscordUpdates({ channelId: channel, botToken: 'test-token' }, vi.fn(async () => okResponse([
      message('cached', 'Weekly update: safe note', '2026-10-01T10:00:00Z'),
    ])) as unknown as typeof fetch);
    const failed = vi.fn(async () => { throw new Error('network details must not be surfaced'); });
    const cached = await fetchDiscordUpdates({ channelId: channel, botToken: 'test-token' }, failed as unknown as typeof fetch);
    expect(cached.map(update => update.id)).toEqual(['cached']);
    expect(JSON.stringify(cached)).not.toContain('network details');
  });
});
