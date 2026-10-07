import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseDotEnv, readDiscordConfig } from './discordConfig';

const temporaryRoots: string[] = [];
function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'pico-discord-config-'));
  temporaryRoots.push(root);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(root, name), text, 'utf8');
  return root;
}
afterEach(() => { while (temporaryRoots.length) rmSync(temporaryRoots.pop()!, { recursive: true, force: true }); });

describe('local Discord configuration files', () => {
  it('parses plain keys, quoted values, comments, exports, and escaped newlines', () => {
    expect(parseDotEnv('\uFEFF# comment\nexport DISCORD_CHANNEL_ID = 123 # channel\nDISCORD_BOT_TOKEN="secret.token\\npart" # token\nIGNORED LINE'))
      .toEqual({ DISCORD_CHANNEL_ID: '123', DISCORD_BOT_TOKEN: 'secret.token\npart' });
  });

  it('reads .env.local directly and accepts keys without a VITE_ prefix', () => {
    const root = fixture({ '.env.local': 'DISCORD_CHANNEL_ID=1557441068629233694\nDISCORD_BOT_TOKEN="test-token"\n' });
    expect(readDiscordConfig(root)).toEqual({ channelId: '1557441068629233694', botToken: 'test-token' });
  });

  it('supports .local.env and gives .env.local precedence without modifying either file', () => {
    const root = fixture({
      '.local.env': 'DISCORD_CHANNEL_ID=111111111111111111\nDISCORD_BOT_TOKEN=lower-priority\n',
      '.env.local': 'DISCORD_BOT_TOKEN=highest-priority\n',
    });
    const before = readDiscordConfig(root);
    expect(before).toEqual({ channelId: '111111111111111111', botToken: 'highest-priority' });
    expect(readDiscordConfig(root)).toEqual(before);
  });

  it('uses the supplied channel default and an empty token when no local file exists', () => {
    const root = fixture({});
    expect(readDiscordConfig(root)).toEqual({ channelId: '1557441068629233694', botToken: '' });
  });
});
