import {fail, json, type Context} from '../_lib/core';
export const onRequestGet = async ({env}: Context): Promise<Response> =>
  env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY
    ? json({siteKey: env.TURNSTILE_SITE_KEY})
    : fail(503, 'Verification is not configured');
