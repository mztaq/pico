export type FluidColor = [number, number, number];
export type FluidPalette = [FluidColor, FluidColor, FluidColor];
export interface FluidController { setPalette(palette: FluidPalette): void; dispose(): void; }
export function startFluid(canvas: HTMLCanvasElement, palette: FluidPalette, onFailure: () => void): FluidController;
