import type { CompilerLanguage } from '../storage/projects';

export type PicoWorkspace = CompilerLanguage | 'flowchart' | 'logic' | 'cpu' | 'binary';

/** A landing-page link opens a workspace directly without changing the /app route. */
export function workspaceFromSearch(search: string): PicoWorkspace | null {
  const tool = new URLSearchParams(search).get('tool');
  switch (tool) {
    case 'pseudocode':
    case 'python':
    case 'flowchart':
    case 'logic':
    case 'cpu':
    case 'binary':
      return tool;
    default:
      return null;
  }
}
