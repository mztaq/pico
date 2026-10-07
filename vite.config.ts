import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDiscordConfig } from './scripts/discordConfig.ts';

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  define: { __PICO_DISCORD_CONFIG__: JSON.stringify(readDiscordConfig(projectRoot)) },
  plugins: [react()],
  server: { host: '0.0.0.0', port: 3000, strictPort: true, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 3000, strictPort: true, allowedHosts: true },
});
