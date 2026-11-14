import { useEffect } from 'react';
import { landingStyle, mocha } from './LandingPage';
import './ai-usage.css';

const title = 'Copyright & AI Usage | Pico';
const description = 'Pico copyright, automated access, and AI-assisted website reproduction policy.';
const canonicalUrl = 'https://picompiler.pages.dev/legal/ai-usage';

export default function AiUsagePage() {
  useEffect(() => {
    document.title = title;
    document.documentElement.style.colorScheme = 'dark';
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const previousDescription = meta?.content;
    const previousCanonical = canonical?.href;
    if (meta) meta.content = description;
    if (canonical) canonical.href = canonicalUrl;
    return () => {
      document.documentElement.style.colorScheme = '';
      if (meta && previousDescription !== undefined) meta.content = previousDescription;
      if (canonical && previousCanonical) canonical.href = previousCanonical;
    };
  }, []);

  return <div className="lp pico-ai-policy" data-landing-theme={mocha.id} style={landingStyle}>
    <header className="pico-ai-policy-header">
      <div className="lp-container pico-ai-policy-nav">
        <a className="lp-brand" href="/" aria-label="Pico home"><img src="/pico-logo.svg" alt="" width="33" height="33"/><span>Pico<span className="lp-brand-dot">.</span></span></a>
        <a className="pico-ai-policy-home" href="/">Back to Pico</a>
      </div>
    </header>
    <main id="main" className="lp-container pico-ai-policy-main">
      <div className="pico-ai-policy-heading">
        <p className="pico-ai-policy-eyebrow">Pico · Legal</p>
        <h1>Copyright &amp; AI Usage</h1>
        <p className="pico-ai-policy-intro">How Pico's original materials may be accessed and used.</p>
        <dl className="pico-ai-policy-meta">
          <div><dt>Effective date</dt><dd><time dateTime="2026-11-14">November 14, 2026</time></dd></div>
          <div><dt>Copyright holder</dt><dd>Amar Abdelhak Ayache</dd></div>
        </dl>
      </div>
      <article className="pico-ai-policy-content" aria-label="AI website cloning and copyright policy">
        <section>
          <h2>1. Copyright and ownership</h2>
          <p>Original materials published on Pico are owned by Amar Abdelhak Ayache or their respective rights holders and are protected by applicable intellectual property laws. These may include original visual compositions, layouts and creative arrangements, source code and proprietary implementations, graphics, illustrations, animations, written content, documentation, and branding.</p>
          <p>Access to this website does not itself grant a licence to reproduce copyright-protected expression. General ideas, functionality, methods, and design concepts are distinct from protected expression.</p>
        </section>
        <section>
          <h2>2. Website reproduction</h2>
          <p>Without prior written permission, copying, distributing, or substantially reproducing Pico's copyright-protected materials is prohibited to the extent applicable law allows. This applies whether reproduction is performed manually, through automated scraping or website replication, or with AI coding assistants such as Claude Code, Cursor, Windsurf, and ChatGPT.</p>
          <p>Using an AI tool does not independently grant permission to reproduce protected materials. Similar functionality or general design ideas do not, by themselves, establish copyright infringement.</p>
        </section>
        <section>
          <h2>3. AI systems and automated access</h2>
          <p>Automated crawlers and AI data collection services are requested to follow Pico's <a href="/robots.txt">robots.txt</a> directives. Access to public pages does not itself grant permission to reproduce, redistribute, or commercially exploit protected materials.</p>
          <p>Robots.txt communicates crawler preferences; it does not technically prevent all access, including visits through a person's browser or user-controlled tools.</p>
        </section>
        <section>
          <h2>4. Redistribution and commercial use</h2>
          <p>Unauthorized publication, redistribution, or commercial exploitation of substantially reproduced protected materials is prohibited to the extent permitted by applicable law. This includes presenting copied original materials as independently created or distributing unauthorized copies of proprietary assets or source code.</p>
        </section>
        <section>
          <h2>5. Permissions and licensing</h2>
          <p>To request permission to reproduce, adapt, redistribute, or otherwise use protected materials, contact the copyright holder through Pico's published contact information. Obtain written permission where applicable law requires it.</p>
        </section>
        <section>
          <h2>6. Legal limitations</h2>
          <p>This policy does not restrict lawful uses under applicable copyright exceptions, limitations, or other legal provisions. The scope and enforceability of these terms depend on applicable law.</p>
        </section>
        <section>
          <h2>7. Contact</h2>
          <p>For copyright inquiries, licensing requests, or permission questions, use the contact information provided on Pico.</p>
        </section>
      </article>
    </main>
    <footer className="lp-footer"><div className="lp-container"><small>© 2026 Amar Abdelhak Ayache. All rights reserved.</small></div></footer>
  </div>;
}
