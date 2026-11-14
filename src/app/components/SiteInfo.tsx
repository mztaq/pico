import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Cookie, FileText, ShieldCheck, Users, X } from 'lucide-react';
import { loadSettings } from '../../storage/settings';
import { cssVariables, getTheme } from '../themes';
import '../styles/site-info.css';
import '../../styles/info.css';
import './site-info-dialog.css';

const pages = [
  { id: 'team', title: 'Pico Team', icon: Users },
  { id: 'privacy', title: 'Privacy Policy', icon: ShieldCheck },
  { id: 'cookies', title: 'Cookie Policy', icon: Cookie },
  { id: 'terms', title: 'Terms and Conditions', icon: FileText },
] as const;
export type InformationPage = typeof pages[number]['id'];

export function informationPageFromPath(pathname: string): InformationPage | null {
  return pages.find(page => pathname === `/app/${page.id}` || pathname === `/app/${page.id}/`)?.id ?? null;
}

export function informationPageFromHash(hash: string): InformationPage | null {
  return pages.find(page => hash === `#${page.id}`)?.id ?? null;
}

export function SiteInfoLinks({ current }: { current?: InformationPage }) {
  return <nav className="site-info-links" aria-label="Pico information">
    {pages.map(({ id, title, icon: Icon }) => <a key={id} href={`/app/${id}`} aria-current={current === id ? 'page' : undefined} onClick={event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      window.history.pushState(window.history.state, '', `/app/${id}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }}>
      <Icon size={17} aria-hidden="true" /><span>{title}</span>
    </a>)}
    <a href="/legal/ai-usage"><FileText size={17} aria-hidden="true" /><span>Copyright &amp; AI Usage</span></a>
  </nav>;
}

const slug = (title: string) => 'section-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="site-info-section" id={slug(title)}><h2>{title}</h2><div className="site-info-section-body">{children}</div></section>;
}

function PicoTeam() {
  const authors = [
    {
      name: 'Muhammad Mustaqim',
      description: 'I manage Pico’s deployments and help build new features with Amar’s approval. We also consider suggestions from our concept developers.',
      founder: true,
      roles: ['Head of Deployment', 'Backend Dev', 'Media Manager'],
    },
    {
      name: 'Amar Ayache',
      description: 'Mustaqim and I build Pico side by side, review changes, and merge pull requests. We also consider suggestions from our concept developers.',
      founder: true,
      roles: ['Head of Development', 'Frontend Dev', 'Media Manager'],
    },
    {
      name: 'Mohamed Hamza',
      description: 'I bring new ideas for Pico and share practical ways to make it better, reach more people, and grow into a product used around the world.',
      founder: false,
      roles: ['Concept Developer', 'Outreach'],
    },
    {
      name: 'Mithunan Yogeswaran',
      description: 'I work with Hamza to explore new ideas and suggest improvements to Pico’s features and user experience, helping it grow worldwide.',
      founder: false,
      roles: ['Concept Developer', 'UX Feedback'],
    },
    {
      name: 'Coming soon...',
      description: 'Another spot for a future Pico concept developer.',
      founder: false,
      roles: ['Concept Developer'],
    },
  ];
  const renderCard = ({ name, description, roles, founder }: typeof authors[number], index: number) =>
    <section className={`author-card${founder ? ' author-card--founder' : ''}`} key={`${founder ? "founder" : "concept"}-${index}`}>
      <h3>{name}</h3>
      <p className="author-description">{description}</p>
      <ul className="author-roles" aria-label={`Roles for ${name}`}>{roles.map(role => <li key={role}>{role}</li>)}</ul>
    </section>;
  return <div className="author-grid">
    <h2 className="team-group-title">Co-founders</h2>
    {authors.filter(author => author.founder).map(renderCard)}
    <h2 className="team-group-title team-group-title--concept">Concept Developers</h2>
    {authors.filter(author => !author.founder).map(renderCard)}
  </div>;
}

function Privacy() {
  return <>
    <Section title="Your work">
      <p>Your code, console input, projects and diagrams remain in your browser. Optional analytics does not collect their contents. They leave your device only if you export or share them.</p>
    </Section>
    <Section title="Service and storage">
      <p>Browser storage saves projects, settings and consent choices. Cloudflare hosts Pico and Google Fonts serves some typography; those providers may process connection information.</p>
    </Section>
    <Section title="Optional data">
      <p>If you opt in, analytics records browser information, visits and time spent in workspaces. Optional preferences store selected settings. A random browser identifier links those records; neither option is required.</p>
    </Section>
    <Section title="Retention and controls">
      <p>Optional records are retained for approximately 90 days, potentially renewed through continued use. Cookie Settings lets you withdraw consent; turning both optional categories off clears the identifier and requests deletion of linked records. You can clear local browser storage yourself.</p>
    </Section>
    <Section title="More information">
      <p>External services have their own policies. See the <span className="site-info-policy-reference">Cookie Policy</span> for storage choices.</p>
    </Section>
  </>;
}

function Cookies() {
  return <>
    <Section title="Essential storage">
      <p>Browser storage saves projects, settings and consent choices needed for Pico to work.</p>
    </Section>
    <Section title="Your choices">
      <p><strong>Analytics</strong> records visits, browser information and workspace usage. <strong>Preferences</strong> remembers selected settings. Both are off until you opt in. Neither collects your code, project files or console input.</p>
      <p>With consent, an identifier cookie links optional records so your choices can be managed. Security measures also help prevent abuse.</p>
    </Section>
    <Section title="Control and retention">
      <p>Optional records generally expire after approximately 90 days unless renewed. Change consent in Cookie Settings; disabling both optional categories clears the identifier and requests deletion of linked records. Pico remains usable without them.</p>
      <p>For more detail, see the <span className="site-info-policy-reference">Privacy Policy</span>.</p>
    </Section>
  </>;
}

function Terms() {
  return <>
    <Section title="Using Pico">
      <p>Pico is a free educational tool. Use it lawfully and respect others' work and applicable school or exam rules.</p>
    </Section>
    <Section title="Results and learning materials">
      <p>Simulations and examples can be simplified or incorrect; verify important results against course materials. Pico is not affiliated with or endorsed by Cambridge International or any exam board.</p>
    </Section>
    <Section title="Your work">
      <p>Your work remains yours. Using Pico does not transfer ownership. Only use material you have permission to access.</p>
      <p>Export important projects: browser storage can be lost, and Pico has no account-based backups.</p>
    </Section>
    <Section title="Availability and responsibility">
      <p>Pico is provided as available, without guaranteed uptime, accurate results or recovery of lost work. To the extent permitted by law, the maintainers disclaim warranties and liability. Applicable legal rights are not excluded.</p>
    </Section>
    <Section title="Privacy and third-party services">
      <p>See the <span className="site-info-policy-reference">Privacy Policy</span> for data handling. Third-party services and software have their own terms or licences.</p>
    </Section>
    <Section title="Updates and questions">
      <p>These terms may change; the current version appears here.</p>
    </Section>
  </>;
}

export function SiteInfo({ page, onClose }: { page: InformationPage; onClose: () => void }) {
  const [settings] = useState(loadSettings);
  const theme = getTheme(settings.theme);
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const { title, icon: Icon } = pages.find(item => item.id === page)!;

  useEffect(() => {
    for (const [property, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(property, value);
    document.documentElement.style.colorScheme = theme.appearance;
  }, [theme]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),[tabindex="0"]'
      ) ?? []);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current || document.activeElement === heading.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [onClose]);

  useEffect(() => {
    if (scrollArea.current) scrollArea.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [page]);

  return <div className="site-info-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section
      ref={dialog}
      className="site-info-page site-info-dialog"
      data-page={page}
      data-pico-theme={theme.id}
      data-high-contrast={theme.highContrast ? 'true' : undefined}
      style={cssVariables(theme) as React.CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pico-info-dialog-title"
    >
      <header className="site-info-hero site-info-dialog-heading">
        <div className="site-info-hero-inner">
          <div className="site-info-title">
            <span className="site-info-mark"><Icon size={24} aria-hidden="true" /></span>
            <div className="site-info-heading-copy">
              <h1 id="pico-info-dialog-title" ref={heading} tabIndex={-1}>{title}</h1>
              {page === 'team'
                ? <p className="site-info-author-subtitle">The people behind Pico.</p>
                : <p className="site-info-intro">Last updated <time dateTime="2026-10-24">24 October 2026</time></p>}
            </div>
          </div>
          <button type="button" className="site-info-dialog-close" aria-label={`Close ${title}`} onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </header>
      <div ref={scrollArea} className="site-info-dialog-scroll">
        <div className="site-info-shell">
          <main>
            {page === 'team' ? <PicoTeam /> : page === 'privacy' ? <Privacy /> : page === 'cookies' ? <Cookies /> : <Terms />}
          </main>
        </div>
      </div>
    </section>
  </div>;
}
