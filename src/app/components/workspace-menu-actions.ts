import {
  ArrowLeft, ArrowRight, Code2, Copy, FilePlus2,
  Keyboard, Maximize2, Minus, Pause, Play, Plus, Redo2, RotateCcw,
  Settings2, StepBack, StepForward, Trash2, Undo2, Workflow,
  type LucideIcon,
} from 'lucide-react';
import { flushSync } from 'react-dom';
import { workspaceUrl, type PicoWorkspace } from '../workspace-deeplink';

export interface WorkspaceMenuAction {
  label: string;
  icon: LucideIcon;
  group: string;
  disabled: boolean;
  destructive?: boolean;
  run: () => void;
}

export interface WorkspaceMenuModel {
  title: string;
  actions: WorkspaceMenuAction[];
}

const names: Record<NonNullable<PicoWorkspace>, string> = {
  pseudocode: 'Pseudocode', python: 'Python', flowchart: 'Flowchart',
  logic: 'Logic Sim', cpu: 'CPU Studio', binary: 'Binary Lab',
  traffic: 'Traffic Storm', games: 'Games', learn: 'Learn',
};

const blocked = (element: HTMLElement): boolean =>
  (element instanceof HTMLButtonElement && element.disabled) ||
  (element instanceof HTMLInputElement && element.disabled) ||
  Boolean(element.closest('[inert]'));

function navigate(workspace: PicoWorkspace) {
  window.history.pushState(window.history.state, '', workspaceUrl(workspace));
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Commands use the workspaces' existing controls, preserving their validation,
 * history, autosave, and in-progress simulation safeguards. */
export function buildWorkspaceMenu(
  workspace: PicoWorkspace | null,
  target: Element,
  documentRoot: Document = document,
): WorkspaceMenuModel {
  const actions: WorkspaceMenuAction[] = [];
  const find = (selector: string) => documentRoot.querySelector<HTMLElement>(selector);
  const findText = (selector: string, value: string) =>
    Array.from(documentRoot.querySelectorAll<HTMLElement>(selector))
      .find(element => element.textContent?.trim() === value);
  const add = (label: string, element: HTMLElement | null | undefined, icon: LucideIcon, group = 'actions', destructive = false) => {
    if (!element) return;
    actions.push({
      label, icon, group, destructive, disabled: blocked(element),
      run: () => { if (element.isConnected && !blocked(element)) element.click(); },
    });
  };
  const choose = (label: string, selector: string, icon: LucideIcon, group = 'actions', destructive = false) =>
    add(label, find(selector), icon, group, destructive);
  const custom = (label: string, icon: LucideIcon, group: string, run: () => void, disabled = false, destructive = false) =>
    actions.push({ label, icon, group, run, disabled, destructive });

  if (workspace === null) {
    for (const [label, route] of [
      ['Pseudocode', 'pseudocode'], ['Python', 'python'],
    ] as const) custom(label, Code2, 'open', () => navigate(route));
    choose('Appearance', '.home-theme-trigger', Settings2, 'view');
    return { title: 'Workspaces', actions };
  }

  if (workspace === 'pseudocode' || workspace === 'python') {
    const tab = target.closest<HTMLElement>('.workspace-tabs .project-row');
    const file = target.closest<HTMLElement>('.file-tabs .file-tab');
    if (tab) {
      const picker = tab.querySelector<HTMLButtonElement>('.project-select');
      custom('Rename project', FilePlus2, 'selection', () => {
        if (picker && !blocked(picker)) {
          flushSync(() => picker.click());
          const input = find('.topbar-project-name') as HTMLInputElement | null;
          input?.focus();
          input?.select();
        }
      }, !picker || blocked(picker));
      add('Delete project', tab.querySelector<HTMLElement>('.project-delete'), Trash2, 'selection', true);
    }
    if (file) {
      custom('Rename file', FilePlus2, 'selection', () => {
        if (file.isConnected) file.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      }, Boolean(file.closest('[inert]')));
      add('Close file', file.querySelector<HTMLElement>('.file-tab-close'), Trash2, 'selection', true);
    }
    if (find('button[aria-label="Stop execution"]')) choose('Stop execution', 'button[aria-label="Stop execution"]', Pause, 'run');
    else choose('Run program', 'button[data-tour="run"]', Play, 'run');
    choose('New project', 'button[aria-label="New project"]', Plus, 'files');
    choose('New file', 'button[aria-label="New file"]', FilePlus2, 'files');
  }

  if (workspace === 'flowchart') {
    const node = target.closest<HTMLElement>('.flow-node');
    if (node) {
      custom('Delete block', Trash2, 'selection', () => {
        if (!node.isConnected) return;
        flushSync(() => node.click());
        const button = find('.flow-delete-block');
        if (button && !blocked(button)) button.click();
      }, Boolean(find('.flow-builder .run-button')?.hasAttribute('disabled')) || Boolean(node.closest('[inert]')), true);
    }
    choose('Run flowchart', '.flow-builder .run-button', Play, 'run');
    choose('Debug', '.flow-builder .debug-button', Code2, 'run');
    choose('Stop', '.flow-builder .stop-button', Pause, 'run');
    choose('Undo', 'button[aria-label="Undo flowchart edit"]', Undo2, 'edit');
    choose('Redo', 'button[aria-label="Redo flowchart edit"]', Redo2, 'edit');
    choose('Auto-layout', 'button[aria-label="Auto-layout flowchart"]', Workflow, 'view');
    choose('Fit to screen', 'button[aria-label="Fit flowchart"]', Maximize2, 'view');
  }

  if (workspace === 'logic') {
    const selected = Boolean(find('.logic-node.selected'));
    if (selected) {
      choose('Rotate selection', '.logic-toolbar button[aria-label="Rotate"]', RotateCcw, 'selection');
      choose('Delete selection', '.logic-toolbar button[aria-label="Delete selection"]', Trash2, 'selection', true);
      add('Duplicate', findText('.logic-toolbar button', 'Duplicate'), Copy, 'selection');
    }
    add('Run / Pause', find('.logic-sim-controls .logic-run'), Play, 'run');
    add('Step', findText('.logic-sim-controls button', 'Step'), StepForward, 'run');
    add('Reset simulation', findText('.logic-sim-controls button', 'Reset'), RotateCcw, 'run');
    choose('Undo', '.logic-toolbar button[aria-label="Undo"]', Undo2, 'edit');
    choose('Redo', '.logic-toolbar button[aria-label="Redo"]', Redo2, 'edit');
    add('Truth table', findText('.logic-toolbar button', 'Truth table'), Code2, 'view');
    choose('Fit circuit', '.logic-toolbar button[aria-label="Fit circuit"]', Maximize2, 'view');
  }

  if (workspace === 'cpu') {
    add('Run / Pause', find('.cpu-playback .cpu-play'), Play, 'run');
    choose('Step forward', 'button[aria-label="Step forward one CPU micro-operation"]', StepForward, 'run');
    choose('Step back', 'button[aria-label="Step backward one CPU micro-operation"]', StepBack, 'run');
    add('Reset CPU', findText('.cpu-playback button', 'Reset'), RotateCcw, 'run');
    choose('Request interrupt', 'button[aria-label="Request CPU interrupt"]', Plus, 'run');
  }

  if (workspace === 'binary') {
    add('Clear register', findText('.binary-register button', 'Clear'), RotateCcw, 'bits');
    add('Negate value', find('.binary-signed-action'), Minus, 'bits');
    add('Shift left', findText('.binary-operations button', 'Shift left'), ArrowLeft, 'bits');
    add('Shift right', findText('.binary-operations button', 'Shift right'), ArrowRight, 'bits');
    add('Add to register', findText('.binary-operations button', 'Add to register'), Plus, 'bits');
  }

  if (workspace === 'traffic') {
    choose('Start simulation', '.storm-start-simulation', Play, 'simulation');
    add('Pause / Resume', findText('.storm-app button', 'Pause') ?? findText('.storm-app button', 'Resume'), Pause, 'simulation');
    add('Restart simulation', findText('.storm-app button', 'Restart'), RotateCcw, 'simulation');
  }

  if (workspace === 'games') {
    add('Play Blackout Protocol', find('.pico-games-card'), Play, 'games');
  }
  if (workspace === 'learn') {
    const search = find('.learning-search input');
    custom('Search topics', Keyboard, 'learn', () => search?.focus(), !search);
  }

  return { title: names[workspace], actions };
}
