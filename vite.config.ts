import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { PYODIDE_VERSION, PYODIDE_INDEX_URL } from './src/runtime/python/config.ts';

const headers = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };
// Serve the pinned npm runtime through the same origin in development and production.
// No runtime binaries are checked into git, and no third-party CDN is required.
const runtimeFiles: Record<string, string> = {
  'pyodide.mjs': 'text/javascript',
  'pyodide.asm.mjs': 'text/javascript',
  'pyodide.asm.wasm': 'application/wasm',
  'pyodide-lock.json': 'application/json',
  'python_stdlib.zip': 'application/zip',
};
function pythonRuntime(): Plugin {
  const require = createRequire(import.meta.url);
  const runtimeRoot = dirname(require.resolve('pyodide/package.json'));
  const installed = require('pyodide/package.json') as {version:string};
  if (installed.version !== PYODIDE_VERSION) throw new Error('Python runtime version does not match the pinned package.');
  let outDir = 'dist';
  let building = false;
  return {
    name: 'pico-python-runtime',
    configResolved(config) { building = config.command === 'build'; outDir = resolve(config.root, config.build.outDir); },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split('?')[0] ?? '';
        if (!path.startsWith(PYODIDE_INDEX_URL)) { next(); return; }
        const filename = path.slice(PYODIDE_INDEX_URL.length);
        if (!Object.hasOwn(runtimeFiles, filename)) { response.statusCode=404; response.end(); return; }
        response.setHeader('Content-Type', runtimeFiles[filename]);
        const stream = createReadStream(join(runtimeRoot, filename));
        stream.on('error', () => { response.statusCode=500; response.end('Python asset unavailable'); });
        stream.pipe(response);
      });
    },
    async closeBundle() {
      if (!building) return;
      const destination = join(outDir, PYODIDE_INDEX_URL.slice(1));
      await mkdir(destination, {recursive:true});
      await Promise.all(Object.keys(runtimeFiles).map(filename => copyFile(join(runtimeRoot, filename),join(destination, filename))));
    },
  };
}
export default defineConfig({
  plugins: [react(), pythonRuntime()],
  server: { host: '0.0.0.0', port: 3000, strictPort: true, allowedHosts: true, headers },
  preview: { host: '0.0.0.0', port: 3000, strictPort: true, allowedHosts: true, headers },
});
