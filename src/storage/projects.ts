import type { VirtualFiles } from '../runtime/interpreter';
import { examples } from '../examples';
import { starterCode } from '../starter';
import { PYTHON_STARTER } from '../runtime/python/config';
export type CompilerLanguage = 'pseudocode' | 'python';
import type { DataType } from '../language/ast';
import { isAutoDeclaredType } from '../language/autoDeclare';
export interface TestCase {
  id: string;
  name: string;
  inputs: string[];
  expected: string[];
}
export interface PicoFile {
  id: string;
  name: string;
  code: string;
  autoDeclaredTypes?: Record<string, DataType>;
}
export interface PicoProject {
  id: string;
  name: string;
  code: string;
  files: PicoFile[];
  activeFileId: string;
  tests: TestCase[];
  virtualFiles: VirtualFiles;
  updatedAt: number;
  language?: CompilerLanguage;
}
const PROJECTS_KEY = 'pico.projects.v1';
const ACTIVE_KEY = 'pico.activeProject.v1';
const sourceHeader = '// PICO - CAIE Friendly Pseudocode Compiler made by Mustaqim and Amar';
export function normalizeProjectName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 42).trim();
}
export function projectNameExists(name: string, projects: readonly PicoProject[], exceptId?: string): boolean {
  const key = normalizeProjectName(name).toLowerCase();
  return projects.some(project => project.id !== exceptId && normalizeProjectName(project.name).toLowerCase() === key);
}
/** Keep every loaded/imported project, giving collisions a numbered suffix. */
export function uniqueProjectName(name: string, projects: readonly PicoProject[]): string {
  const base = normalizeProjectName(name) || 'Untitled program';
  let candidate = base;
  for (let number = 2; projectNameExists(candidate, projects); number++) {
    const suffix = ` (${number})`;
    candidate = `${base.slice(0, 42 - suffix.length).trimEnd()}${suffix}`;
  }
  return candidate;
}
function makeFile(
  name: string,
  code: string,
  id: string = crypto.randomUUID(),
): PicoFile {
  return { id, name, code };
}
function makeProject(
  id: string,
  name: string,
  code: string,
  tests: TestCase[],
): PicoProject {
  const source = `${sourceHeader}\n\n${code}`;
  const file = makeFile('main.pico', source, `${id}-main`);
  return {
    id,
    name,
    code: source,
    files: [file],
    activeFileId: file.id,
    tests,
    virtualFiles: {},
    updatedAt: Date.now(),
  };
}
const initialProject: PicoProject = makeProject(
  'project-starter',
  'Untitled program',
  starterCode,
  [
    {
      id: 'test-greeting',
      name: 'Greets the user',
      inputs: ['Ada'],
      expected: ['Enter your name', 'Hello Ada!'],
    },
  ],
);
export function loadProjects(language: CompilerLanguage = 'pseudocode'): PicoProject[] {
  try {
    const raw: unknown = JSON.parse(
      localStorage.getItem(language === 'python' ? 'pico.python.projects.v1' : PROJECTS_KEY) ?? 'null',
    );
    if (Array.isArray(raw)) {
      const valid = raw
        .map(normalizeProject)
        .filter((p): p is PicoProject => Boolean(p) && (p!.language ?? 'pseudocode') === language);
      if (valid.length) {
        const loaded: PicoProject[] = [];
        for (const project of valid) loaded.push({ ...project, name: uniqueProjectName(project.name, loaded) });
        return loaded;
      }
    }
  } catch {}
  return [language === 'python' ? newProject('Untitled program', 'python') : initialProject];
}
function normalizeProject(value: unknown): PicoProject | undefined {
  if (!value || typeof value !== 'object') return;
  const project = value as Partial<PicoProject>;
  if (
    typeof project.id !== 'string' ||
    typeof project.name !== 'string' ||
    (project.language !== undefined && project.language !== 'python' && project.language !== 'pseudocode') ||
    !Array.isArray(project.tests) ||
    !project.tests.every(isTestCase)
  )
    return;
  const legacyCode = typeof project.code === 'string' ? project.code : '';
  const rawFiles = Array.isArray(project.files)
    ? project.files
        .map(normalizeFile)
        .filter((file): file is PicoFile => Boolean(file))
    : [];
  const files = rawFiles.length
    ? rawFiles
    : [makeFile('main.pico', legacyCode, `${project.id}-main`)];
  const activeFileId = files.some((file) => file.id === project.activeFileId)
    ? project.activeFileId!
    : files[0]!.id;
  const active = files.find((file) => file.id === activeFileId)!;
  const virtualFiles = normalizeVirtualFiles(project.virtualFiles);
  return {
    ...project,
    virtualFiles,
    code: active.code,
    files,
    activeFileId,
    updatedAt:
      typeof project.updatedAt === 'number' ? project.updatedAt : Date.now(),
  } as PicoProject;
}

function normalizeFile(value: unknown): PicoFile | undefined {
  if (!value || typeof value !== 'object') return;
  const file = value as Partial<PicoFile>;
  if (
    typeof file.id !== 'string' ||
    typeof file.name !== 'string' ||
    typeof file.code !== 'string'
  )
    return;
  const autoDeclaredTypes =
    file.autoDeclaredTypes &&
    typeof file.autoDeclaredTypes === 'object' &&
    !Array.isArray(file.autoDeclaredTypes)
      ? (Object.fromEntries(
          Object.entries(file.autoDeclaredTypes).filter(([, type]) =>
            isAutoDeclaredType(type),
          ),
        ) as Record<string, DataType>)
      : undefined;
  return {
    id: file.id,
    name: normalizeSourceFilename(file.name),
    code: file.code,
    ...(autoDeclaredTypes ? { autoDeclaredTypes } : {}),
  };
}
/** Migrate the previous source suffix while preserving user-chosen names. */
export function normalizeSourceFilename(name: string): string {
  return name.replace(/\.pseudocode$/i, '.pico');
}
export function saveProjects(projects: PicoProject[], activeId: string, language: CompilerLanguage = 'pseudocode'): void {
  localStorage.setItem(language === 'python' ? 'pico.python.projects.v1' : PROJECTS_KEY, JSON.stringify(projects));
  localStorage.setItem(language === 'python' ? 'pico.python.activeProject.v1' : ACTIVE_KEY, activeId);
}
export function loadActiveId(projects: PicoProject[], language: CompilerLanguage = 'pseudocode'): string {
  try {
    const id = localStorage.getItem(language === 'python' ? 'pico.python.activeProject.v1' : ACTIVE_KEY);
    return projects.some((p) => p.id === id) ? id! : projects[0]!.id;
  } catch {
    return projects[0]!.id;
  }
}
export function newProject(name = 'Untitled program', language: CompilerLanguage = 'pseudocode'): PicoProject {
  if (language === 'python') {
    const id = crypto.randomUUID();
    const file = makeFile('main.py', PYTHON_STARTER);
    return { id, name: normalizeProjectName(name) || 'Untitled program', language, code: file.code, files: [file], activeFileId: file.id, tests: [], virtualFiles: {}, updatedAt: Date.now() };
  }
  return makeProject(
    crypto.randomUUID(),
    normalizeProjectName(name) || 'Untitled program',
    'DECLARE Number : INTEGER\nNumber ← 42\nOUTPUT Number',
    [],
  );
}
export function projectFromExample(exampleId: string): PicoProject | undefined {
  const e = examples.find((x) => x.id === exampleId);
  return e
    ? makeProject(crypto.randomUUID(), e.name, e.code, [
        {
          id: crypto.randomUUID(),
          name: `${e.name} example`,
          inputs: [...e.inputs],
          expected: [...e.expected],
        },
      ])
    : undefined;
}
export function exportProject(project: PicoProject): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'pico-project'}.pico`;
  a.click();
  URL.revokeObjectURL(url);
}
export async function importProject(file: File, language: CompilerLanguage = 'pseudocode'): Promise<PicoProject> {
  if (file.size > 5_000_000)
    throw new Error('Pico projects must be smaller than 5 MB.');
  if (language === 'python' && file.name?.toLowerCase().endsWith('.py')) {
    const project = newProject(file.name.slice(0, -3), language);
    const source = await file.text();
    project.files[0]!.name = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    project.files[0]!.code = source;
    project.code = source;
    return project;
  }
  const data = JSON.parse(await file.text());
  const project = normalizeProject(data);
  if (!project) throw new Error('That file is not a valid Pico .pico project.');
  if ((project.language ?? 'pseudocode') !== language) throw new Error(`Open the ${project.language === 'python' ? 'Python' : 'Pseudocode'} Compiler to import this project.`);
  const id = crypto.randomUUID();
  const files = project.files.map((f) => ({ ...f, id: crypto.randomUUID() }));
  const activeIndex = project.files.findIndex(
    (f) => f.id === project.activeFileId,
  );
  const active = files[Math.max(0, activeIndex)]!;
  return {
    ...project,
    id,
    name: normalizeProjectName(project.name) || 'Untitled program',
    files,
    activeFileId: active.id,
    code: active.code,
    updatedAt: Date.now(),
  };
}

function isTestCase(value: unknown): value is TestCase {
  if (!value || typeof value !== 'object') return false;
  const test = value as Partial<TestCase>;
  return (
    typeof test.id === 'string' &&
    typeof test.name === 'string' &&
    Array.isArray(test.inputs) &&
    test.inputs.every((x) => typeof x === 'string') &&
    Array.isArray(test.expected) &&
    test.expected.every((x) => typeof x === 'string')
  );
}
export function normalizeVirtualFiles(value: unknown): VirtualFiles {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([, lines]) =>
          Array.isArray(lines) &&
          lines.every((line) => typeof line === 'string'),
      )
      .map(([name, lines]) => [name, [...(lines as string[])]]),
  );
}
