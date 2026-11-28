# Animated workspace wallpapers: technical assessment

## Project fit

Pico is a React 19, TypeScript and Vite application. Its editor themes are defined in `src/app/themes.ts`, converted to CSS custom properties, and selected through the existing `ThemePicker`. Compiler workspaces are `PicoProject` records saved in browser storage by `src/storage/projects.ts`; the editor theme is currently a separate global setting. The compiler workspace shell already has inset space around opaque editor panels, which can show a decorative background while retaining readable surfaces.

## What browser wallpapers can support

Lively accepts images, video, web pages and shader/web content in its desktop application. Wallpaper Engine has video, web and rendered scene wallpaper formats, including 2D/3D and shader driven content. A normal browser app can render CSS animations, canvas/WebGL, and muted inline video, but it cannot host arbitrary native application wallpapers or assume desktop app integrations, GPU budget, codecs, autoplay, or unrestricted cross-origin access. Those desktop features are outside this implementation.

## Performance, compatibility and licensing

CSS gradients are inexpensive, require no network requests, and can keep a static appearance if motion is disabled. Canvas/WebGL and video add continuous rendering, memory, decoding, battery and mobile-data costs, so they should be opt-in and paused when their view is inactive. Browser visibility signals can pause media and are widely supported. Reduced-motion preferences must turn animation off. Wallpaper Engine Workshop content must not be copied without its creator's permission; this feature uses original CSS compositions and does not redistribute media or run wallpaper supplied scripts.

## Initial implementation scope

Add a small curated set of original CSS ambient backgrounds, rendered with static CSS previews, selected in Settings, and stored as an optional wallpaper ID on each compiler workspace. Preserve existing themes and use the current theme's sunken background as the `None` fallback. Do not add a media engine or third-party dependency.

## References

- [Lively Wallpaper repository](https://github.com/rocksdanister/lively)
- [Wallpaper Engine FAQ](https://help.wallpaperengine.io/)
- [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [Wallpaper Engine Workshop rules](https://help.wallpaperengine.io/en/steam/workshop.html)
