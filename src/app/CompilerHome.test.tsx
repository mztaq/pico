// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import type { ExecutionCallbacks, ExecutionJob } from '../runtime/runner';
import type { ExecutionReply } from '../runtime/worker';
import { preloadPythonRuntime } from '../runtime/python/runner';
import type { PythonRequest } from '../runtime/python/config';
const jobs=vi.hoisted(()=>[] as {request:PythonRequest;callbacks:ExecutionCallbacks;job:ExecutionJob;finish:(value:ExecutionReply[])=>void}[]);
vi.mock('./components/pico-connection',()=>({picoIsOnline:vi.fn().mockResolvedValue(true)}));
vi.mock('./components/CodeEditor',()=>({CodeEditor:({value,onChange,language,preferences}:{value:string;onChange:(value:string)=>void;language:string;preferences:{fontSize:number}})=><textarea aria-label={`${language} editor`} data-font-size={preferences.fontSize} value={value} onInput={event=>onChange(event.currentTarget.value)} />}));
vi.mock('../runtime/python/runner',()=>({preloadPythonRuntime:vi.fn(),startPythonExecution:(request:PythonRequest,callbacks:ExecutionCallbacks)=>{
  let finish!:(value:ExecutionReply[])=>void;const promise=new Promise<ExecutionReply[]>(resolve=>{finish=resolve;});
  const job={promise,cancel:vi.fn(()=>finish([{error:{code:'cancelled',message:'Execution stopped.'}}])),provideInput:vi.fn(()=>true)};
  jobs.push({request,callbacks,job,finish});return job;
}}));
let container:HTMLDivElement,root:Root;
const button=(text:string)=>[...container.querySelectorAll('button')].find(b=>b.textContent?.trim()===text)!;
const click=async(element:HTMLElement)=>{
  const chosen=element.classList.contains('compiler-choice') ? element.querySelector('h2')?.textContent : '';
  await act(async()=>element.click());
  // Lazy visual workspaces resolve asynchronously; wait for the actual UI, not the loading fallback.
  if(chosen==='Logic Sim') await vi.waitFor(()=>expect(container.querySelector('.logic-app')).not.toBeNull());
  if(chosen==='CPU Studio') await vi.waitFor(()=>expect(container.querySelector('.cpu-app')).not.toBeNull());
  if(chosen==='Flowchart Builder') await vi.waitFor(()=>expect(container.querySelector('.flow-builder')).not.toBeNull());
  if(chosen==='Binary Lab') await vi.waitFor(()=>expect(container.querySelector('.binary-app')).not.toBeNull());
};
const switchViaHome=async(language:'Python Compiler'|'Pseudocode Compiler')=>{
  await click(container.querySelector<HTMLElement>('[aria-label="Go to home screen"]')!);
  await choose(language);
};
const choose=async(language:string)=>{await click(container.querySelector(`.compiler-choice h2`)?.textContent===language?container.querySelector<HTMLElement>('.compiler-choice')!:container.querySelectorAll<HTMLElement>('.compiler-choice')[1]!);};
async function type(element:HTMLInputElement|HTMLTextAreaElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(element instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLTextAreaElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));});}
beforeEach(async()=>{
  localStorage.clear();localStorage.setItem('pico.visitCount.v1','3');localStorage.setItem('pico.python.visitCount.v1','3');jobs.length=0;
  // Each test must start at the workspace home. Tests that visit /app/games,
  // /app/cpu or /app/report must not leak their URL into the next case.
  window.history.replaceState(null, '', '/app');
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root.render(<App/>));
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('opens on a themed home screen with all workspace choices',()=>{
  expect(document.title).toBe('Pico | Home');
  expect(container.querySelector('.pico-home h1')?.textContent).toBe('Choose your workspace');
  expect(container.querySelector('.pico-home-glass')).not.toBeNull();
  expect(container.querySelector('.pico-home-fluid')?.getAttribute('aria-hidden')).toBe('true');
  expect(container.querySelector('.pico-home-curves')).not.toBeNull();
  expect(container.querySelector('.pico-home-fluid canvas')).toBeNull();
  expect(container.textContent).not.toContain('YOUR COMPUTER SCIENCE WORKBENCH');
  expect(container.textContent).not.toContain('What will you build today?');
  expect(container.querySelector('.pico-home')?.getAttribute('data-pico-theme')).toBe('catppuccin-mocha');
  expect([...container.querySelectorAll('.compiler-choice h2')].map(h=>h.textContent)).toEqual(['Pseudocode Compiler','Python Compiler','Flowchart Builder','Logic Sim','CPU Studio','Traffic Storm','Binary Lab']);
  expect(container.querySelector('footer')).toBeNull();
  expect(container.querySelector('nav[aria-label="Pico information"] a[href="/app/team"]')?.textContent).toBe('Pico Team');
  expect(container.querySelector('nav[aria-label="Pico information"] a[href="/app/privacy"]')?.textContent).toBe('Privacy Policy');
  expect(container.querySelector('nav[aria-label="Pico information"] a[href="/app/terms"]')?.textContent).toBe('Terms and Conditions');
  expect(container.querySelector('.compiler-choices .syntax-keyword')).not.toBeNull();
});
it('resets test navigation after visiting Games', async()=>{
  const gamesLink=container.querySelector<HTMLAnchorElement>('a.home-games-link[href="/app/games"]')!;
  await click(gamesLink);
  expect(window.location.pathname).toBe('/app/games');
  // The next test's beforeEach restores /app regardless of this URL.
});
it('opens the Games library from home and returns to the workspace chooser', async()=>{
  expect(container.querySelector('.home-group[aria-label="Games"]')).toBeNull();
  expect(container.querySelector('.home-group--visual')?.textContent).not.toContain('Blackout Protocol');
  const gamesLink=container.querySelector<HTMLAnchorElement>('a.home-games-link[href="/app/games"]')!;
  expect(gamesLink).not.toBeNull();
  await click(gamesLink);
  expect(window.location.pathname).toBe('/app/games');
  expect(document.title).toBe('Pico | Games');
  expect(container.querySelector('.pico-games h1')?.textContent).toBe('Games');
  expect(container.querySelector('.pico-home-glass')).toBeNull();
  expect(container.querySelector('.pico-home-fluid')).toBeNull();
  expect(container.querySelector('.pico-home-curves')).not.toBeNull();
  const header=container.querySelector('.pico-games-nav')!;
  expect(header.firstElementChild?.classList.contains('pico-games-brand')).toBe(true);
  expect(header.lastElementChild?.classList.contains('pico-games-back')).toBe(true);
  expect(container.querySelector('.pico-games-eyebrow')).toBeNull();
  expect(container.querySelector('.pico-games-section-heading')).toBeNull();
  expect(container.querySelector('.pico-games-footnote')).toBeNull();
  expect(container.querySelector('.pico-games-type')).toBeNull();
  expect(container.querySelector('.pico-games-details')).toBeNull();
  expect([...container.querySelectorAll<HTMLAnchorElement>('.pico-games-card')].map(card=>card.href.endsWith('/app/game/blackout-protocol'))).toEqual([true]);
  expect(container.querySelector('.pico-games-card h3')?.textContent).toBe('Blackout Protocol');
  await click(container.querySelector<HTMLElement>('.pico-games-back')!);
  expect(window.location.pathname).toBe('/app');
  expect(container.querySelector('.pico-home h1')?.textContent).toBe('Choose your workspace');
});
it('handles a direct /app/games URL and browser navigation',async()=>{
  await act(async()=>{
    window.history.pushState(null,'','/app/games');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(container.querySelector('.pico-games')).not.toBeNull();
  expect(document.title).toBe('Pico | Games');
  await act(async()=>{
    window.history.pushState(null,'','/app');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(container.querySelector('.pico-games')).toBeNull();
  expect(container.querySelector('.home-hero h1')?.textContent).toBe('Choose your workspace');
});
it('uses the Pico logo to return to Workspaces from Games and the compiler',async()=>{
  await click(container.querySelector<HTMLElement>('a.home-games-link[href="/app/games"]')!);
  expect(window.location.pathname).toBe('/app/games');
  await click(container.querySelector<HTMLElement>('.pico-games-brand')!);
  expect(window.location.pathname).toBe('/app');
  await choose('Python Compiler');
  expect(window.location.pathname).toBe('/app/python');
  await click(container.querySelector<HTMLElement>('.pico-brand-home[aria-label="Pico, back to Workspaces"]')!);
  expect(window.location.pathname).toBe('/app');
  expect(container.querySelector('.home-hero h1')?.textContent).toBe('Choose your workspace');
});
it('shows three matching concept developer cards and prominent co-founders',async()=>{
  await act(async()=>{
    window.location.hash='#team';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  expect(container.querySelector('.team-group-title')?.textContent).toBe('Co-founders');
  expect(container.querySelector('.team-group-title--concept')?.textContent).toBe('Concept Developers');
  expect([...container.querySelectorAll('.author-card--founder h3')].map(node=>node.textContent)).toEqual(['Muhammad Mustaqim','Amar Ayache']);
  expect([...container.querySelectorAll('.author-card:not(.author-card--founder) h3')].map(node=>node.textContent)).toEqual(['Mohamed Hamza','Mithunan Yogeswaran','Coming soon...']);
  expect(container.querySelectorAll('.author-card')).toHaveLength(5);
  await act(async()=>{
    window.location.hash='';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
});
it('changes the theme from home and saves it for workspaces',async()=>{
  const toggle=container.querySelector<HTMLButtonElement>('[aria-label="Change theme"]')!;
  expect(toggle).not.toBeNull();
  expect(toggle.closest('.home-theme-anchor')?.parentElement?.classList.contains('home-nav')).toBe(true);
  expect(container.querySelector('.home-updates .home-theme-anchor')).toBeNull();
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  await click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  const nord=[...container.querySelectorAll<HTMLButtonElement>('.home-theme-menu [role="option"]')].find(option=>option.textContent?.includes('Nord'))!;
  expect(nord).not.toBeNull();
  await click(nord);
  expect(container.querySelector('.pico-home')?.getAttribute('data-pico-theme')).toBe('nord');
  expect(JSON.parse(localStorage.getItem('pico.settings.v6') ?? '{}').theme).toBe('nord');
  expect(container.querySelector('.home-theme-menu [aria-selected="true"]')?.textContent).toContain('Nord');
  await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(container.querySelector('.home-theme-menu')).toBeNull();
  const pseudocode=[...container.querySelectorAll<HTMLElement>('.compiler-choice')].find(choice=>choice.querySelector('h2')?.textContent==='Pseudocode Compiler')!;
  await click(pseudocode);
  expect(container.querySelector('.pico-app')?.getAttribute('data-pico-theme')).toBe('nord');
});
it('opens Binary Lab from its home section and updates every number view',async()=>{
  const choice=[...container.querySelectorAll<HTMLElement>('.compiler-choice')].find(item=>item.querySelector('h2')?.textContent==='Binary Lab');
  await click(choice!);
  expect(container.querySelector('#binary-tour-title')?.textContent).toBe('Binary Lab');
  await click(container.querySelector<HTMLElement>('.binary-tour-actions button')!);
  expect(container.querySelector('.binary-tour')).toBeNull();
  expect(localStorage.getItem('pico.binary.tutorial.v1')).toBe('done');
  expect(document.title).toBe('Pico | Binary Lab');
  expect(container.querySelector<HTMLInputElement>('[aria-label="Unsigned decimal value"]')?.value).toBe('42');
  await click(container.querySelector<HTMLElement>('[aria-label="Toggle bit 7, value 128"]')!);
  expect(container.querySelector<HTMLInputElement>('[aria-label="Unsigned decimal value"]')?.value).toBe('170');
  expect(container.querySelector<HTMLInputElement>('[aria-label="Hexadecimal value"]')?.value).toBe('AA');
  expect(container.querySelector('output[aria-label="Two’s complement signed value"]')?.textContent).toBe('-86');
  await click(container.querySelector<HTMLElement>('[aria-label="Back to Pico"]')!);
  expect(container.querySelector('.pico-home')).not.toBeNull();
  await click([...container.querySelectorAll<HTMLElement>('.compiler-choice')].find(item=>item.querySelector('h2')?.textContent==='Binary Lab')!);
  expect(container.querySelector('.binary-tour')).toBeNull();
  await click(container.querySelector<HTMLElement>('[aria-label="Open Binary Lab tutorial"]')!);
  expect(container.querySelector('#binary-tour-title')?.textContent).toBe('Binary Lab');
  await click(container.querySelector<HTMLElement>('.binary-tour-next')!);
  expect(container.querySelector('#binary-tour-title')?.textContent).toBe('Toggle bits');
});
it('shows the Logic Sim workspace without a personal footer',async()=>{
  const choice=[...container.querySelectorAll<HTMLElement>('.compiler-choice')].find(item=>item.querySelector('h2')?.textContent==='Logic Sim');
  await click(choice!);
  expect(container.querySelector('.logic-app')).not.toBeNull();
  expect(container.querySelector('footer')).toBeNull();
});
it('shows the updated Logic Sim editor controls and shared theme picker',async()=>{
  const choice=[...container.querySelectorAll<HTMLElement>('.compiler-choice')].find(item=>item.querySelector('h2')?.textContent==='Logic Sim');
  await click(choice!);
  expect(container.textContent).not.toContain('Saved locally');
  expect(container.textContent).not.toContain('EXAMPLE CIRCUITS');
  expect(container.querySelector('.logic-toolbar')?.textContent).toContain('Select all');
  expect(container.querySelector('.logic-toolbar')?.textContent).toContain('Boolean Expression');
  await click(container.querySelector<HTMLElement>('[aria-label="Logic Simulator theme"]')!);
  expect(container.querySelector('.logic-theme-menu .theme-picker')).not.toBeNull();
  expect(container.querySelector('.logic-theme-menu')?.textContent).toContain('Dracula');
});
it('moves workspaces below the top bar and removes the obsolete UI',async()=>{
  await choose('Pseudocode Compiler');
  expect(document.title).toBe('Pico | Pseudocode Compiler');
  expect(button('Go to Python Compiler')).toBeUndefined();expect(button('Go to Pseudocode Compiler')).toBeUndefined();
  expect(container.querySelector('.topbar')?.nextElementSibling?.className).toBe('workspace-tabs');
  expect(container.querySelector('.sidebar')).toBeNull();expect(container.querySelector('textarea')?.dataset.fontSize).toBe('19');
  expect(container.textContent).not.toMatch(/Saved on this device|Saved locally|Stored locally|Test cases/i);
});
it('preserves separate projects, source and settings through switches and reloads',async()=>{
  await choose('Pseudocode Compiler');
  await type(container.querySelector('[aria-label="Workspace name"]')!,'Algorithms');
  await type(container.querySelector('textarea')!,'OUTPUT "Pseudocode kept"');
  await click(container.querySelector('[aria-label="Open settings"]')!);await click(button('High Contrast Blue'));
  await switchViaHome('Python Compiler');
  expect(document.title).toBe('Pico | Python Compiler');
  expect(container.querySelector('.file-tab-select span')?.textContent).toBe('main.py');
  expect(container.querySelector('textarea')?.getAttribute('aria-label')).toBe('python editor');
  expect(container.querySelector('.pico-app')?.getAttribute('data-pico-theme')).toBe('high-contrast-blue');
  expect(button('Go to Pseudocode Compiler')).toBeUndefined();expect(button('Go to Python Compiler')).toBeUndefined();
  expect([...container.querySelectorAll('.dock-tab')].map(b=>b.textContent)).toEqual(['Console','Debugger']);
  await type(container.querySelector('[aria-label="Workspace name"]')!,'Python lesson');
  await type(container.querySelector('textarea')!,'number=5\nprint(f"Value: {number} <- unchanged")');
  await switchViaHome('Pseudocode Compiler');
  expect(container.querySelector('textarea')?.value).toBe('OUTPUT "Pseudocode kept"');
  expect(container.querySelector<HTMLInputElement>('[aria-label="Workspace name"]')?.value).toBe('Algorithms');
  await switchViaHome('Python Compiler');
  expect(container.querySelector('textarea')?.value).toBe('number=5\nprint(f"Value: {number} <- unchanged")');
  await click(container.querySelector('[aria-label="Go to home screen"]')!);await choose('Python Compiler');
  expect(container.querySelector('textarea')?.value).toContain('unchanged');
  await click(container.querySelector('[aria-label="Go to home screen"]')!);
  await act(async()=>root.unmount());root=createRoot(container);await act(async()=>root.render(<App/>));
  expect(container.querySelector('.pico-home')).not.toBeNull();await choose('Python Compiler');
  expect(container.querySelector('textarea')?.value).toContain('unchanged');
  expect(container.querySelector<HTMLInputElement>('[aria-label="Workspace name"]')?.value).toBe('Python lesson');
});
it('preserves edits in memory even when browser storage rejects saves',async()=>{
  await choose('Pseudocode Compiler');await type(container.querySelector('textarea')!,'OUTPUT "Kept"');
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota');});
  await switchViaHome('Python Compiler');await type(container.querySelector('textarea')!,'print("Python kept")');
  await switchViaHome('Pseudocode Compiler');expect(container.querySelector('textarea')?.value).toBe('OUTPUT "Kept"');
  await switchViaHome('Python Compiler');expect(container.querySelector('textarea')?.value).toBe('print("Python kept")');
});
it('runs Python source, accepts console input and displays final debugger variables',async()=>{
  await choose('Python Compiler');expect(preloadPythonRuntime).toHaveBeenCalled();expect(container.querySelector('textarea')?.value).toBe('');await type(container.querySelector('textarea')!,'name=input("Enter your name: ")\nprint(f"Hello {name}!")');await click(button('Run⌘ ↵'));const execution=jobs[0]!;
  expect(execution.request.code).toContain('input(');expect(execution.request.debug).toBe(true);expect(execution.request.filename).toBe('main.py');
  await act(async()=>{execution.callbacks.onStatus?.('Python 3.14.2');execution.callbacks.onOutput?.(['Enter your name: ']);execution.callbacks.onInput?.({id:1,variable:'input()',dataType:'STRING',line:3});});
  expect(container.querySelector('.pico-appbar-tool')).toBeNull();
  await type(container.querySelector('.console-input-form input')!,'Ada');
  await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(execution.job.provideInput).toHaveBeenCalledWith(1,'Ada');
  await act(async()=>{execution.callbacks.onOutput?.(['Hello Ada!']);execution.finish([{result:{output:['Hello Ada!'],variables:{name:'Ada'},coverage:[],trace:[{line:4,label:'Finished',variables:{name:'Ada',ready:true},output:['Hello Ada!']}],steps:2,files:{},traceTruncated:false}}]);});
  await click(button('Debugger'));expect(container.querySelector('.debugger-panel')).not.toBeNull();expect(container.querySelector('.variable-list')?.textContent).toContain('"Ada"');expect(container.querySelector('.variable-list')?.textContent).toContain('True');
});
it('shows Python failures as Error, ends pending input, and cancels runs when leaving the compiler',async()=>{
  await choose('Python Compiler');await click(button('Run⌘ ↵'));const execution=jobs[0]!;
  await act(async()=>{execution.callbacks.onStderr?.(['problem']);execution.finish([{error:{message:'ValueError: invalid integer',line:3,code:'python',diagnostic:'main.py\nValueError: invalid integer'}}]);});
  expect(container.querySelector('.console-entry-error')?.textContent).toBe('Errorproblem');
  expect(container.querySelector('.error-heading')?.textContent).toContain('Error');expect(container.querySelector('.diagnostic-message')?.textContent).toContain('ValueError');expect(container.querySelector('.error-tip')).toBeNull();
  expect(button('Run⌘ ↵').disabled).toBe(false);expect(container.querySelector('.console-input-form')).toBeNull();
  await click(button('Run⌘ ↵'));const pending=jobs[1]!;
  await switchViaHome('Pseudocode Compiler');expect(pending.job.cancel).toHaveBeenCalled();
  await act(async()=>pending.callbacks.onOutput?.(['stale output']));
  expect(container.textContent).not.toContain('stale output');
});
it('shows a Python tutorial with matching syntax and no rendering loop',async()=>{
  await choose('Python Compiler');await click(button('Tutorial'));await click(button('Next'));
  expect(container.querySelector('#tutorial-description')?.textContent).toContain('Python');expect(container.querySelector('.tutorial-example')?.textContent).toContain('input(');
  expect(container.querySelector('.tutorial-example')?.textContent).not.toContain('DECLARE');
  for(let i=0;i<6;i++)await click(button('Next')??button('Finish tour'));
  expect(container.querySelector('#tutorial-description')?.textContent).toContain('.py');await click(button('Finish tour'));
  expect(container.querySelector('#tutorial-title')?.textContent).toBe('Tour complete');
});

it('shows uncluttered workspace cards without Open labels or preview scrollbars',()=>{
 expect(container.querySelectorAll('.compiler-choice-title > span')).toHaveLength(0);
 expect(container.querySelectorAll('.compiler-choice')).toHaveLength(7);
});
it('offers both CPU simulation modes and a guided tutorial',async()=>{
 const cpuChoice=[...container.querySelectorAll<HTMLElement>('.compiler-choice')].find(choice=>choice.querySelector('h2')?.textContent==='CPU Studio');
 await click(cpuChoice!);
 expect(document.title).toBe('Pico | CPU Studio');
 expect(container.querySelector('.cpu-app')).not.toBeNull();
 expect(container.querySelectorAll('.cpu-ram-row')).toHaveLength(16);
 expect(container.querySelector('.cpu-workspace-main')).not.toBeNull();
 expect(container.querySelector('[aria-label="Illustrative CPU clock speed GHz"]')).not.toBeNull();
 expect(container.querySelector('[aria-label="Assembly source code"]')).toBeNull();
 expect(container.textContent).not.toContain('EXAMPLE PROGRAMS');
 expect(container.querySelectorAll('input[name="cpu-mode"]')).toHaveLength(2);
 expect(container.querySelector('g[aria-label="Decode Unit"]')).toBeNull();
 expect(container.querySelector('.cpu-app')).not.toBeNull();
 if(!container.querySelector('[aria-label="Skip CPU Studio tutorial"]'))await click(container.querySelector<HTMLElement>('[aria-label="Open CPU Studio tutorial"]')!);
 await click(container.querySelector<HTMLElement>('[aria-label="Skip CPU Studio tutorial"]')!);
 await click(container.querySelector<HTMLElement>('[aria-label="Step forward one CPU micro-operation"]')!);
 expect(container.textContent).toContain('PC identifies');
 expect(container.querySelector('.cpu-diagram.cpu-has-focus')).not.toBeNull();
 await click(button('Reset'));
 expect(container.textContent).toContain('Press Run to start the CPU');
});
it('supports Step Back and only shows decode unit in Advanced mode',async()=>{
 const choice=[...container.querySelectorAll<HTMLElement>('.compiler-choice')].find(item=>item.querySelector('h2')?.textContent==='CPU Studio');
 await click(choice!);
 if(!container.querySelector('[aria-label="Skip CPU Studio tutorial"]'))await click(container.querySelector<HTMLElement>('[aria-label="Open CPU Studio tutorial"]')!);
 await click(container.querySelector<HTMLElement>('[aria-label="Skip CPU Studio tutorial"]')!);
 const back=container.querySelector<HTMLButtonElement>('[aria-label="Step backward one CPU micro-operation"]')!;
 const forward=container.querySelector<HTMLButtonElement>('[aria-label="Step forward one CPU micro-operation"]')!;
 expect(back.disabled).toBe(true);
 await click(forward);
 expect(back.disabled).toBe(false);
 expect(container.textContent).toContain('Micro-step 1');
 await click(back);
 expect(container.textContent).toContain('Micro-step 0');
 const advanced=container.querySelectorAll<HTMLInputElement>('input[name="cpu-mode"]')[1]!;
 await click(advanced);
 expect(container.querySelector('g[aria-label="Decode Unit"]')).not.toBeNull();
 for(const name of ['Clock','Status Register','Interrupt Register']){
  expect(container.querySelector('g.cpu-block[aria-label="'+name+'"]')).not.toBeNull();
 }
 expect(container.querySelectorAll('path.cpu-advanced-wire')).toHaveLength(14);
 expect(container.querySelector('path[data-wire-id="clock-cu"]')).not.toBeNull();
 expect(container.querySelector('path[data-wire-id="status-cu"]')).not.toBeNull();
 expect(container.querySelector('path[data-wire-id="interrupt-cu"]')).not.toBeNull();
 expect(container.querySelector('[aria-label="Request CPU interrupt"]')).not.toBeNull();
 expect(container.textContent).not.toContain('Von Neumann · Cambridge IGCSE');
});

it('opens the bug report dialog directly from /app/report and updates browser history', async()=>{
  await act(async()=>{
    window.history.pushState(null,'','/app/report');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(window.location.pathname).toBe('/app/report');
  expect(container.querySelector('.pico-home')).not.toBeNull();
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="Close report form"]')?.click());
  expect(window.location.pathname).toBe('/app');
});


it('links to Pico Status beside the home theme control',()=>{
  const link=container.querySelector<HTMLAnchorElement>('.home-theme-anchor .home-status-link');
  expect(link?.getAttribute('href')).toBe('https://status.picompiler.pages.dev/');
  expect(link?.textContent).toBe('Status');
  expect(link?.target).toBe('_blank');
});
