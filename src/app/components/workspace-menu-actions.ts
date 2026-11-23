import {
  ArrowLeft, BookOpen, Check, CircleHelp, Code2, Copy, Download, FilePlus2,
  FolderOpen, Keyboard, Maximize2, Minus, Pause, Play, Plus, Redo2, RotateCcw,
  Settings2, StepBack, StepForward, Trash2, Undo2, Upload, Workflow, ZoomIn, ZoomOut,
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
      ['Pseudocode Compiler', 'pseudocode'], ['Python Compiler', 'python'],
      ['Flowchart Builder', 'flowchart'], ['Logic Sim', 'logic'],
      ['CPU Studio', 'cpu'], ['Binary Lab', 'binary'],
      ['Traffic Storm', 'traffic'],
    ] as const) custom(label, Code2, 'open', () => navigate(route));
    choose('Appearance', '.home-theme-trigger', Settings2, 'view');
    return { title: 'Workspaces', actions };
  }

  if (workspace === 'pseudocode' || workspace === 'python') {
    const tab = target.closest<HTMLElement>('.workspace-tabs .project-row');
    const file = target.closest<HTMLElement>('.file-tabs .file-tab');
    if (tab) {
      add('Open project', tab.querySelector<HTMLElement>('.project-select'), FolderOpen, 'selection');
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
      add('Open file', file.querySelector<HTMLElement>('.file-tab-select'), FolderOpen, 'selection');
      custom('Rename file', FilePlus2, 'selection', () => {
        if (file.isConnected) file.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      }, Boolean(file.closest('[inert]')));
      add('Close file', file.querySelector<HTMLElement>('.file-tab-close'), Trash2, 'selection', true);
    }
    if (find('button[aria-label="Stop execution"]')) choose('Stop execution', 'button[aria-label="Stop execution"]', Pause, 'run');
    else choose('Run program', 'button[data-tour="run"]', Play, 'run');
    choose('New project', 'button[aria-label="New project"]', Plus, 'files');
    choose('New file', 'button[aria-label="New file"]', FilePlus2, 'files');
    choose('File options', 'button[data-tour="files"]', FolderOpen, 'files');
    choose('Editor settings', 'button[aria-label="Open settings"]', Settings2, 'view');
    choose('Guided tutorial', 'button[aria-label="Help: start the Pico tutorial"]', CircleHelp, 'view');
  }

  if (workspace === 'flowchart') {
    const node = target.closest<HTMLElement>('.flow-node');
    if (node) {
      custom('Select block', Check, 'selection', () => { if (node.isConnected) node.click(); });
      const deleteButton = find('.flow-delete-block');
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
    for (const [name, kind] of [['Process', 'process'], ['Decision', 'decision'], ['Input', 'input'], ['Output', 'output']] as const) {
      choose('Add ' + name + ' block', '.flow-palette-block.flow-kind-' + kind, Plus, 'blocks');
    }
    choose('Undo', 'button[aria-label="Undo flowchart edit"]', Undo2, 'edit');
    choose('Redo', 'button[aria-label="Redo flowchart edit"]', Redo2, 'edit');
    choose('Auto-layout', 'button[aria-label="Auto-layout flowchart"]', Workflow, 'view');
    choose('Fit to screen', 'button[aria-label="Fit flowchart"]', Maximize2, 'view');
    choose('Zoom in', '.flow-builder button[aria-label="Zoom in"]', ZoomIn, 'view');
    choose('Zoom out', '.flow-builder button[aria-label="Zoom out"]', ZoomOut, 'view');
    choose('New flowchart', 'button[aria-label="New flowchart workspace"]', FilePlus2, 'files');
    add('Import', findText('.flow-header-file-actions button', 'Import'), Upload, 'files');
    add('Export', findText('.flow-header-file-actions button', 'Export'), Download, 'files');
    choose('Appearance', 'button[aria-label="Flowchart settings"]', Settings2, 'settings');
    choose('Tutorial', '.flow-builder .pico-appbar-group[aria-label="Workspace tools"] .help-button', BookOpen, 'settings');
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
    add('New circuit', findText('.logic-toolbar button', 'New'), Plus, 'edit');
    add('Select all', findText('.logic-toolbar button', 'Select all'), Check, 'edit');
    choose('Undo', '.logic-toolbar button[aria-label="Undo"]', Undo2, 'edit');
    choose('Redo', '.logic-toolbar button[aria-label="Redo"]', Redo2, 'edit');
    add('Copy selection', findText('.logic-toolbar button', 'Copy selected'), Copy, 'edit');
    add('Paste selection', findText('.logic-toolbar button', 'Paste'), FilePlus2, 'edit');
    add('Truth table', findText('.logic-toolbar button', 'Truth table'), Code2, 'view');
    add('Boolean expression', findText('.logic-toolbar button', 'Boolean Expression'), Keyboard, 'view');
    choose('Fit circuit', '.logic-toolbar button[aria-label="Fit circuit"]', Maximize2, 'view');
    choose('Auto-layout', '.logic-toolbar button[aria-label="Auto-layout circuit"]', Workflow, 'view');
    choose('Appearance', 'button[aria-label="Logic Simulator theme"]', Settings2, 'settings');
    choose('Tutorial', 'button[aria-label="Help: Logic Simulator tutorial"]', CircleHelp, 'settings');
  }

  if (workspace === 'cpu') {
    add('Run / Pause', find('.cpu-playback .cpu-play'), Play, 'run');
    choose('Step forward', 'button[aria-label="Step forward one CPU micro-operation"]', StepForward, 'run');
    choose('Step back', 'button[aria-label="Step backward one CPU micro-operation"]', StepBack, 'run');
    add('Reset CPU', findText('.cpu-playback button', 'Reset'), RotateCcw, 'run');
    choose('Request interrupt', 'button[aria-label="Request CPU interrupt"]', Plus, 'run');
    add('Normal mode', find('.cpu-mode-switch input[value="normal"]') ?? find('.cpu-mode-switch input[name="cpu-mode"]:first-of-type'), Check, 'mode');
    add('Advanced mode', find('.cpu-mode-switch label:nth-child(2) input'), Settings2, 'mode');
    choose('Appearance', 'button[aria-label="Choose CPU Studio theme"]', Settings2, 'settings');
    choose('Tutorial', 'button[aria-label="Open CPU Studio tutorial"]', BookOpen, 'settings');
  }

  if (workspace === 'binary') {
    add('Clear register', findText('.binary-register button', 'Clear'), RotateCcw, 'bits');
    add('Negate value', find('.binary-signed-action'), Minus, 'bits');
    add('Shift left', findText('.binary-operations button', 'Shift left'), ArrowLeft, 'bits');
    add('Shift right', findText('.binary-operations button', 'Shift right'), ArrowLeft, 'bits');
    add('Add to register', findText('.binary-operations button', 'Add to register'), Plus, 'bits');
    for (const value of ['0', '1', '127', '128', '255']) {
      add('Set ' + value, findText('.binary-presets button', value), Check, 'presets');
    }
    choose('Appearance', 'button[aria-label="Binary Lab theme"]', Settings2, 'settings');
    choose('Tutorial', 'button[aria-label="Open Binary Lab tutorial"]', BookOpen, 'settings');
  }

  if (workspace === 'traffic') {
    choose('Start simulation', '.storm-start-simulation', Play, 'simulation');
    add('Pause / Resume', findText('.storm-app button', 'Pause') ?? findText('.storm-app button', 'Resume'), Pause, 'simulation');
    add('Restart simulation', findText('.storm-app button', 'Restart'), RotateCcw, 'simulation');
    add('Reset alias', findText('.storm-app button', 'Reset Alias'), RotateCcw, 'simulation');
    choose('Add proxy', 'button[aria-label="Add defensive proxy"]', Plus, 'capacity');
    choose('Remove proxy', 'button[aria-label="Remove defensive proxy"]', Minus, 'capacity');
    choose('Add server', 'button[aria-label="Add web server"]', Plus, 'capacity');
    choose('Remove server', 'button[aria-label="Remove web server"]', Minus, 'capacity');
    choose('Appearance', 'button[aria-label="Change Traffic Storm theme"]', Settings2, 'settings');
    choose('Tutorial', 'button[aria-label="Traffic Storm tutorial"]', BookOpen, 'settings');
  }

  if (workspace === 'games') {
    add('Play Blackout Protocol', find('.pico-games-card'), Play, 'games');
  }
  if (workspace === 'learn') {
    const search = find('.learning-search input');
    custom('Search topics', Keyboard, 'learn', () => search?.focus(), !search);
  }

  const back = find(
    'button[aria-label="Pico, back to Workspaces"], button[aria-label="Back to Pico"], ' +
    'button[aria-label="Go to home screen"], .learning-back, .pico-games-back',
  );
  add('Back to Workspaces', back, ArrowLeft, 'navigation');

  return { title: names[workspace], actions };
}
