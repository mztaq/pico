import { Bug } from 'lucide-react';
import { SiteInfoLinks } from './SiteInfo';
import './pico-app-footer.css';

/** Shared footer for the Pico homepage and Learn, including the same report control. */
export function PicoAppFooter({ onReport }: { onReport: () => void }) {
  return <footer className="pico-app-footer">
    <SiteInfoLinks />
    <button className="pico-app-footer-report" type="button" onClick={onReport}>
      <Bug size={17} aria-hidden="true" /><span>Report a Bug</span>
    </button>
  </footer>;
}
