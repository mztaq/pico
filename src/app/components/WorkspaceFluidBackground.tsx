import type { PicoTheme } from '../themes';
import { HomeFluidBackground } from './HomeFluidBackground';
import './workspace-fluid.css';

/** Reuse the home solver with a quieter, lower-resolution interactive background. */
export function WorkspaceFluidBackground({theme}:{theme:PicoTheme}) {
  return <HomeFluidBackground theme={theme} workspace disabled={theme.highContrast}/>;
}
