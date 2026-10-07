import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const canonicalPath = resolve(projectRoot, 'logs.txt');
const servedPath = resolve(projectRoot, 'public/logs.txt');
const args = process.argv.slice(2);
const dateArgIndex = args.indexOf('--date');
const now = new Date();
let date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
if (dateArgIndex >= 0) {
  date = args[dateArgIndex + 1] ?? '';
  args.splice(dateArgIndex, 2);
}
const update = args.join(' ').trim().replace(/\s+/g, ' ').toUpperCase();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
  console.error('Use a real calendar date in YYYY-MM-DD format (option: --date YYYY-MM-DD).');
  process.exit(1);
}
if (!update || /[\r\n]/.test(update) || update.includes('] :')) {
  console.error('Provide one update message, for example: npm run update:log -- "IMPROVED UI"');
  process.exit(1);
}

const line = `[${date}] : ${update}`;
let current = '';
try { current = await readFile(canonicalPath, 'utf8'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await mkdir(dirname(canonicalPath), { recursive: true });
await appendFile(canonicalPath, `${current && !current.endsWith('\n') ? '\n' : ''}${line}\n`, 'utf8');
const updated = `${current}${current && !current.endsWith('\n') ? '\n' : ''}${line}\n`;
await writeFile(servedPath, updated, 'utf8');
console.log(`Appended: ${line}`);
