import { describe, expect, it } from 'vitest';
import { workspaceFromLocation, workspaceFromPath, workspaceFromSearch, workspaceUrl } from './workspace-deeplink';

describe('Workspace routes', () => {
  it.each(['pseudocode','python','flowchart','logic','cpu','binary','traffic','games','games/siege','games/defense'] as const)('opens %s through a pathname', tool => {
    expect(workspaceFromPath('/app/' + tool)).toBe(tool);
    expect(workspaceFromLocation('/app/' + tool, '')).toBe(tool);
    expect(workspaceUrl(tool)).toBe('/app/' + tool);
  });
  it('keeps legacy query bookmarks working', () => {
    expect(workspaceFromSearch('?tool=python&tool=cpu')).toBe('python');
    expect(workspaceFromLocation('/app', '?tool=python')).toBe('python');
  });
  it('rejects unknown or nested workspace paths', () => {
    for (const path of ['/app/invalid','/app/python/other','/app/../api']) expect(workspaceFromPath(path)).toBeNull();
    expect(workspaceFromLocation('/app', '')).toBeNull();
    expect(workspaceUrl(null)).toBe('/app');
  });
});
