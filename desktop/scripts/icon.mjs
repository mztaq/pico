import sharp from 'sharp';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const desktop = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const logo = await readFile(resolve(desktop, '../public/pico-logo.svg'));
await mkdir(resolve(desktop, 'assets'), { recursive: true });
await sharp(logo, { density: 384 })
  .resize(1024, 1024)
  .png()
  .toFile(resolve(desktop, 'assets/icon.png'));
console.log('Generated Pico desktop icon.');
