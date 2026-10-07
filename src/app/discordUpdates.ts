export interface DiscordUpdate {
  id: string;
  content: string;
  timestamp: string;
  category: 'daily' | 'weekly' | 'update';
}

export interface DiscordUpdatesConfig {
  channelId: string;
  botToken: string;
}

interface DiscordMessage {
  id?: unknown;
  content?: unknown;
  timestamp?: unknown;
  author?: { bot?: unknown } | null;
  webhook_id?: unknown;
}

// Add/remove terms here to tune the fail-closed content filter. This is a lexical
// blocklist, not a semantic moderation service; it cannot reliably identify all
// harmful context or every possible obfuscation.
export const DEFAULT_BLOCKLIST: readonly string[] = [
  'fuck', 'shit', 'bitch', 'bastard', 'ass', 'asshole', 'cunt', 'dickhead', 'motherfucker',
  'kill yourself', 'go kill yourself', 'make a bomb', 'build a bomb', 'child sexual abuse',
  'sexualize a minor', 'racial slur',
];

const confusables: Record<string, string> = {
  'а': 'a', 'α': 'a', 'е': 'e', 'ε': 'e', 'і': 'i', 'ι': 'i', 'ј': 'j', 'κ': 'k',
  'м': 'm', 'ո': 'n', 'ο': 'o', 'о': 'o', 'р': 'p', 'ρ': 'p', 'с': 'c', 'ϲ': 'c',
  'ѕ': 's', 'τ': 't', 'у': 'y', 'х': 'x', 'в': 'b', 'ԁ': 'd', 'ɡ': 'g',
};
const substitutions: Record<string, string> = {
  '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a',
  '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b',
};

function normalizeForFilter(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[аαеεіιјκмոοорρсϲѕτухвԁɡ]/gu, character => confusables[character] ?? character)
    .replace(/[0134!|@57$+8]/g, character => substitutions[character] ?? character);
}

/** Returns true for a blocklist match, including common spacing/punctuation and character substitutions. */
export function isBlockedContent(content: string, blocklist: readonly string[] = DEFAULT_BLOCKLIST): boolean {
  const normalized = normalizeForFilter(content);
  return blocklist.some(term => {
    const compact = normalizeForFilter(term).replace(/[^a-z0-9]/g, '');
    if (!compact) return false;
    // Permit punctuation/spacing between letters while requiring word boundaries.
    const expression = new RegExp(`(?<![a-z0-9])${[...compact].map(character => `${character}+`).join('[^a-z0-9]*')}(?![a-z0-9])`);
    return expression.test(normalized);
  });
}

function categoryFor(content: string): DiscordUpdate['category'] {
  const start = content.slice(0, 180);
  if (/^\s*(?:\[(?:daily)\]|daily\s+(?:update|log)\b|📅\s*daily\b)/i.test(start)) return 'daily';
  if (/^\s*(?:\[(?:weekly)\]|weekly\s+(?:update|log)\b|🗓️?\s*weekly\b)/i.test(start)) return 'weekly';
  return 'update';
}

const lastAcceptedByChannel = new Map<string, DiscordUpdate[]>();

/** Fetches at most Discord's latest 100 channel messages on page entry; no polling or browser storage. */
export async function fetchDiscordUpdates(
  config: DiscordUpdatesConfig,
  fetcher: typeof fetch = fetch,
): Promise<DiscordUpdate[]> {
  const channelId = config.channelId.trim();
  const botToken = config.botToken.trim();
  if (!/^\d{15,22}$/.test(channelId) || !botToken) return lastAcceptedByChannel.get(channelId) ?? [];
  const cached = () => lastAcceptedByChannel.get(channelId) ?? [];

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(`https://discord.com/api/v10/channels/${channelId}/messages?limit=100`, {
      method: 'GET',
      headers: { Authorization: `Bot ${botToken}`, Accept: 'application/json' },
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });
    if (!response.ok) return cached();
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return cached();

    const accepted: DiscordUpdate[] = [];
    for (const item of payload as DiscordMessage[]) {
      if (!item || typeof item !== 'object') continue;
      // Reject bots, webhooks, and malformed/unattributed messages: only identifiable human posts qualify.
      if (!item.author || item.author.bot === true || item.webhook_id) continue;
      if (typeof item.id !== 'string' || typeof item.content !== 'string' || typeof item.timestamp !== 'string') continue;
      const parsedTime = Date.parse(item.timestamp);
      if (!Number.isFinite(parsedTime) || isBlockedContent(item.content)) continue;
      const content = item.content.trim();
      if (!content) continue;
      accepted.push({ id: item.id, content, timestamp: new Date(parsedTime).toISOString(), category: categoryFor(content) });
    }
    accepted.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    lastAcceptedByChannel.set(channelId, accepted);
    return accepted;
  } catch {
    // A missing channel, failed request, timeout, or invalid response must not disrupt Pico.
    return cached();
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function configuredDiscordUpdates(): DiscordUpdatesConfig {
  return __PICO_DISCORD_CONFIG__;
}
