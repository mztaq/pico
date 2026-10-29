import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, Cookie, FileText, ShieldCheck, Users } from 'lucide-react';
import { loadSettings } from '../../storage/settings';
import { cssVariables, getTheme } from '../themes';
import '../styles/site-info.css';
import '../../styles/info.css';

const pages = [
  { id: 'team', title: 'Pico Team', icon: Users },
  { id: 'privacy', title: 'Privacy Policy', icon: ShieldCheck },
  { id: 'cookies', title: 'Cookie Policy', icon: Cookie },
  { id: 'terms', title: 'Terms and Conditions', icon: FileText },
] as const;
export type InformationPage = typeof pages[number]['id'];

export function informationPageFromHash(hash: string): InformationPage | null {
  if (hash === '#authors') return 'team'; // Keep old links working.
  return pages.find(page => hash === `#${page.id}`)?.id ?? null;
}

export function SiteInfoLinks({ current }: { current?: InformationPage }) {
  return <nav className="site-info-links" aria-label="Pico information">
    {pages.map(({ id, title, icon: Icon }) => <a key={id} href={`#${id}`} aria-current={current === id ? 'page' : undefined}>
      <Icon size={17} aria-hidden="true" /><span>{title}</span>
    </a>)}
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
      description: 'I look after Pico’s deployments and help build new features, but I always get Amar’s approval before moving forward with them.',
      founder: true,
      roles: ['Head of Deployment', 'Media Manager'],
    },
    {
      name: 'Amar Ayache',
      description: 'Mustaqim and I build Pico together. We work on features side by side, review the changes, and merge pull requests when everything is ready.',
      founder: true,
      roles: ['Head of Development', 'Media Manager'],
    },
    {
      name: 'Mohamed Hamza',
      description: 'I bring new ideas for Pico and share practical ways to make it better, reach more people, and grow into a product used around the world.',
      founder: false,
      roles: ['Concept Developer'],
    },
    {
      name: 'Coming soon...',
      description: 'A spot for the next person bringing fresh ideas to Pico.',
      founder: false,
      roles: ['Concept Developer'],
    },
  ];
  const renderCard = ({ name, description, roles, founder }: typeof authors[number]) =>
    <section className={`author-card${founder ? ' author-card--founder' : ''}`} key={name}>
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
      <p>External services have their own policies. See the <a href="#cookies">Cookie Policy</a> for storage choices.</p>
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
      <p>For more detail, see the <a href="#privacy">Privacy Policy</a>.</p>
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
      <p>See the <a href="#privacy">Privacy Policy</a> for data handling. Third-party services and software have their own terms or licences.</p>
    </Section>
    <Section title="Updates and questions">
      <p>These terms may change; the current version appears here.</p>
    </Section>
  </>;
}

export function SiteInfo({ page }: { page: InformationPage }) {
  const [settings] = useState(loadSettings);
  const theme = getTheme(settings.theme);
  const heading = useRef<HTMLHeadingElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const { title, icon: Icon } = pages.find(item => item.id === page)!;
  useEffect(() => {
    for (const [property, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(property, value);
    document.documentElement.style.colorScheme = theme.appearance;
  }, [theme]);
  useEffect(() => {
    if (scrollArea.current) scrollArea.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [page]);
  const [sections, setSections] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    const found = [...(scrollArea.current?.querySelectorAll<HTMLElement>('main .site-info-section') ?? [])].map(section => ({ id: section.id, title: section.querySelector('h2')?.textContent ?? '' }));
    setSections(found);
  }, [page]);
  return <div ref={scrollArea} className="site-info-page" data-page={page} data-pico-theme={theme.id} data-high-contrast={theme.highContrast ? 'true' : undefined} style={cssVariables(theme) as React.CSSProperties}>
    <header className="site-info-header">
      <div className="site-info-header-inner">
        <a className="site-info-brand" href="#" aria-label="Pico home"><img src="/pico-logo.svg" alt="" />Pico<span className="brand-period">.</span></a>
        <a className="site-info-back" href="#"><ArrowLeft size={16} aria-hidden="true" />Back to workspaces</a>
      </div>
    </header>
    <div className="site-info-hero">
      <div className="site-info-hero-inner">
        <div className="site-info-title"><span className="site-info-mark"><Icon size={24} aria-hidden="true" /></span><h1 ref={heading} tabIndex={-1}>{title}</h1></div>
        {page === 'team' ? <p className="site-info-author-subtitle">The people behind Pico.</p> : <p className="site-info-intro">Last updated <time dateTime="2026-10-24">24 October 2026</time></p>}
      </div>
    </div>
    <div className="site-info-shell">
      <aside className="site-info-aside">
        <SiteInfoLinks current={page} />
        {sections.length > 0 && <nav className="site-info-toc" aria-label="On this page">
          <span>On this page</span>
          {sections.map(section => <button key={section.id} type="button" onClick={() => document.getElementById(section.id)?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })}>{section.title}</button>)}
        </nav>}
      </aside>
      <main>
        {page === 'team' ? <PicoTeam /> : page === 'privacy' ? <Privacy /> : page === 'cookies' ? <Cookies /> : <Terms />}
        {page !== 'team' && <p className="site-info-contact"><ArrowUpRight size={15} aria-hidden="true" />Related: <a href={page === 'privacy' ? '#cookies' : '#privacy'}>{page === 'privacy' ? 'Cookie Policy' : 'Privacy Policy'}</a></p>}
      </main>
    </div>
  </div>;
}
