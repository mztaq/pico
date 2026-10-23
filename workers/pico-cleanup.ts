/**
 * Deploy this as a separate Cloudflare Worker with a D1 binding named DB.
 * Configure a daily Cron Trigger. Pages Functions themselves do not run cron.
 */
interface Env { DB:D1Database }
export default {
  async scheduled(_event:ScheduledEvent,env:Env,ctx:ExecutionContext):Promise<void> {
    ctx.waitUntil((async()=>{
      const timestamp=Math.floor(Date.now()/1000);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM pico_rate_limits WHERE expires_at < ?').bind(timestamp),
        env.DB.prepare('DELETE FROM pico_usage_events WHERE created_at < ?').bind(timestamp-7*86400),
        env.DB.prepare('DELETE FROM pico_usage_windows WHERE minute_bucket < ?').bind(Math.floor(timestamp/60)-1440),
        env.DB.prepare('DELETE FROM pico_consent WHERE expires_at < ?').bind(timestamp),
        env.DB.prepare('DELETE FROM pico_visitors WHERE expires_at < ?').bind(timestamp),
      ]);
    })());
  },
};
