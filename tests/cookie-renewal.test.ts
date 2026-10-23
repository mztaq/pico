import {describe,it,expect} from 'vitest';
import {clearCookie, renewedCookieHeaders, setCookie} from '../functions/_lib/core';

describe('Pico anonymous cookie renewal',()=>{
  const token='a'.repeat(43);
  it('renews a cookie only when there is a valid visitor cookie',()=>{
    const request=new Request('https://pico.example/api/usage',{
      headers:{Cookie:'__Host-pico_id='+token}
    });
    const headers=new Headers(renewedCookieHeaders(request));
    expect(headers.get('set-cookie')).toBe(setCookie(token));
    expect(headers.get('set-cookie')).toContain('Max-Age=7776000');
    expect(headers.get('set-cookie')).toContain('Secure; HttpOnly; SameSite=Lax');
  });
  it('never creates a visitor identifier for an anonymous request',()=>{
    const request=new Request('https://pico.example/api/usage');
    expect(new Headers(renewedCookieHeaders(request)).has('set-cookie')).toBe(false);
  });
  it('uses a clearing cookie when optional tracking is rejected',()=>{
    expect(clearCookie).toContain('Max-Age=0');
  });
});
