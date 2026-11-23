// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceContextMenu } from './WorkspaceContextMenu';
import { buildWorkspaceMenu } from './workspace-menu-actions';

let root: Root;
let host: HTMLDivElement;

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.history.replaceState({}, '', '/app/flowchart');
  host = document.createElement('div');
  host.id = 'root';
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<WorkspaceContextMenu />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.querySelector('.pico-context-menu')?.remove();
  host.remove();
  vi.unstubAllGlobals();
});

async function rightClick(target: Element) {
  let event!: MouseEvent;
  await act(async () => {
    event = new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true, button: 2, clientX: 200, clientY: 150,
    });
    target.dispatchEvent(event);
  });
  return event;
}

describe('workspace right-click menu', () => {
  it('opens workspace-specific options and executes existing handlers', async () => {
    const area = document.createElement('div');
    area.className = 'pico-app flow-builder';
    area.innerHTML = '<button class="run-button">Run</button><div class="flow-viewport"></div>';
    host.append(area);
    const run = vi.fn();
    area.querySelector('button')!.addEventListener('click', run);
    const event = await rightClick(area.querySelector('.flow-viewport')!);
    expect(event.defaultPrevented).toBe(true);
    const menu = document.querySelector<HTMLElement>('.pico-context-menu')!;
    expect(menu.getAttribute('role')).toBe('menu');
    expect(menu.getAttribute('aria-label')).toBe('Flowchart options');
    const runAction = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
      .find(item => item.textContent?.includes('Run flowchart'))!;
    await act(async () => runAction.click());
    expect(run).toHaveBeenCalledOnce();
    expect(document.querySelector('.pico-context-menu')).toBeNull();
  });

  it('keeps native context menus in editors and dialogs', async () => {
    const area = document.createElement('div');
    area.className = 'pico-app';
    area.innerHTML = '<textarea>test</textarea><div class="cm-editor"></div><div role="dialog"><span>Dialog</span></div>';
    host.append(area);
    for (const selector of ['textarea', '.cm-editor', '[role="dialog"] span']) {
      const event = await rightClick(area.querySelector(selector)!);
      expect(event.defaultPrevented).toBe(false);
      expect(document.querySelector('.pico-context-menu')).toBeNull();
    }
  });

  it('honors disabled controls, Escape and clicks outside', async () => {
    const area = document.createElement('div');
    area.className = 'pico-app flow-builder';
    area.innerHTML = '<button class="run-button" disabled>Run</button><div class="flow-viewport"></div>';
    host.append(area);
    await rightClick(area.querySelector('.flow-viewport')!);
    const runAction = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
      .find(item => item.textContent?.includes('Run flowchart'))!;
    expect(runAction.disabled).toBe(true);
    await act(async () => runAction.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })));
    expect(document.querySelector('.pico-context-menu')).toBeNull();

    await rightClick(area);
    await act(async () => document.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(document.querySelector('.pico-context-menu')).toBeNull();
  });

  it('offers distinct actions for compiler, circuit, CPU, binary, and traffic workspaces', () => {
    const area = document.createElement('div');
    area.innerHTML = [
      '<button data-tour="run">Run</button>',
      '<button class="logic-run">Pause</button>',
      '<div class="logic-sim-controls"><button class="logic-run">Pause</button></div>',
      '<button aria-label="Step forward one CPU micro-operation">Step</button>',
      '<button aria-label="Add defensive proxy">+</button>',
      '<div class="binary-presets"><button>255</button></div>',
    ].join('');
    document.body.append(area);
    expect(buildWorkspaceMenu('python', area).actions.some(action => action.label === 'Run program')).toBe(true);
    expect(buildWorkspaceMenu('logic', area).actions.some(action => action.label === 'Run / Pause')).toBe(true);
    expect(buildWorkspaceMenu('cpu', area).actions.some(action => action.label === 'Step forward')).toBe(true);
    expect(buildWorkspaceMenu('binary', area).actions.some(action => action.label === 'Set 255')).toBe(true);
    expect(buildWorkspaceMenu('traffic', area).actions.some(action => action.label === 'Add proxy')).toBe(true);
    area.remove();
  });
});
