// Cover direct asset and /admin/index.html requests with the same session
// middleware. More-specific /admin/api and /admin/auth routes take priority.
export function onRequestGet(context) {
  const path=new URL(context.request.url).pathname;
  if(path==="/admin/index.html" || path==="/admin/admin.js" || path==="/admin/admin.css") {
    return context.next();
  }
  return new Response("Not found",{status:404});
}
