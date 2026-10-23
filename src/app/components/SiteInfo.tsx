import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Code2, FileText, GitBranch, Lightbulb, ShieldCheck, Users } from 'lucide-react';
import { loadSettings } from '../../storage/settings';
import { cssVariables, getTheme } from '../themes';
import '../styles/site-info.css';

const pages = [
  { id: 'authors', title: 'Authors', icon: Users },
  { id: 'privacy', title: 'Privacy Policy', icon: ShieldCheck },
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
    { name: 'Muhammad Mustaqim 11BR', role: 'Implements features and manages deployment and releases', icon: GitBranch },
    { name: 'Amar Ayache 11BB', role: 'Built Pico’s foundation and guides new features and their implementation', icon: Code2 },
    { name: 'Mohamed Hamza 11BR', role: 'Develops concepts and supports marketing and promotion', icon: Lightbulb },
  ];
  return <>
    <div className="author-grid">{authors.map(({ name, role, icon: Icon }) => <section className="author-card" key={name}>
      <span className="author-icon"><Icon size={24} aria-hidden="true" /></span>
      <h2>{name}</h2><p className="author-role">{role}</p>
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
      <p>The app does not include advertising or analytics trackers, and does not set its own tracking cookies. Hosting providers may process technical information separately as described in their policies.</p>
    </Section>
    <Section title="Links and feedback">
      <p>External links take you to services with their own privacy practices. If you choose to post a report on <a href="https://github.com/mztaq/pico/issues">GitHub Issues</a>, GitHub processes it under its own policies and the report may be public. Do not include private information.</p>
    </Section>
    <Section title="Changes and questions">
      <p>We will update this page when Pico's data practices change. For general privacy questions, contact the maintainers through <a href="https://github.com/mztaq/pico/issues">the project repository</a> without posting personal information.</p>
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
        {page === 'authors' ? <Authors /> : page === 'privacy' ? <Privacy /> : <Terms />}
      </main>
      <SiteInfoLinks current={page} />
    </div>
  </div>;
}
