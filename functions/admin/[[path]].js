import {authorize,hidden} from '../_lib/status-admin-auth.js';

// Pages routes /admin/ to this catch-all, not to /admin/index.js.
// Verify the session even when this handler is called independently.
export async function onRequestGet(context) {
  const user = await authorize(context);
  if(user instanceof Response) return user;

  const pathname=new URL(context.request.url).pathname;
  if(pathname==="/admin"||pathname==="/admin/"||pathname==="/admin/index"||pathname==="/admin/index.html"){
    // The Pages ASSETS binding requires the pretty URL, not index.html.
    // /admin/index.html would redirect back to /admin/ and fail here.
    const url=new URL("/admin/",context.request.url);
    const asset=await context.env.ASSETS.fetch(new Request(url.toString(),{method:"GET"}));
    if(!asset.ok)return hidden();
    const response=new Response(asset.body,asset);
    response.headers.set("Cache-Control","private, no-store");
    response.headers.set("X-Robots-Tag","noindex, nofollow");
    return response;
  }

  if(pathname==="/admin/admin.js"||pathname==="/admin/admin.css") {
    // These assets are protected by middleware and checked above.
    const asset=await context.env.ASSETS.fetch(context.request);
    if(!asset.ok)return hidden();
    const response=new Response(asset.body,asset);
    response.headers.set("Cache-Control","private, no-store");
    return response;
  }
  return hidden();
}
