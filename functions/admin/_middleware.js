import {authorize,hidden} from '../_lib/status-admin-auth.js';

export async function onRequest(context){
  const path=new URL(context.request.url).pathname;
  // Authentication begins only via this separate private link, not /admin/.
  if(path==="/admin/auth/start"||path==="/admin/auth/callback"){
    if(context.request.method!=="GET")return hidden();
    return context.next();
  }
  const user=await authorize(context);
  if(user instanceof Response)return user;
  if(context.request.method!=="GET"&&context.request.method!=="POST")return hidden();
  return context.next();
}
