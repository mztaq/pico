import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const headers = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 3000, strictPort: true, allowedHosts: true, headers },
  preview: { host: '0.0.0.0', port: 3000, strictPort: true, allowedHosts: true, headers },
});
