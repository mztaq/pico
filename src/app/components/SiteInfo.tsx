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
    <Section title="Your projects and input">
      <p>Pico runs its compilers and simulations in your browser. It does not automatically upload your code, console input, practice files or diagrams to the maintainers.</p>
      <p>Code you choose to run can make network requests where supported. Only run code you trust, and avoid entering passwords or sensitive personal information.</p>
    </Section>
    <Section title="Browser storage">
      <p>Pico uses local storage to remember compiler projects, flowcharts, settings, tutorial progress and which updates you have seen. This data stays in that browser profile until you delete it or the browser clears it. It does not sync through a Pico account.</p>
      <p>People who share your browser profile may be able to access saved projects. Export anything you want to keep, then clear this site's data in your browser settings to remove its saved data. Clearing site data also resets your preferences and tutorials.</p>
    </Section>
    <Section title="Hosting, fonts and updates">
      <p>Cloudflare Pages hosts Pico. Requests for the site, its runtime files and its update log pass through Cloudflare, which may process connection information such as your IP address and request details to deliver and protect the service. See <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare's privacy policy</a>.</p>
      <p>Pico loads fonts from Google Fonts. Your browser contacts Google to download them, sharing connection information such as your IP address and browser details. See the <a href="https://fonts.google.com/faq">Google Fonts FAQ</a> and <a href="https://policies.google.com/privacy">Google's privacy policy</a>.</p>
      <p>Pico does not show advertisements. If you enable optional analytics, Pico records anonymous workspace activity and browser details to understand usage. If you enable preferences, Pico stores selected settings for this browser. See the <a href="#cookies">Cookie Policy</a> to manage these choices.</p>
    </Section>
    <Section title="Optional analytics and preferences">
      <p>Optional analytics record a random browser identifier, broad browser and operating-system information, visit times, and time spent in Pico's five workspaces. This is not a hardware device ID. No source code or editor input is sent for analytics.</p>
      <p>Optional preferences store a browser identifier and your selected theme and settings. You may withdraw permission using Cookie Settings, which removes the corresponding active records. Data expires after approximately 90 days without renewal, with expired-record cleanup still being introduced.</p>
    </Section>
    <Section title="Links and feedback">
      <p>External links take you to services with their own privacy practices. If you choose to post a report on <a href="https://github.com/mztaq/pico/issues">GitHub Issues</a>, GitHub processes it under its own policies and the report may be public. Do not include private information.</p>
    </Section>
    <Section title="Changes and questions">
      <p>We will update this page when Pico's data practices change. For general privacy questions, contact the maintainers through <a href="https://github.com/mztaq/pico/issues">the project repository</a> without posting personal information.</p>
    </Section>
  </>;
}

function Cookies() {
  return <>
    <Section title="What are cookies?">
      <p>Cookies are small values stored by your browser and sent to a website with requests. Pico also uses browser-local storage for projects, settings and your cookie choices.</p>
    </Section>
    <Section title="Essential storage">
      <p>Pico remembers your cookie choices in browser storage under <code>pico.consent.v1</code>. This choice is used to avoid repeatedly displaying the consent banner. Local projects and compiler settings continue working without optional cookies.</p>
    </Section>
    <Section title="Optional analytics">
      <p>If you accept analytics, Pico sets an HttpOnly, Secure cookie named <code>__Host-pico_id</code>. It stores a randomly generated identifier, not your hardware ID. The server stores a one-way hash of this identifier.</p>
      <p>With consent, Pico collects broad browser and operating-system information, recent visits and active time spent in its Logic Simulator, Python Compiler, Pseudocode Compiler, Flowchart Builder and CPU Studio. This helps us understand which tools are used. We do not send the contents of code files or console inputs for analytics.</p>
    </Section>
    <Section title="Optional preferences">
      <p>If you accept preference storage, Pico uses the same browser cookie to associate selected themes and editor settings with that browser. Your projects and code are not uploaded as part of this feature. This cloud preference-sync feature is still under development.</p>
    </Section>
    <Section title="Duration and choice">
      <p>The optional identifier cookie is set for up to 90 days. Server visitor and consent records carry expiry timestamps, with automated deletion being prepared. Browser-local consent choices last until site storage is removed or you change the choice.</p>
      <p>All optional categories are off until you choose to accept them. You may reject optional cookies, accept them, or adjust each category in Cookie Settings. Rejecting them does not prevent you from using Pico.</p>
    </Section>
    <Section title="Changing or withdrawing consent">
      <p>Select Cookie Settings in the page corner to update your choices. Turning off both optional categories causes Pico to request deletion of the associated server records and clear the identifier cookie. You may also clear Pico's cookies and local storage using your browser settings.</p>
      <p>See our <a href="#privacy">Privacy Policy</a> for more information about local projects, hosting providers and external links.</p>
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
      <p>Features and these terms may change as Pico develops. Updates to these terms will appear here with a new date. Report problems or ask general questions through <a href="https://github.com/mztaq/pico/issues">the project repository</a>.</p>
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
        <p className="site-info-intro">{page === 'authors' ? 'The people behind Pico.' : <>Last updated <time dateTime="2026-10-23">23 October 2026</time></>}</p>
        {page === 'authors' ? <Authors /> : page === 'privacy' ? <Privacy /> : page === 'cookies' ? <Cookies /> : <Terms />}
      </main>
      <SiteInfoLinks current={page} />
    </div>
  </div>;
}
