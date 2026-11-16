import { defineConfig } from 'vite';

// The status branch builds only the independent status page.
// Do not bundle Pico's compilers, games or offline runtime here.
export default defineConfig({
  build: { emptyOutDir: true },
  server: { host: '0.0.0.0', port: 3000 },
  preview: { host: '0.0.0.0', port: 3000 },
});
