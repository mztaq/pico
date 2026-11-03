type Env={PICO_OAUTH_ISSUER?:string;PICO_OAUTH?:unknown};
export function onRequestGet({env}: {env:Env}):Response {
  if(!env.PICO_OAUTH_ISSUER || !env.PICO_OAUTH)
    return new Response('OAuth not configured',{status:404,headers:{'cache-control':'no-store'}});
  try {
    const issuer=new URL(env.PICO_OAUTH_ISSUER);
    if(issuer.protocol!=='https:' || issuer.username || issuer.password || issuer.search || issuer.hash)
      throw Error('Invalid issuer');
    return Response.json({
      resource:'https://picompiler.pages.dev/app/mcp',
      authorization_servers:[issuer.origin],
      scopes_supported:['mcp:run'],
      bearer_methods_supported:['header'],
    },{headers:{'cache-control':'no-store','access-control-allow-origin':'*'}});
  } catch {return new Response('OAuth issuer misconfigured',{status:503});}
}
