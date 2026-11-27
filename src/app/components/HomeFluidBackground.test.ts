import { expect, it } from 'vitest';
import { getTheme } from '../themes';
import { homeFluidPalette } from './HomeFluidBackground';

it('uses Pico theme colours and changes palette with the selected theme', () => {
  const mocha = homeFluidPalette(getTheme('catppuccin-mocha'));
  const nord = homeFluidPalette(getTheme('nord'));
  expect(mocha[0]).toEqual([203 / 255, 166 / 255, 247 / 255]);
  expect(nord).not.toEqual(mocha);
  expect(nord.flat().every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
});
