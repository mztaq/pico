import {picoNotFound} from '../_lib/pico-not-found';

interface Context { request: Request; env: { ASSETS: { fetch: (request: Request) => Promise<Response> } } }

/** Catch nested, unsupported /app/... paths. More-specific app routes take priority. */
export async function onRequestGet({request,env}:Context):Promise<Response>{
  return picoNotFound({request,env});
}
