import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const services = [
  { id: 'website', name: 'Pico Website', status: 'degraded', history: Array(30).fill('up'), uptime30d: 100 },
  { id: 'mcp', name: 'Pico MCP', status: 'up', history: Array(30).fill('up'), uptime30d: 100 },
];
const issue = (status='investigating', resolvedAt=null) => ({
  id:'issue-1', title:'Flowchart zoom issue', reason:'Zoom out controls are not responding.',
  service:'Pico Website', serviceId:'website', status, resolvedAt, startedAt:'2026-11-22T14:00:00Z',
});
async function render(incidents: unknown[]) {
  const page = new JSDOM(html, {
    url:'https://status.example.test/',
    runScripts:'dangerously',
    beforeParse(window) {
      window.setInterval = (() => 1) as typeof window.setInterval;
      window.fetch = (async () => ({
        ok:true,
        json:async()=>({state:'connected',services,incidents,updatedAt:'2026-11-23T13:00:00Z'}),
      })) as typeof window.fetch;
    },
  });
  for(let i=0;i<8;i++) await new Promise(resolve=>setTimeout(resolve,0));
  return page;
}

describe('Pico Status active incident placement',()=>{
  it('shows an unresolved incident directly below overall status without redundant section labels',async()=>{
    const page=await render([issue()]);
    const doc=page.window.document;
    const panel=doc.querySelector<HTMLElement>('#active-incidents')!;
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toContain('Flowchart zoom issue');
    expect(panel.textContent).toContain('Investigating');
    expect(panel.textContent).toContain('Affected: Pico Website');
    expect(panel.textContent).toContain('Zoom out controls are not responding.');
    expect(panel.parentElement?.id).toBe('overall-panel');
    expect(panel.parentElement?.nextElementSibling?.querySelector('#services-heading')).not.toBeNull();
    expect(doc.querySelectorAll('#overall-panel .active-incident')).toHaveLength(1);
    expect(html).not.toContain('.overall::before');
    expect(html).not.toContain('.overall::after');
    expect(html).not.toContain('border-left: 4px solid var(--amber)');
    expect(panel.querySelectorAll('h2')).toHaveLength(0);
    expect(doc.querySelector('#incidents')?.textContent).not.toContain('Flowchart zoom issue');
    page.window.close();
  });
  it('hides the section when all incidents are resolved',async()=>{
    const page=await render([issue('resolved','2026-11-23T12:00:00Z')]);
    const doc=page.window.document;
    expect((doc.querySelector('#active-incidents') as HTMLElement).hidden).toBe(true);
    expect(doc.querySelector('#incidents')?.textContent).toContain('Flowchart zoom issue');
    page.window.close();
  });
  it('lists multiple active incidents newest first and keeps history separate',async()=>{
    const newer={...issue('monitoring'),id:'issue-2',title:'Second issue',startedAt:'2026-11-23T10:00:00Z'};
    const page=await render([issue(),newer,issue('resolved','2026-11-23T09:00:00Z')]);
    const doc=page.window.document;
    const titles=[...doc.querySelectorAll('#active-incidents h3')].map(n=>n.textContent);
    expect(titles).toEqual(['Second issue','Flowchart zoom issue']);
    expect(doc.querySelector('#incidents')?.textContent).toContain('Resolved');
    page.window.close();
  });
});
