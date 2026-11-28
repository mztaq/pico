# Animated workspace wallpapers: technical assessment

## Project fit

Pico is a React 19, TypeScript and Vite application. Its editor themes are defined in `src/app/themes.ts`, converted to CSS custom properties, and selected through the existing `ThemePicker`. Compiler workspaces are `PicoProject` records saved in browser storage by `src/storage/projects.ts`; the editor theme is currently a separate global setting. The compiler workspace shell already has inset space around opaque editor panels, which can show a decorative background while retaining readable surfaces.

## What browser wallpapers can support

Lively's Web Player hosts ordinary webpages in Chromium based WebView2 or CEF, and its documentation says browser features can be used alongside optional Lively APIs. Wallpaper Engine has video, web and rendered scene wallpaper formats, including 2D/3D and shader driven content. Pico uses the same browser-native foundation: CSS for theme-aware static fallbacks and previews, Canvas 2D for original animated scenes, and muted inline video for a user-imported clip. A normal website cannot host arbitrary native wallpaper formats or assume desktop app integrations, GPU budget, codecs, autoplay, or unrestricted cross-origin access. Those desktop features are outside this implementation.

## Performance, compatibility and licensing

CSS gradients are inexpensive, require no network requests, and keep a static appearance if motion is disabled. Canvas and video add rendering, memory, decoding and battery costs, so Pico caps Canvas rendering to 30 fps and 1.5x device pixel ratio, pauses work when the document is hidden, and honors reduced motion. Imported video is muted, stored in IndexedDB on the user's device, and limited to 100 MB; it is not bundled into or redistributed with the repository. Wallpaper Engine Workshop content must not be copied without its creator's permission. Pico runs no wallpaper supplied scripts.

## Initial implementation scope

Add a curated set of original ambient and anime inspired scenes, selected in Settings and stored as an optional wallpaper ID on each compiler workspace. Users can optionally import a local MP4/WebM as a video wallpaper; the media blob stays in that browser's IndexedDB. Preserve existing themes and use the current theme's sunken background as the `None` fallback. Do not add a third-party dependency.

## References

- [Lively Wallpaper repository](https://github.com/rocksdanister/lively)
- [Lively Web Player documentation](https://github.com/lively-community/lively/wiki/Web-Player)
- [Wallpaper Engine FAQ](https://help.wallpaperengine.io/)
- [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [Wallpaper Engine Workshop rules](https://help.wallpaperengine.io/en/steam/workshop.html)
