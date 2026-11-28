import { useEffect, useRef, useState } from 'react';

export const WALLPAPER_ID = 'gojo-sukuna' as const;
export const WALLPAPERS = [
  { id: WALLPAPER_ID, name: 'Gojo & Sukuna', category: 'Anime', description: 'Looping video wallpaper', animated: true },
] as const;

export type WallpaperId = typeof WALLPAPERS[number]['id'];
export function isWallpaperId(value: unknown): value is WallpaperId {
  return value === WALLPAPER_ID;
}

interface WallpaperPickerProps {
  value?: string;
  onChange: (id: string | undefined) => void;
  highContrast?: boolean;
}

export function WallpaperPicker({ value, onChange, highContrast = false }: WallpaperPickerProps) {
  return <section className="wallpaper-picker" aria-label="Workspace wallpaper">
    <div className="wallpaper-picker-head">
      <span>Workspace wallpaper</span>
      <small>Applied to all workspaces</small>
    </div>
    <div className="wallpaper-grid" role="radiogroup" aria-label="Workspace wallpaper">
      <button type="button" role="radio" aria-checked={value === WALLPAPER_ID} className={`wallpaper-option wallpaper-option-gojo-sukuna ${value === WALLPAPER_ID ? 'active' : ''}`} onClick={() => onChange(WALLPAPER_ID)}>
        <span className="wallpaper-preview wallpaper-gojo-sukuna" aria-hidden="true" />
        <span className="wallpaper-option-copy"><strong>Gojo &amp; Sukuna</strong><small>Bundled looping video</small></span>
        <span className="wallpaper-option-check" aria-hidden="true">✓</span>
      </button>
    </div>
    <p className="wallpaper-note">{highContrast ? 'High contrast settings may reduce the wallpaper effect.' : 'The video is included with Pico and plays silently.'}</p>
  </section>;
}

const videoUrl = `${import.meta.env.BASE_URL}wallpapers/gojo-and-sukuna.mp4`;

export function WallpaperLayer({ wallpaper }: { wallpaper?: string }) {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const media = video.current;
    if (!media) return;
    const shouldPlay = visible && !reducedMotion && document.visibilityState !== 'hidden';
    media.autoplay = shouldPlay;
    if (shouldPlay && media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      try { void media.play()?.catch(() => undefined); } catch { /* Autoplay may be unavailable in embedded browsers. */ }
    }
    else if (!shouldPlay && media.readyState > HTMLMediaElement.HAVE_NOTHING) media.pause();
  }, [visible, reducedMotion]);

  if (!isWallpaperId(wallpaper)) return null;
  return <div className={`workspace-wallpaper wallpaper-${WALLPAPER_ID}`} data-paused={!visible || reducedMotion || undefined} data-video-failed={videoFailed || undefined} aria-hidden="true">
    <video ref={video} src={videoUrl} autoPlay muted loop playsInline preload="metadata" onCanPlay={event => {
      if (visible && !reducedMotion && document.visibilityState !== 'hidden') {
        try { void event.currentTarget.play()?.catch(() => undefined); } catch { /* Autoplay may be unavailable in embedded browsers. */ }
      }
    }} onError={() => setVideoFailed(true)} />
  </div>;
}
