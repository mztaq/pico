import { describe, expect, it } from 'vitest';
import { glassDisplacement } from './WorkspaceGlass';

describe('rounded glass bezel map', () => {
  it('leaves the center neutral and bends samples inward at opposite edges', () => {
    expect(glassDisplacement(200, 100, 400, 200, 20)).toEqual([128, 128]);
    expect(glassDisplacement(2, 100, 400, 200, 20)[0]).toBeGreaterThan(180);
    expect(glassDisplacement(398, 100, 400, 200, 20)[0]).toBeLessThan(76);
    expect(glassDisplacement(200, 2, 400, 200, 20)[1]).toBeGreaterThan(180);
    expect(glassDisplacement(200, 198, 400, 200, 20)[1]).toBeLessThan(76);
  });
  it('bends both axes at rounded corners and fades inside the bevel', () => {
    const [x, y] = glassDisplacement(6, 6, 400, 200, 20);
    expect(x).toBeGreaterThan(128);
    expect(y).toBeGreaterThan(128);
    expect(glassDisplacement(40, 100, 400, 200, 20)).toEqual([128, 128]);
  });
});
