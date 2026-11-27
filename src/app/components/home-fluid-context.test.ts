// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { checkHomeFluidSupport } from './home-fluid-context.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

it('checks actual context availability rather than the WebGL constructor alone', () => {
  vi.stubGlobal('WebGLRenderingContext', function WebGLRenderingContext() {});
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  expect(checkHomeFluidSupport(true)).toBe(false);
  expect(getContext).toHaveBeenCalled();
  const cached = JSON.parse(sessionStorage.getItem('pico.home-fluid-support.v1') ?? '{}');
  expect(cached.supported).toBe(false);
  getContext.mockClear();
  expect(checkHomeFluidSupport()).toBe(false);
  expect(getContext).not.toHaveBeenCalled();
});
