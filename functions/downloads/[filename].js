export async function onRequest({request,env,params}){
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 const filename=params.filename;
 if(!/^Pico_(?:x64-setup\.exe|x64_en-US\.msi|aarch64\.dmg|x64\.dmg|amd64\.deb|amd64\.AppImage)$/.test(filename))return new Response('Not found',{status:404});
 const manifestResponse=await env.ASSETS.fetch(new URL('/download-assets/manifest.json',request.url));
 if(!manifestResponse.ok)return new Response('Downloads not deployed',{status:503});
 const manifest=await manifestResponse.json();
 const file=manifest.files[filename];
 if(!file||!Number.isSafeInteger(file.size)||file.size<=0)return new Response('Installer unavailable',{status:503});
 const {size,sha256,parts}=file,chunk=manifest.chunk;
 if(!Number.isSafeInteger(chunk)||chunk<=0)return new Response('Invalid manifest',{status:503});
 const headers=new Headers({'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${filename}"`,'Accept-Ranges':'bytes','Cache-Control':'public, max-age=3600','ETag':'"'+sha256+'"'});
 let start=0,end=size-1,status=200;
 const range=request.headers.get('Range');
 if(range){
  const m=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(!m||(!m[1]&&!m[2]))return new Response('Range not satisfiable',{status:416,headers:{'Content-Range':'bytes */'+size}});
  if(m[1]){start=Number(m[1]);if(m[2])end=Number(m[2]);}
  else {const suffix=Number(m[2]);start=Math.max(0,size-suffix);}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||start>end)return new Response('Range not satisfiable',{status:416,headers:{'Content-Range':'bytes */'+size}});
  end=Math.min(size-1,end);
  status=206;headers.set('Content-Range',`bytes ${start}-${end}/${size}`);
 }
 headers.set('Content-Length',String(end-start+1));
 if(request.method==='HEAD')return new Response(null,{status,headers});
 const first=Math.floor(start/chunk),last=Math.floor(end/chunk);
 if(last>=parts)return new Response('Invalid manifest',{status:503});
 const stream=new ReadableStream({
  async start(controller){
   try{
    for(let i=first;i<=last;i++){
     const path='/download-assets/'+filename+'.part'+String(i).padStart(3,'0');
     const response=await env.ASSETS.fetch(new URL(path,request.url));
     if(!response.ok)throw Error('Missing part '+i);
     const bytes=new Uint8Array(await response.arrayBuffer());
     const from=i===first?start-i*chunk:0;
     const to=i===last?end-i*chunk+1:bytes.byteLength;
     const portion=bytes.subarray(from,to);
     if(portion.byteLength!==to-from)throw Error('Invalid part length '+i);
     controller.enqueue(portion);
    }
    controller.close();
   }catch(error){controller.error(error);}
  }
 });
 return new Response(stream,{status,headers});
}
