# Animated workspace backgrounds

Pico reuses its existing theme-aware WebGL fluid solver, adapted from [Pavel Dobryakov's WebGL Fluid Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) under the MIT license. No video, external wallpaper scripts or new dependencies are required.

## Implementation

- Interactive pointer splats and ambient motion across Pseudocode, Python, Flowchart, Logic Sim, CPU Studio, Binary Lab, SQL Playground and Traffic Storm.
- A separate lower-cost workspace profile targets 30 fps, uses smaller simulation buffers and reduced pressure iterations. Home keeps its existing 60 fps profile.
- Blur and reduced saturation apply only to the canvas. Mostly opaque editor and data panels retain readable text.
- Canvas does not intercept pointer events; passive capture listeners receive pointer motion and clicks.
- Existing theme colors, hidden-tab suspension, GPU cleanup, reduced-motion and forced-colors behavior are retained. High-contrast themes disable the workspace fluid.
- The embedded CPU landing-page preview is excluded.

The PR also retains the proposed iOS-inspired styling except for pill-shaped Run buttons. No MP4 is included. Actual GPU performance and browser appearance require verification on representative devices.
