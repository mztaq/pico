import { describe, expect, it } from 'vitest';
import { workspaceFromSearch } from './workspace-deeplink';

describe('Landing workspace links', () => {
  it.each(['pseudocode','python','flowchart','logic','cpu','binary'] as const)('opens %s directly', tool => {
    expect(workspaceFromSearch('?tool=' + tool)).toBe(tool);
  });
  it('leaves normal and invalid app routes on the home screen', () => {
    for (const search of ['', '?tool=', '?tool=admin', '?tool=../api', '?other=cpu']) {
      expect(workspaceFromSearch(search)).toBeNull();
    }
  });
  it('uses the first tool parameter, not a later conflicting one', () => {
    expect(workspaceFromSearch('?tool=python&tool=cpu')).toBe('python');
  });
});
