// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ResizeHandle } from './ResizeHandle';

let host: HTMLDivElement;
let root: Root;
let handle: HTMLDivElement;
let captured: boolean;
const resize = vi.fn();
async function pointer(type: string, x = 10) {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x });
  Object.defineProperty(event, 'pointerId', { value: 7 });
  await act(async () => { handle.dispatchEvent(event); });
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  resize.mockClear(); captured = false;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => { root.render(<ResizeHandle axis="x" label="Resize reference" onResize={resize} />); });
  handle = host.querySelector('[role="separator"]')!;
  handle.setPointerCapture = vi.fn(() => { captured = true; });
  handle.hasPointerCapture = vi.fn(() => captured);
  handle.releasePointerCapture = vi.fn(() => { captured = false; });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it('clears the dragging highlight after release and ignores later pointer movement', async () => {
  expect(handle.classList.contains('is-dragging')).toBe(false);
  await pointer('pointerdown'); await pointer('pointermove', 30);
  expect(handle.classList.contains('is-dragging')).toBe(true); expect(resize).toHaveBeenLastCalledWith(20);
  await pointer('pointerup', 30);
  expect(handle.classList.contains('is-dragging')).toBe(false); expect(captured).toBe(false);
  await pointer('pointermove', 50); expect(resize).toHaveBeenCalledTimes(1);
});
it('clears a drag if pointer capture is lost or the pointer is cancelled', async () => {
  await pointer('pointerdown'); await pointer('lostpointercapture');
  expect(handle.classList.contains('is-dragging')).toBe(false);
  await pointer('pointermove', 30); expect(resize).not.toHaveBeenCalled();
  await pointer('pointerdown'); await pointer('pointercancel');
  expect(handle.classList.contains('is-dragging')).toBe(false); expect(captured).toBe(false);
});
