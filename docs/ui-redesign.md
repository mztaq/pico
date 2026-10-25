# Pico Workbench design system

This redesign treats Pico as one family of developer tools. The existing logo and theme accent remain the identity; layout, type, and surface hierarchy do the visual work.

## Foundations

- **Three surfaces:** a quiet canvas (`--ds-canvas`), working panels (`--ds-panel`), and temporary surfaces (`--ds-panel-raised`). All derive from the active Pico theme. Thin borders define edges; shadows are reserved for floating UI.
- **Type:** DM Sans for controls and reading, JetBrains Mono for code and measurements. Display type is tight and confident; labels are at least 11px and reading text is 13–15px. The home wordmark is larger than its section heading.
- **Geometry:** a 4px spacing rhythm, 10–14px panel radii, 36px controls, a 60px app bar, and 44px workspace tabs. Toolbar groups use consistent spacing and separators.
- **Color:** the active theme provides the accent and syntax palette. Accent color identifies the active location, primary action, focus, and live simulation state. Other controls stay neutral.

## Layout

- The home page has one centered masthead and two clear workspace groups, with code and diagram previews that remain readable at mobile widths.
- Each workspace has the same app bar hierarchy: home/identity, context, tools, and a primary action. The working canvas owns the most space; navigation and inspection panels frame it.
- The compiler keeps resizable editor, reference, and tool dock. Flowchart and Logic Sim keep direct manipulation; CPU Studio keeps its diagram and explanation paired. At narrow widths, secondary panels yield to the working canvas.
- Information pages share a stable sidebar and article measure. The complete author, privacy, cookie, and terms content stays intact.

## Interaction

- State changes respond immediately. Motion is limited to small press feedback and occasional overlays, under 220ms. Dragged and resized objects track the pointer directly without transitions.
- Keyboard focus is visible on every control and interactive diagram object. Dialog focus is contained and restored. Reduced motion removes travel while retaining clear state changes.
- The design adds no dependencies and does not change compilers, simulations, storage, analytics, consent decisions, or backend APIs.

## Audit decisions

1. **High impact:** the home wordmark and workspace heading competed for attention; workspace cards and previews had weak hierarchy. The launcher now puts Pico first, groups the five tools by task, and keeps examples legible.
2. **High impact:** Chrome and work surfaces varied across workspaces. Shared dimensions and theme-derived surface roles now distinguish navigation, editing, inspection, and temporary UI.
3. **High impact:** CPU buses and RAM rows, Logic Sim wires, and the cookie settings dialog had incomplete keyboard behavior. Selection now supports Enter and Space; the dialog moves, contains, and restores focus.
4. **Medium impact:** continuous glows, saving pulses, and a layout-changing update-link hover drew attention or spent frames without aiding use. State color remains while those effects are removed.
5. **Medium impact:** information pages and the 404 page used decorative gradients or variable layouts that pulled focus from content. Both now use a stable, theme-aware hierarchy.

The compiler engines, simulation algorithms, persistence format, telemetry, consent choices, and Cloudflare configuration are outside this redesign.
