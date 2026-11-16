import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Keep the status site separate from Pico's app bundle.
export default defineConfig({
  publicDir: 'status-assets',
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    rollupOptions: {
      input: {
        status: resolve(process.cwd(), 'index.html'),
        history: resolve(process.cwd(), 'history.html'),
      },
    },
  },
  server: { host: '0.0.0.0', port: 3000 },
  preview: { host: '0.0.0.0', port: 3000 },
});
