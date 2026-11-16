import {authorize,hidden} from '../_lib/status-admin-auth.js';

// All admin HTML, scripts and API endpoints are private.
// Unknown devices get the same plain 404 response, with no sign-in UI.
export async function onRequest(context){
  const user=await authorize(context);
  if(user instanceof Response)return user;
  if(context.request.method!=="GET" && context.request.method!=="POST")
    return hidden();
  return context.next();
}
