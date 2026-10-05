import type { VirtualFiles } from '../runtime/interpreter';
import { normalizeVirtualFiles } from './projects';
import type { PicoFile } from './projects';
export interface ProjectVersion {
  id: string;
  label: string;
  createdAt: number;
  files: PicoFile[];
  activeFileId: string;
  virtualFiles?: VirtualFiles;
}
const key = (projectId: string) => `pico.history.v1.${projectId}`;
export function loadHistory(projectId: string): ProjectVersion[] {
  try {
    const value = JSON.parse(localStorage.getItem(key(projectId)) ?? '[]');
    return Array.isArray(value) ? value.filter(isVersion).slice(0, 30) : [];
  } catch {
    return [];
  }
}
export function saveHistory(
  projectId: string,
  versions: ProjectVersion[],
): void {
  localStorage.setItem(key(projectId), JSON.stringify(versions.slice(0, 30)));
}
export function addVersion(
  projectId: string,
  label: string,
  files: PicoFile[],
  activeFileId: string,
  virtualFiles: VirtualFiles = {},
): ProjectVersion[] {
  const versions = loadHistory(projectId);
  const version: ProjectVersion = {
    id: crypto.randomUUID(),
    label: label.trim().slice(0, 60) || 'Snapshot',
    createdAt: Date.now(),
    files: structuredClone(files),
    activeFileId,
    virtualFiles: normalizeVirtualFiles(virtualFiles),
  };
  const next = [version, ...versions];
  saveHistory(projectId, next);
  return next;
}
function isVersion(value: unknown): value is ProjectVersion {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ProjectVersion>;
  return (
    typeof v.id === 'string' &&
    typeof v.label === 'string' &&
    typeof v.createdAt === 'number' &&
    typeof v.activeFileId === 'string' &&
    Array.isArray(v.files) &&
    v.files.every((file) =>
      Boolean(
        file &&
        typeof file === 'object' &&
        typeof (file as PicoFile).id === 'string' &&
        typeof (file as PicoFile).name === 'string' &&
        typeof (file as PicoFile).code === 'string',
      ),
    )
  );
}
