#!/usr/bin/env node
/**
 * Real Chromium smoke test for Pico Arena. Node 24 builtins only.
 * Catches crashes caused by Canvas, React effects and 300ms simulation ticks,
 * which jsdom/vitest smoke tests do not run.
 *
 * Run with a Vite dev server listening on port 3000:
 *   pnpm dev
 *   node scripts/smoke-pico-arena.mjs
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const origin = process.env.PICO_SMOKE_URL || 'http://127.0.0.1:3000';
const path = '/app/learn?section=arena&mode=circuit';
const port = 29922 + Math.floor(Math.random() * 1000);
const chromeOptions = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
const chromeName = chromeOptions.find(candidate =>
  spawnSync('which', [candidate], { encoding: 'utf8' }).status === 0);
if (!chromeName) throw new Error('Chromium or Google Chrome not found for Arena browser smoke test.');

const profile = await mkdtemp(join(tmpdir(), 'pico-arena-smoke-'));
let chrome = null;
let socket = null;
let nextId = 1;
const pending = new Map();
const exceptions = [];

async function waitUntil(callback, description, timeout = 14000) {
  const started = Date.now();
  let lastError;
  while(Date.now() - started < timeout) {
    try {
      const value = await callback();
      if(value) return value;
    } catch(error) { lastError = error; }
    await sleep(130);
  }
  throw new Error('Timeout: ' + description + (lastError ? ' (' + String(lastError) + ')' : ''));
}
async function json(url) {
  const response = await fetch(url);
  if(!response.ok) throw new Error(url + ': HTTP ' + response.status);
  return response.json();
}
async function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const watchdog = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timed out')); }, 10000);
    pending.set(id, data => {
      clearTimeout(watchdog);
      if(data.error) reject(new Error(method + ': ' + data.error.message));
      else resolve(data.result);
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJS(expression) {
  const result = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true, userGesture: true,
  });
  if(result.exceptionDetails) throw new Error(
    'Page evaluation failed: ' + (result.exceptionDetails.text ?? '') + ' ' +
    (result.exceptionDetails.exception?.description ?? ''));
  return result.result?.value;
}
async function waitFor(selector, description, timeout = 14000) {
  return waitUntil(async () => {
    if(await evalJS('Boolean(document.querySelector(' + JSON.stringify(selector) + '))')) return true;
    if(await evalJS("Boolean(document.querySelector('.pico-load-error'))")) {
      const detail=await evalJS("document.querySelector('.pico-load-error')?.innerText");
      throw new Error('Pico displayed an error: ' + detail);
    }
    return false;
  }, description, timeout);
}
async function click(text) {
  const result = await evalJS('(() => { const button = [...document.querySelectorAll("button")]' +
    '.find(element => element.textContent?.trim().includes(' + JSON.stringify(text) + '));' +
    ' if(!button)return null;button.click();return button.textContent?.trim(); })()');
  if(!result) throw new Error('Could not click "' + text + '"');
  return result;
}

try {
  await waitUntil(async () => (await fetch(origin + '/app/learn')).ok,
    'Vite web server on ' + origin, 18000);

  chrome = spawn(chromeName, [
    '--headless=new','--disable-gpu','--no-sandbox',
    '--disable-dev-shm-usage','--disable-background-networking','--no-first-run',
    '--no-default-browser-check','--remote-debugging-port=' + port,
    '--user-data-dir=' + profile, 'about:blank',
  ], { stdio: 'ignore' });

  const targets = await waitUntil(async () => {
    const list = await json('http://127.0.0.1:' + port + '/json/list');
    return list.find(target => target.type === 'page' && target.webSocketDebuggerUrl);
  }, 'Chrome DevTools target');

  socket = new WebSocket(targets.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once:true });
    socket.addEventListener('error', reject, { once:true });
  });
  socket.addEventListener('message', event => {
    const data=JSON.parse(event.data);
    if(data.id && pending.has(data.id)) {
      const callback=pending.get(data.id);pending.delete(data.id);callback(data);
    }
    if(data.method==='Runtime.exceptionThrown') {
      const details=data.params?.exceptionDetails;
      const message=details?.exception?.description || details?.text || 'Unknown browser exception';
      exceptions.push(message);
      console.error('[BROWSER EXCEPTION]', message);
    }
    if(data.method==='Runtime.consoleAPICalled' && data.params?.type==='error') {
      const message=data.params.args?.map(arg=>arg.value || arg.description || '').join(' ');
      console.error('[BROWSER CONSOLE]',message);
    }
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate',{url:origin+path});

  await waitFor('.arena-intro','Arena intro loaded');
  console.log('Arena intro rendered');
  // React animation and effects update here; ensure intro stays mounted.
  await sleep(650);
  if(await evalJS("Boolean(document.querySelector('.pico-load-error'))"))
    throw new Error('Arena crashed after intro rendered.');

  await click('Solo');
  await waitFor('.arena-new-setup','solo setup');
  await click('Play solo');
  await waitFor('.defense-canvas-wrap canvas','solo defense canvas');
  await waitFor('.arena-earn-button','Earn charge button');
  console.log('Solo match mounted with real Canvas');

  // Reproduce the actual reported failure: hovering the Canvas schedules a
  // React state update. React's synthetic event.currentTarget becomes null
  // after the handler, so event values must be read synchronously.
  const bounds = await evalJS(`(() => {
    const canvas = document.querySelector('.defense-canvas-wrap canvas');
    canvas.scrollIntoView({block: 'center'});
    canvas.dataset.hoverEvents = '0';
    canvas.addEventListener('mousemove', () => {
      canvas.dataset.hoverEvents = String(Number(canvas.dataset.hoverEvents) + 1);
    });
    const r = canvas.getBoundingClientRect();
    return { x: r.left + r.width * .36, y: r.top + r.height * .48 };
  })()`);
  await send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: bounds.x, y: bounds.y, buttons: 0,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: bounds.x + 9, y: bounds.y + 7, buttons: 0,
  });
  await sleep(650);
  const hoverEvents = await evalJS("Number(document.querySelector('.defense-canvas-wrap canvas')?.dataset.hoverEvents || 0)");
  if(hoverEvents < 1) throw new Error('Mouse hover test failed to dispatch an event');
  if(await evalJS("Boolean(document.querySelector('.pico-load-error'))"))
    throw new Error('Arena crashed after hovering the battlefield: ' +
      await evalJS("document.querySelector('.pico-load-error').innerText"));
  console.log('Arena survived real mouse movement:', hoverEvents, 'events');

  // This catches the case reported by the user: briefly visible, then error.
  await sleep(2400);
  if(await evalJS("Boolean(document.querySelector('.pico-load-error'))"))
    throw new Error('Arena crashed after simulation ticks: ' +
      await evalJS("document.querySelector('.pico-load-error').innerText"));
  const timer=await evalJS("document.querySelector('.arena-clock')?.textContent?.trim()");
  if(!timer || timer === '00:00') throw new Error('Timer unexpectedly expired: '+timer);
  console.log('Solo match survived 2.4 seconds. Clock:', timer);

  await click('Earn charge');
  await waitFor('.arena-quiz-dialog','question overlay');
  await click('Back to game');
  if(await evalJS("Boolean(document.querySelector('.arena-quiz-dialog'))"))
    throw new Error('Question overlay did not close');
  if(exceptions.length) throw new Error(exceptions.length+' runtime JavaScript exceptions occurred.');
  console.log('PASS: deep-link, menu, solo, Canvas frames, mouse hover, timer, quiz and game return');
} finally {
  if(socket) socket.close();
  if(chrome) chrome.kill();
  await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:200});
}
