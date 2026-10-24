import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Code2, FileText, GitBranch, Lightbulb, ShieldCheck, Users } from 'lucide-react';
import { loadSettings } from '../../storage/settings';
import { cssVariables, getTheme } from '../themes';
import '../styles/site-info.css';

const pages = [
  { id: 'authors', title: 'Authors', icon: Users },
  { id: 'privacy', title: 'Privacy Policy', icon: ShieldCheck },
  { id: 'cookies', title: 'Cookie Policy', icon: ShieldCheck },
  { id: 'terms', title: 'Terms and Conditions', icon: FileText },
] as const;
export type InformationPage = typeof pages[number]['id'];

export function informationPageFromHash(hash: string): InformationPage | null {
  return pages.find(page => hash === `#${page.id}`)?.id ?? null;
}

export function SiteInfoLinks({ current }: { current?: InformationPage }) {
  return <nav className="site-info-links" aria-label="Pico information">
    {pages.map(({ id, title, icon: Icon }) => <a key={id} href={`#${id}`} aria-current={current === id ? 'page' : undefined}>
      <Icon size={17} aria-hidden="true" /><span>{title}</span>
    </a>)}
  </nav>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="site-info-section"><h2>{title}</h2>{children}</section>;
}

function Authors() {
  const authors = [
    { name: 'Muhammad Mustaqim 11BR', description: 'Implements features and manages deployment and releases.', roles: ['Head of Deployment', 'Media Manager'], icon: GitBranch },
    { name: 'Amar Ayache 11BB', description: 'Built Pico’s foundation and guides its development.', roles: ['Head of Development', 'Media Manager'], icon: Code2 },
    { name: 'Mohamed Hamza 11BR', description: 'Develops concepts and supports marketing and promotion.', roles: ['Concept Developer', 'Media Manager'], icon: Lightbulb },
  ];
  return <>
    <div className="author-grid">{authors.map(({ name, description, roles, icon: Icon }) => <section className="author-card" key={name}>
      <span className="author-icon"><Icon size={24} aria-hidden="true" /></span>
      <h2>{name}</h2><p className="author-description">{description}</p>
      <div className="author-roles"><h3>Roles</h3><ul aria-label={`Roles for ${name}`}>{roles.map(role => <li key={role}>{role}</li>)}</ul></div>
    </section>)}</div>
    <Section title="Built with">
      <p>Pico uses <a href="https://react.dev/">React</a>, <a href="https://codemirror.net/">CodeMirror</a>, <a href="https://pyodide.org/">Pyodide</a> and <a href="https://lucide.dev/">Lucide</a>, alongside other third-party libraries.</p>
    </Section>
  </>;
}

function Privacy() {
  return <>
    <Section title="Your work">
      <p>Pico runs code and simulations in your browser. Your code, console input, projects and diagrams are not collected by Pico's optional analytics. Saved projects stay in your browser unless you export or share them yourself.</p>
    </Section>
    <Section title="Service and storage">
      <p>Browser storage keeps your projects, settings and consent choices. Our hosting and font providers may process connection details needed to deliver the website. Pico uses Cloudflare for hosting and Google Fonts for some typography.</p>
    </Section>
    <Section title="Optional data">
      <p>With your permission, Pico collects limited usage statistics, including browser information, visits and time spent in workspaces. If you allow preferences, selected settings are also stored to remember your choices. A random browser identifier helps associate those records. Neither option is required to use Pico.</p>
    </Section>
    <Section title="Retention and controls">
      <p>Optional records are retained for up to approximately 90 days, subject to renewal when Pico is used, and expired records are routinely removed. Use Cookie Settings to change or withdraw your choice. Withdrawing both optional permissions clears the identifier cookie and requests deletion of its associated records. You can also clear browser storage at any time.</p>
    </Section>
    <Section title="More information">
      <p>Other websites and services linked from Pico have their own policies. See our <a href="#cookies">Cookie Policy</a> for the optional categories. Material changes to these practices will be reflected here.</p>
    </Section>
  </>;
}

function Cookies() {
  return <>
    <Section title="Essential storage">
      <p>Pico uses browser storage to keep your projects, settings and consent choice. This allows core features to work without optional tracking.</p>
    </Section>
    <Section title="Your choices">
      <p><strong>Analytics</strong> helps us understand visits, browser types and workspace usage. <strong>Preferences</strong> remembers your chosen theme and settings. Both are optional and off until you agree. Your source code, project files and console input are not collected through either category.</p>
      <p>When enabled, a secure browser cookie identifies the consented session so related records can be managed. Basic security measures also help protect the service from misuse.</p>
    </Section>
    <Section title="Control and retention">
      <p>Optional records normally expire after approximately 90 days unless renewed. You can change your choices using Cookie Settings. Turning both optional categories off clears the identifier and requests deletion of its associated records. Rejecting them does not affect access to Pico.</p>
      <p>For more detail, see the <a href="#privacy">Privacy Policy</a>.</p>
    </Section>
  </>;
}

function Terms() {
  return <>
    <Section title="Using Pico">
      <p>Pico is a free tool for learning and practising programming and Computer Science. Use it lawfully, respect other people's work and follow any rules set by your school or exam centre.</p>
    </Section>
    <Section title="Results and learning materials">
      <p>Compiler behaviour, examples and simulations may contain mistakes or simplify real systems. Check important results against your course materials. Pico is an independent project and is not affiliated with or endorsed by Cambridge International or another exam board.</p>
    </Section>
    <Section title="Your work">
      <p>You keep your rights to the code and other work you create. Running or saving it in Pico does not transfer ownership to the maintainers. Only import, run or share material you have permission to use.</p>
      <p>Export important projects regularly. Browser storage can be cleared or become unavailable, and Pico does not provide account-based backups.</p>
    </Section>
    <Section title="Availability and responsibility">
      <p>Pico is provided as available, without a promise of uninterrupted access, error-free results or recovery of lost work. To the extent permitted by applicable law, the maintainers disclaim warranties and liability for losses arising from its use. Nothing here excludes rights or responsibilities that cannot legally be excluded.</p>
    </Section>
    <Section title="Privacy and third-party services">
      <p>The <a href="#privacy">Privacy Policy</a> explains local storage and requests to hosting and font providers. External services have their own terms, and third-party software retains its own licences.</p>
    </Section>
    <Section title="Updates and questions">
      <p>Features and these terms may change as Pico develops. Updates to these terms will appear here.</p>
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
  return <div ref={scrollArea} className="site-info-page" data-pico-theme={theme.id} data-high-contrast={theme.highContrast ? 'true' : undefined} style={cssVariables(theme) as React.CSSProperties}>
    <div className="site-info-shell">
      <header className="site-info-header">
        <a className="site-info-brand" href="#" aria-label="Pico home"><img src="/pico-logo.svg" alt="" />Pico<span className="brand-period">.</span></a>
        <a className="site-info-back" href="#"><ArrowLeft size={17} aria-hidden="true" />Home</a>
      </header>
      <main>
        <div className="site-info-title"><span className="site-info-mark"><Icon size={28} aria-hidden="true" /></span><h1 ref={heading} tabIndex={-1}>{title}</h1></div>
        <p className="site-info-intro">{page === 'authors' ? 'The people behind Pico.' : <>Last updated <time dateTime="2026-10-24">24 October 2026</time></>}</p>
        {page === 'authors' ? <Authors /> : page === 'privacy' ? <Privacy /> : page === 'cookies' ? <Cookies /> : <Terms />}
      </main>
      <SiteInfoLinks current={page} />
    </div>
  </div>;
}
