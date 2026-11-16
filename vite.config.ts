import { defineConfig } from 'vite';

// Independent status build: no compilers, games, or large Pico public assets.
export default defineConfig({
  publicDir: 'status-assets',
  build: { emptyOutDir: true, outDir: 'dist' },
  server: { host: '0.0.0.0', port: 3000 },
  preview: { host: '0.0.0.0', port: 3000 },
});
