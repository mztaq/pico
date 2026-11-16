import {authorize,validOrigin,redirect} from '../_lib/status-admin-auth.js';

export async function onRequest(context){
  const path=new URL(context.request.url).pathname;
  // These paths are responsible for starting and completing login themselves.
  if(path.startsWith("/admin/auth/"))return context.next();
  if(!validOrigin(context.request))return new Response("Not found",{status:404});
  const user=await authorize(context);
  if(user instanceof Response){
    const accept=context.request.headers.get("Accept")||"";
    if(context.request.method==="GET" && !path.startsWith("/admin/api/")
      && accept.includes("text/html"))return redirect("/admin/auth/start");
    return user;
  }
  context.data.picoAdminUser=user;
  return context.next();
}
