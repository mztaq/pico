import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DiscordConfig {
  channelId: string;
  botToken: string;
}

const defaultChannelId = '1557441068629233694';
const candidateFiles = ['.env', '.local.env', '.env.local'];

/** Parse the small dotenv subset used for Discord configuration, without logging values. */
export function parseDotEnv(text: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const sourceLine of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2]!.trim();
    const quote = value[0];
    if (quote === '"' || quote === "'") {
      const closingQuote = value.lastIndexOf(quote);
      const trailing = closingQuote > 0 ? value.slice(closingQuote + 1).trim() : '';
      if (closingQuote > 0 && (!trailing || trailing.startsWith('#'))) value = value.slice(1, closingQuote);
      else value = value.replace(/\s+#.*$/, '').trim();
      if (quote === '"') value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    parsed[match[1]!] = value;
  }
  return parsed;
}

/** Read local config files at Vite startup/build time. .env.local takes precedence over .local.env and .env. */
export function readDiscordConfig(projectRoot: string): DiscordConfig {
  const values: Record<string, string> = {};
  for (const filename of candidateFiles) {
    const filepath = join(projectRoot, filename);
    if (existsSync(filepath)) Object.assign(values, parseDotEnv(readFileSync(filepath, 'utf8')));
  }
  return {
    channelId: firstValue(values, ['DISCORD_CHANNEL_ID', 'PICO_DISCORD_CHANNEL_ID', 'VITE_PICO_DISCORD_CHANNEL_ID']) || defaultChannelId,
    botToken: firstValue(values, ['DISCORD_BOT_TOKEN', 'DISCORD_TOKEN', 'PICO_DISCORD_BOT_TOKEN', 'VITE_PICO_DISCORD_BOT_TOKEN']),
  };
}

function firstValue(values: Record<string, string>, keys: string[]): string {
  for (const key of keys) if (values[key]?.trim()) return values[key]!.trim();
  return '';
}
