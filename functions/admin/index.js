import {authorize,hidden} from '../_lib/status-admin-auth.js';

// Some Pages deployments resolve /admin/ through index.js and others through
// [[path]].js. Require the same auth check in both route handlers.
export async function onRequestGet(context) {
  const user=await authorize(context);
  if(user instanceof Response)return user;
  const asset=await context.env.ASSETS.fetch(new URL("/admin/",context.request.url));
  if(!asset.ok)return hidden();
  const response=new Response(asset.body,asset);
  response.headers.set("Cache-Control","private, no-store");
  response.headers.set("X-Robots-Tag","noindex, nofollow");
  return response;
}
