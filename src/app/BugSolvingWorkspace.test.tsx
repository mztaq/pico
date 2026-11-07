// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bugQuestions, buildCheckProgram } from './bug-solving/questions';
import { BugSolvingWorkspace } from './BugSolvingWorkspace';

vi.mock('./components/CodeEditor', () => ({ CodeEditor: ({ value, onChange, language }: { value: string; onChange: (value: string) => void; language: string }) => <textarea aria-label="Python editor" data-language={language} value={value} onInput={event => onChange(event.currentTarget.value)} /> }));
vi.mock('../runtime/python/runner', () => ({ startPythonExecution: (request: {code:string}, callbacks: {onOutput?:(lines:string[])=>void}) => {
  const solved = request.code.includes('result = 0') || request.code.includes('text.lower()') || request.code.includes('if number > best:');
  const values = solved ? [10, 0, 0] : [11, 1, 1];
  callbacks.onOutput?.([`PICO_CHECK:${JSON.stringify(bugQuestions[0].cases.map((item, index) => ({ label: item.label, actual: values[index], expected: item.expected, passed: solved })))}`]);
  return { promise: Promise.resolve([]), cancel: () => {}, provideInput: () => false };
} }));
vi.mock('../runtime/runner', async () => {
  const { runRequests } = await vi.importActual<typeof import('../runtime/worker')>('../runtime/worker');
  return { startExecution: (request: import('../runtime/worker').WorkerRequest) => ({ promise: Promise.resolve(runRequests(request)), cancel: () => {}, provideInput: () => false }) };
});

let container: HTMLDivElement;
let root: Root;
const button = (name: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === name)!;
const click = async (item: HTMLElement) => act(async () => { item.click(); });

beforeEach(async () => {
  localStorage.clear(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<BugSolvingWorkspace onHome={() => {}} />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe('Bug Solving', () => {
  it('provides separate, complete question content and builds a Python test harness', () => {
    expect(bugQuestions.length).toBeGreaterThanOrEqual(3);
    for (const question of bugQuestions) {
      if (question.language === 'python') expect(question.starter).toContain(`def ${question.functionName}(`);
      expect(question.cases.length).toBeGreaterThanOrEqual(3);
      expect(question.hints.length).toBeGreaterThanOrEqual(2);
      expect(question.examples.length).toBeGreaterThan(0);
      expect(question.walkthrough.length).toBeGreaterThan(1);
      if (question.language === 'python') expect(question.solution).toContain(`def ${question.functionName}(`);
    }
    expect(buildCheckProgram(bugQuestions[0].starter, bugQuestions[0])).toContain('PICO_CHECK:');
  });

  it('reveals hints, runs checks, unlocks the explanation, and saves solved progress', async () => {
    expect(container.querySelector('.bug-app h1')?.textContent).toBe('Add the numbers');
    await click(button('Reveal a hint'));
    expect(container.querySelector('.bug-hints ol')?.textContent).toContain('before adding');
    await click(button('Run tests'));
    expect(container.querySelector('.bug-result-heading')?.textContent).toContain('0 of 3');
    expect(container.querySelector('.bug-case-list')?.textContent).toContain('Your output');
    expect(container.querySelector('.bug-case-list')?.textContent).toContain('11');
    expect(container.querySelector('.bug-case-list')?.textContent).toContain('10');
    const editor = container.querySelector<HTMLTextAreaElement>('[aria-label="Python editor"]')!;
    await act(async () => { editor.value = bugQuestions[0].solution; editor.dispatchEvent(new Event('input', { bubbles: true })); });
    await click(button('Run tests'));
    expect(container.querySelector('.bug-result-heading')?.textContent).toContain('All tests passed');
    expect(button('Full walkthrough')).toBeTruthy();
    await click(button('Full walkthrough'));
    expect(container.querySelector('.bug-walkthrough')?.textContent).toContain('How to solve it');
    expect(JSON.parse(localStorage.getItem('pico.bug-solving.v1')!).solved).toContain('positive-total');
  });

  it('switches questions and persists independent drafts', async () => {
    const editor = container.querySelector<HTMLTextAreaElement>('[aria-label="Python editor"]')!;
    await act(async () => { editor.value = 'def total(numbers):\n    return 42'; editor.dispatchEvent(new Event('input', { bubbles: true })); });
    await click([...container.querySelectorAll<HTMLButtonElement>('.bug-question-link')].find(item => item.textContent?.includes('Count the vowels'))!);
    expect(container.querySelector('.bug-app h1')?.textContent).toBe('Count the vowels');
    await click([...container.querySelectorAll<HTMLButtonElement>('.bug-question-link')].find(item => item.textContent?.includes('Add the numbers'))!);
    expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Python editor"]')?.value).toContain('return 42');
  });

  it('filters to pseudocode and shows the language-specific highlighted editor', async () => {
    const language = container.querySelector<HTMLSelectElement>('[aria-label="Filter questions by language"]')!;
    await act(async () => { language.value = 'pseudocode'; language.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(container.querySelector('.bug-app h1')?.textContent).toBe('Double the input');
    expect(container.querySelector('.bug-syntax-legend')?.textContent).toContain('Keywords');
    expect(container.querySelector('.bug-language-badge')?.textContent).toContain('Pseudocode');
    expect(container.querySelector('[aria-label="Python editor"]')?.getAttribute('data-language')).toBe('pseudocode');
    expect([...container.querySelectorAll('.bug-question-link')].map(item => item.textContent).join(' ')).not.toContain('Find the largest');
    expect(container.querySelector('.bug-examples')?.textContent).toContain('8');
    await click(button('Run tests'));
    expect(container.querySelector('.bug-case-list')?.textContent).toContain('Expected');
    expect(container.querySelector('.bug-case-list')?.textContent).toContain('Your output');
    expect(container.querySelector('.bug-case-list')?.textContent).toContain('12');
  });
});
