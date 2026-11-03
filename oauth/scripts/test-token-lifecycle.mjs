#!/usr/bin/env node
/**
 * Browser-assisted OAuth lifecycle smoke test.
 * Uses a fresh, isolated DCR client. Never prints access/refresh tokens or auth codes.
 * Run: node oauth/scripts/test-token-lifecycle.mjs
 * Optional expiry test: PICO_TEST_WAIT_FOR_EXPIRY=1 node oauth/scripts/test-token-lifecycle.mjs
 */
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { platform } from 'node:os';

const issuer = process.env.PICO_TEST_ISSUER || 'https://pico-oauth.mztaq.workers.dev';
const resource = process.env.PICO_TEST_RESOURCE || 'https://feat-pico-mcp-github-oauth.picompiler.pages.dev/app/mcp';
const waitForExpiry = process.env.PICO_TEST_WAIT_FOR_EXPIRY === '1';
const fail = message => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };
const base64url = bytes => Buffer.from(bytes).toString('base64url');
const sha256 = value => base64url(createHash('sha256').update(value).digest());
const postForm = (url, form) => fetch(url, {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(form), redirect: 'manual',
});
const json = async response => {
  const value = await response.json().catch(() => null);
  assert(value && typeof value === 'object', 'Expected JSON response, got HTTP ' + response.status);
  return value;
};
const check = (condition, name) => {
  assert(condition, name + ' failed');
  console.log('PASS ' + name);
};
const toolList = token => fetch(resource, {
  method: 'POST',
  headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
});
const sleep = seconds => new Promise(resolve => setTimeout(resolve, seconds * 1000));

function launchBrowser(url) {
  const os = platform();
  // Print the link on Windows instead of routing an OAuth URL through cmd.exe.
  if (os === 'win32') {
    console.log('Open this URL in your browser: ' + url);
    return;
  }
  const command = os === 'darwin' ? 'open' : 'xdg-open';
  const args = [url];
  const child = spawn(command, args, { stdio: 'ignore', windowsHide: true });
  child.on('error', () => console.log('Open this URL in your browser: ' + url));
  child.unref();
}

let listener;
try {
  const discovery = await json(await fetch(issuer + '/.well-known/oauth-authorization-server'));
  assert(discovery.issuer === issuer, 'OAuth issuer mismatch');
  assert(discovery.authorization_endpoint && discovery.token_endpoint && discovery.registration_endpoint && discovery.revocation_endpoint, 'Missing OAuth endpoints');
  assert(discovery.grant_types_supported?.includes('refresh_token'), 'Refresh grant not advertised');
  assert(discovery.code_challenge_methods_supported?.includes('S256'), 'PKCE S256 not advertised');
  check(true, 'OAuth discovery, refresh support and PKCE');

  const state = base64url(randomBytes(24));
  const verifier = base64url(randomBytes(32));
  const challenge = sha256(verifier);
  let callbackResolve;
  let callbackReject;
  const callback = new Promise((resolve, reject) => { callbackResolve = resolve; callbackReject = reject; });
  listener = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname !== '/callback') { res.writeHead(404).end(); return; }
    const receivedState = url.searchParams.get('state');
    if (receivedState !== state) {
      res.writeHead(400).end('State mismatch. Close this tab.');
      callbackReject(new Error('OAuth state mismatch')); return;
    }
    const code = url.searchParams.get('code');
    if (!code) {
      res.writeHead(400).end('OAuth denied. Close this tab.');
      callbackReject(new Error('OAuth authorization denied')); return;
    }
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end('Pico OAuth test received authorization. Return to your terminal.');
    callbackResolve(code);
  });
  await new Promise((resolve, reject) => listener.once('error', reject).listen(0, '127.0.0.1', resolve));
  const redirectUri = 'http://127.0.0.1:' + listener.address().port + '/callback';

  const registrationResponse = await fetch(discovery.registration_endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Pico OAuth lifecycle test (temporary)',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  });
  const registration = await json(registrationResponse);
  assert(registrationResponse.ok && registration.client_id, 'Dynamic registration failed: HTTP ' + registrationResponse.status);
  check(true, 'Independent OAuth client registration');

  const authorization = new URL(discovery.authorization_endpoint);
  Object.entries({
    response_type: 'code', client_id: registration.client_id, redirect_uri: redirectUri,
    scope: 'mcp:run offline_access', resource, state,
    code_challenge: challenge, code_challenge_method: 'S256',
  }).forEach(([key, value]) => authorization.searchParams.set(key, value));
  console.log('Approve the GitHub login in your browser to continue the test.');
  launchBrowser(authorization.href);
  const code = await callback;
  listener.close(); listener = null;
  const exchange = await postForm(discovery.token_endpoint, {
    grant_type: 'authorization_code', client_id: registration.client_id,
    redirect_uri: redirectUri, code, code_verifier: verifier, resource,
  });
  const issued = await json(exchange);
  assert(exchange.ok && issued.access_token && issued.refresh_token, 'Token issuance failed: HTTP ' + exchange.status);
  check(true, 'Authorization code issuance with PKCE and refresh token');

  const access = await toolList(issued.access_token);
  const accessBody = await json(access);
  check(access.status === 200 && Array.isArray(accessBody.result?.tools), 'New access token accesses Pico tools');

  const refresh = await postForm(discovery.token_endpoint, {
    grant_type: 'refresh_token', client_id: registration.client_id,
    refresh_token: issued.refresh_token, resource,
  });
  const rotated = await json(refresh);
  check(refresh.ok && rotated.access_token && rotated.refresh_token && rotated.access_token !== issued.access_token, 'Refresh issues a new access token');
  const refreshedUse = await toolList(rotated.access_token);
  check(refreshedUse.status === 200, 'Refreshed token accesses Pico tools');

  if (waitForExpiry) {
    assert(Number.isFinite(issued.expires_in) && issued.expires_in > 0, 'Token expiry missing');
    console.log('Waiting ' + (issued.expires_in + 5) + ' seconds to test access-token expiry...');
    await sleep(issued.expires_in + 5);
    const expired = await toolList(issued.access_token);
    check(expired.status === 401, 'Expired access token is rejected');
  } else {
    console.log('SKIP real-time expiry: rerun with PICO_TEST_WAIT_FOR_EXPIRY=1 (usually about one hour).');
  }

  // Revocation applies only to the token/grant created by this test client.
  const revoke = await postForm(discovery.revocation_endpoint, {
    client_id: registration.client_id, token: rotated.refresh_token,
    token_type_hint: 'refresh_token',
  });
  check(revoke.ok, 'Refresh-token revocation endpoint accepts request');
  const afterRevocation = await postForm(discovery.token_endpoint, {
    grant_type: 'refresh_token', client_id: registration.client_id,
    refresh_token: rotated.refresh_token, resource,
  });
  check(afterRevocation.status === 400, 'Revoked refresh token is rejected');
  const revokedAccess = await toolList(rotated.access_token);
  check(revokedAccess.status === 401, 'Revoked grant no longer accesses Pico tools');
  console.log('Lifecycle tests complete. No tokens were printed.');
} catch (error) {
  console.error('FAIL ' + (error instanceof Error ? error.message : 'Unknown test error'));
  process.exitCode = 1;
} finally {
  if (listener) listener.close();
}
