import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('Landing route migration leaves backend services available', () => {
  it('keeps Cloudflare Pages API, downloads and the new studio route enabled', () => {
    const routes = JSON.parse(read('public/_routes.json')) as { version: number; include: string[]; exclude: string[] };
    expect(routes.version).toBe(1);
    expect(routes.include).toEqual(expect.arrayContaining(['/api/*', '/downloads/*', '/app', '/app/*']));
    expect(routes.exclude).toEqual([]);
  });
  it('keeps D1-powered cookie and preferences endpoints in place', () => {
    expect(read('functions/api/cookies.ts')).toContain('ctx.env.DB');
    expect(read('functions/api/preferences.ts')).toContain('ctx.env.DB');
    expect(read('functions/api/usage.ts')).toContain('ctx.env.DB');
  });
  it('keeps bug reporting and Resend email integration in place', () => {
    const handler = read('functions/api/bug-report.ts');
    expect(handler).toContain('RESEND_API_KEY');
    expect(handler).toContain('BUG_REPORT_TO');
    expect(handler).toContain('ctx.env.DB');
  });
  it('keeps the landing CPU slider adjustable at a 4.7 GHz default without changing app CPU controls', () => {
    const cpu=read('src/cpu/CpuStudio.tsx');
    const css=read('src/landing/landing.css');
    expect(cpu).toContain('landingPreview?4.7:2');
    expect(cpu).toContain('max="9.2"');
    expect(cpu).toContain('step=".1"');
    expect(cpu).toContain('{clock.toFixed(1)} GHz');
    expect(css).toContain('.lp .cpu-embedded .cpu-speed{display:flex');
    expect(css).toContain('.lp-header-compact .lp-nav');
  });
  it('keeps previously released desktop apps at / on the workspace, not the landing page', () => {
    const entry = read('src/main.tsx');
    const route = read('src/app/entry-route.ts');
    const native = JSON.parse(read('src-tauri/tauri.conf.json')) as {build:{frontendDist:string}};
    expect(native.build.frontendDist).toBe('https://picompiler.pages.dev/app');
    expect(entry).toContain('isPicoDesktopWebview(window)');
    expect(route).toContain("pathname === '/' && inTauriWebview");
    expect(route).toContain('__TAURI_INTERNALS__');
  });
  it('keeps installer staging and Cloudflare Pages publication compatible with private GitHub repositories', () => {
    const landing=read('src/landing/LandingPage.tsx');
    const staging=read('scripts/stage-desktop-downloads.mjs');
    const publish=read('.github/workflows/publish-downloads.yml');
    const downloadHandler=read('functions/downloads/[filename].js');
    expect(landing).toContain("fetch('/download-assets/manifest.json'");
    expect(landing).not.toContain("fetch('https://api.github.com/repos/");
    expect(landing).toContain("'https://picompiler.pages.dev'+path");
    expect(staging).toContain("Pico_universal.dmg");
    expect(publish).toContain("gh run download 41126752856");
    expect(publish).toContain("gh release upload");
    expect(publish).toContain("node scripts/stage-desktop-downloads.mjs");
    expect(downloadHandler).toContain("'Pico_universal.dmg'");
  });
  it('preloads the fluid engine on landing and initializes the home canvas without a curve flash', () => {
    const entry = read('src/main.tsx');
    const home = read('src/app/components/HomeScreen.tsx');
    const fluid = read('src/app/components/HomeFluidBackground.tsx');
    expect(entry).toContain('checkHomeFluidSupport(isHomePage)');
    expect(entry).toContain("void import('./app/components/home-fluid-engine.js')");
    expect(fluid).toContain("import { startFluid } from './home-fluid-engine.js'");
    expect(fluid).toContain('useLayoutEffect(() => {');
    expect(fluid).not.toContain("import('./home-fluid-engine.js')");
    expect(home).toContain('<HomeFluidBackground theme={theme}');
    expect(home).toContain('fallback={<HomeAmbientCurves />}');
    expect(fluid).toContain('useState(false)');
    expect(fluid).toContain('!checkHomeFluidSupport()');
    expect(fluid).not.toContain('theme.highContrast');
    expect(fluid).toContain('}, [disabled]);');
    expect(fluid).toContain('{showFallback && fallback}');
    expect(read('src/app/components/GamesPage.tsx')).toContain('<HomeAmbientCurves />');
  });
  it('limits theme-aware liquid glass surfaces to the workspace chooser', () => {
    const home = read('src/app/components/HomeScreen.tsx');
    const css = read('src/styles/home.css');
    expect(home).toContain('className="pico-home pico-home-glass"');
    expect(css).toContain('.pico-home-glass .compiler-choice');
    expect(css).toContain('backdrop-filter: blur(var(--home-glass-blur))');
    expect(css).toContain('--home-glass-tint: color-mix(in srgb, var(--accent)');
    expect(css).toContain(".pico-home.pico-home-glass[data-high-contrast='true']");
    expect(read('src/app/components/GamesPage.tsx')).not.toContain('pico-home-glass');
    expect(read('src/landing/LandingPage.tsx')).not.toContain('pico-home-glass');
  });
  it('keeps studio telemetry within the app route', () => {
    const entry = read('src/main.tsx');
    expect(entry).toContain('<PicoTelemetry />');
    expect(entry).toContain('shouldRenderPicoWorkspace(window.location.pathname, isPicoDesktopWebview(window))');
  });
});
