# Pico immersive landing V2: scene and camera plan

Status: isolated preview at `/experience/`. The production root and installed desktop apps stay unchanged.

## Interaction contract

One continuous perspective-based 3D scene. Scrolling moves a camera rig through six world coordinates. No separate 2D marketing sections, floating blobs, fake application screenshots or repetitive equal-sized cards. All visible typography and clickable surfaces belong to the 3D scene. Existing Pico UI remains the real browser app at `/` during preview.

### Camera coordinates and timeline

Coordinates are CSS 3D pixels in the scene's shared world space. The center of each chapter is 920 px behind the previous. The scroll range maps to 0–5 camera units, with one transition per viewport-height of scrolling. Scroll remains user-controlled, never auto-plays or traps input.

| Camera stop | Normalized scroll | Camera center (x, y, z) | Orientation | Visual event |
| --- | --- | --- | --- | --- |
| 0: Hero | 0% | (0, 0, 0) | 0° pitch, 0° yaw | Extruded Pico brand, official slogan, browser launch |
| 1: Workspaces | 20% | (95, -22, -920) | -2° pitch, 6° yaw | Six spatial instruments become legible |
| 2: Flow and logic | 40% | (-85, 32, -1840) | 3° pitch, -5° yaw | Algorithm path connects, gate output responds |
| 3: CPU | 60% | (70, -20, -2760) | -2° pitch, 6° yaw | ALU/control/registers and traces resolve in depth |
| 4: Download | 80% | (-45, 8, -3680) | 1° pitch, -4° yaw | Three OS hardware stations and working links |
| 5: Team | 100% | (0, 0, -4600) | 0° pitch, 0° yaw | Cofounders foregrounded, concept developers behind |

All coordinates blend with easing within each scroll segment, and the wheel/touch scroll position remains the source of truth. No timed scene playback.

## Visual system

- Retain Pico's charcoal and lavender/Catppuccin-inspired colours, with warm white readable typography.
- Physical depth uses extrusion, side faces, perspective, shadow and directional shading, not gradients or massive glows.
- Scene labels are sparse. The official slogan is **Built by students, for students**.
- Render the 3D environment with native CSS 3D transforms and DOM text to preserve sharp text, working links and compatibility with the existing frozen pnpm lockfile. React controls the scroll-linked camera. No fake screenshot assets or new runtime dependencies.
- Use staggered typography and meaningful interactive artifacts to create focal points. No equal card grids.

## Performance and accessibility

- Passive scroll listener + one `requestAnimationFrame` update per input frame.
- Only the active scene is keyboard-interactive. Inactive scenes are inert and hidden from screen readers.
- Respect reduced motion; no automatic drift. Mobile uses shallower perspective, preserved 3D depth and simpler staging.
- Use a single isolated scroll container, because the existing editor sets `body { overflow: hidden }`.
- Do not change `src/main.tsx`, `src-tauri`, or the main domain's app launcher. The new preview has its own `experience/index.html` and Vite entry.

## QA gate before replacing production home

1. CI: `pnpm test`, `pnpm build`, verify emitted `dist/experience/index.html`.
2. Check fresh page navigation and reload at `/experience/` on Cloudflare branch preview.
3. Scroll/wheel/touch/keyboard through all six chapters; confirm 3D links target real valid assets.
4. Check 1440×900, 1366×768, 390×844, reduced-motion, and scroll backtracking.
5. Obtain actual visual screenshots and device review before saying it is a 9/10 design.
6. Before any root-route migration, verify legacy Tauri installers or keep production root unchanged.

