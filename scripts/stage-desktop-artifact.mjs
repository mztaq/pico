/**
 * Prepare one consistently named installer per operating system.
 * This script intentionally does not publish or mutate any GitHub release.
 */
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const platforms = {
  windows: {directory:'src-tauri/target/release/bundle/nsis',suffix:'-setup.exe',output:'Pico_x64-setup.exe'},
  macos: {directory:'src-tauri/target/universal-apple-darwin/release/bundle/dmg',suffix:'.dmg',output:'Pico_universal.dmg'},
  linux: {directory:'src-tauri/target/release/bundle/appimage',suffix:'.AppImage',output:'Pico_amd64.AppImage'},
};
const platform = process.argv[2];
if (!Object.hasOwn(platforms,platform)) throw new Error('Expected windows, macos or linux');
const {directory,suffix,output} = platforms[platform];
const entries = (await readdir(directory)).filter(name=>name.endsWith(suffix));
if (entries.length !== 1) throw new Error(`Expected exactly one ${suffix} installer in ${directory}, found ${entries.join(', ') || 'none'}`);
const source = join(directory,entries[0]);
const info = await stat(source);
if (!info.isFile() || info.size === 0) throw new Error('Built installer is empty or missing: '+source);
await mkdir('release-staging',{recursive:true});
await copyFile(source,join('release-staging',output));
console.log(`Prepared ${output} (${info.size} bytes)`);
