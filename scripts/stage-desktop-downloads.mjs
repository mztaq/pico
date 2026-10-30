import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
const legacy=['Pico_x64-setup.exe','Pico_x64_en-US.msi','Pico_aarch64.dmg','Pico_x64.dmg','Pico_amd64.deb','Pico_amd64.AppImage'];
const onePerOs=['Pico_x64-setup.exe','Pico_universal.dmg','Pico_amd64.AppImage'];
const chunk=16*1024*1024;
const source=resolve(process.argv[2]??'release-binaries'), out=resolve(process.argv[3]??'public/download-assets');
await mkdir(out,{recursive:true});
const available=new Set(await readdir(source));
const names=onePerOs.every(name=>available.has(name))?onePerOs:
  legacy.every(name=>available.has(name))?legacy:null;
if(!names)throw new Error('Pico release assets must contain all three current installers or all six legacy installers');
const files={};
for(const name of names){
 const bytes=await readFile(join(source,name));
 const hash=createHash('sha256').update(bytes).digest('hex');
 const n=Math.ceil(bytes.length/chunk);
 for(let i=0;i<n;i++)await writeFile(join(out,name+'.part'+String(i).padStart(3,'0')),bytes.subarray(i*chunk,Math.min(bytes.length,(i+1)*chunk)));
 files[name]={size:bytes.length,sha256:hash,parts:n,version:'desktop-v0.1.0-build.10'};
 process.stdout.write(name+' '+n+' parts '+hash+'\n');
}
await writeFile(join(out,'manifest.json'),JSON.stringify({chunk,files},null,2)+'\n');
