import type { CompilerLanguage } from '../storage/projects';

export type PicoWorkspace = CompilerLanguage | 'flowchart' | 'logic' | 'cpu' | 'binary' | 'traffic' | 'games' | 'learn';

const workspaces: readonly PicoWorkspace[] = ['pseudocode', 'python', 'flowchart', 'logic', 'cpu', 'binary', 'traffic', 'games', 'learn'];

export function workspaceFromPath(pathname: string): PicoWorkspace | null {
  const match = /^\/app\/(pseudocode|python|flowchart|logic|cpu|binary|traffic|games|learn)\/?$/.exec(pathname);
  return match ? match[1] as PicoWorkspace : null;
}

/** Existing /app?tool= links continue to work for bookmarks. */
export function workspaceFromSearch(search: string): PicoWorkspace | null {
  const tool = new URLSearchParams(search).get('tool');
  return workspaces.find(workspace => workspace === tool) ?? null;
}

export function workspaceFromLocation(pathname: string, search: string): PicoWorkspace | null {
  return workspaceFromPath(pathname) ?? (pathname === '/app' || pathname === '/app/' ? workspaceFromSearch(search) : null);
}

export function workspaceUrl(workspace: PicoWorkspace | null): string {
  return workspace === null ? '/app' : `/app/${workspace}`;
}
