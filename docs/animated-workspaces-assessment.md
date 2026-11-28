# Animated workspace wallpapers: technical assessment

## Project fit

Pico is a React 19, TypeScript and Vite application. Its editor themes are defined in `src/app/themes.ts`, converted to CSS custom properties, and selected through the existing `ThemePicker`. Compiler workspaces are `PicoProject` records saved in browser storage by `src/storage/projects.ts`; the editor theme is currently a separate global setting. The compiler workspace shell already has inset space around opaque editor panels, which can show a decorative background while retaining readable surfaces.

## What browser wallpapers can support

Lively's Web Player hosts ordinary webpages in Chromium based WebView2 or CEF, and its documentation says browser features can be used alongside optional Lively APIs. Wallpaper Engine has video, web and rendered scene wallpaper formats, including 2D/3D and shader driven content. Pico uses the same browser-native foundation: a bundled muted inline video with CSS theme-aware fallback. A normal website cannot host arbitrary native wallpaper formats or assume desktop app integrations, GPU budget, codecs, autoplay, or unrestricted cross-origin access. Those desktop features are outside this implementation.

## Performance, compatibility and licensing

Video adds decoding, memory and battery costs. The supplied clip was reduced from 4K/30 fps to 1080p/24 fps, uses H.264, and is served as a same-origin bundled MP4. Pico mutes and loops playback, pauses when the document is hidden, and honors reduced motion with a static theme-aware fallback. Wallpaper Engine Workshop content must not be copied without its creator's permission. Pico runs no wallpaper supplied scripts.

## Initial implementation scope

Use the user's provided video as the single workspace wallpaper, bundled locally with Pico and applied to every compiler workspace. Preserve existing editor themes and use a static theme-aware fallback when video playback is unavailable or reduced motion is enabled. Do not add a third-party dependency.

## References

- [Lively Wallpaper repository](https://github.com/rocksdanister/lively)
- [Lively Web Player documentation](https://github.com/lively-community/lively/wiki/Web-Player)
- [Wallpaper Engine FAQ](https://help.wallpaperengine.io/)
- [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [Wallpaper Engine Workshop rules](https://help.wallpaperengine.io/en/steam/workshop.html)
