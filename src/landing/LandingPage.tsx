import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, Download, Menu, X, Monitor, Laptop, Terminal, FileDown } from 'lucide-react';
import './landing.css';

const APP = '/app';
const DOWNLOADS = '#downloads';
const LiveCpuStudio = lazy(() => import('../cpu/CpuStudio').then(module => ({ default: module.CpuStudio })));

function Brand() {
  return <a className="lp-brand" href="/" aria-label="Pico home"><img src="/pico-logo.svg" alt="" width="33" height="33"/><span>Pico<span className="lp-brand-dot">.</span></span></a>;
}
function Navigation() {
  const [open,setOpen]=useState(false);
  useEffect(()=>{if(!open)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[open]);
  return <header className="lp-header"><div className="lp-container lp-nav"><Brand/><nav className={open?'lp-links is-open':'lp-links'} aria-label="Main navigation">
    <a href="#home" onClick={()=>setOpen(false)}>Home</a>
    <a href="#features" onClick={()=>setOpen(false)}>Features</a>
    <a href="#downloads" onClick={()=>setOpen(false)}>Downloads</a>
    <a href="#about" onClick={()=>setOpen(false)}>About</a>
    <a href={APP} className="lp-nav-mobile-cta">Open app <ArrowUpRight size={16}/></a>
  </nav><div className="lp-nav-actions"><a href={APP} className="lp-nav-start">Open app <ArrowUpRight size={15}/></a><button type="button" className="lp-menu" onClick={()=>setOpen(v=>!v)} aria-label={open?'Close menu':'Open menu'} aria-expanded={open}>{open?<X size={21}/>:<Menu size={21}/>}</button></div></div></header>;
}
function Reveal({children,className=''}:{children:ReactNode;className?:string}) {
  return <div className={className}>{children}</div>;
}
const installerGroups=[
  {platform:'Windows',icon:Monitor,files:[
    {name:'Pico_x64-setup.exe',format:'EXE installer',detail:'Windows · x64',size:'1.79 MiB'},
    {name:'Pico_x64_en-US.msi',format:'MSI installer',detail:'Windows · x64',size:'2.72 MiB'},
  ]},
  {platform:'macOS',icon:Laptop,files:[
    {name:'Pico_aarch64.dmg',format:'Apple Silicon DMG',detail:'M-series Macs · arm64',size:'2.62 MiB'},
    {name:'Pico_x64.dmg',format:'Intel DMG',detail:'Intel Macs · x64',size:'2.79 MiB'},
  ]},
  {platform:'Linux',icon:Terminal,files:[
    {name:'Pico_amd64.deb',format:'DEB package',detail:'Debian / Ubuntu · x64',size:'2.75 MiB'},
    {name:'Pico_amd64.AppImage',format:'AppImage',detail:'Linux · x64',size:'77.54 MiB'},
  ]},
] as const;

function DownloadsSection(){
  return <section id="downloads" className="lp-downloads"><div className="lp-container">
    <Reveal className="lp-downloads-heading">
      <div><h2>Download Pico</h2></div>
      <p>Choose an installer for your operating system. Pico requires an internet connection.</p>
    </Reveal>
    <div className="lp-download-groups">
      {installerGroups.map(({platform,icon:Icon,files})=>
        <Reveal className="lp-download-group" key={platform}>
          <div className="lp-download-group-header"><Icon size={19} aria-hidden="true"/><h3>{platform}</h3></div>
          <div className="lp-download-options">
            {files.map(file=><a className="lp-download-option" key={file.name} href={'/downloads/'+file.name} aria-label={'Download Pico '+file.format+' for '+file.detail}>
              <span className="lp-download-fileicon"><FileDown size={18} aria-hidden="true"/></span>
              <span className="lp-download-copy"><strong>{file.format}</strong><span>{file.detail}</span><small>{file.name}</small></span>
              <span className="lp-download-right"><span>{file.size}</span><Download size={17} aria-hidden="true"/></span>
            </a>)}
          </div>
        </Reveal>)}
    </div>
  </div></section>;
}

export default function LandingPage() {
  useEffect(() => {
    document.title='Pico | Built by Students, for Students';
    document.documentElement.style.colorScheme='dark';
    return () => { document.documentElement.style.colorScheme=''; };
  }, []);
  return <div className="lp"><Navigation/><main id="home">
    <section className="lp-hero lp-container">
      <div className="lp-hero-copy">
        <h1>Built by Students,<br/><span>for Students.</span></h1>
        <p>Pico brings programming, flowcharts, digital logic, CPU simulation and binary tools into one computer science learning platform.</p>
        <div className="lp-hero-actions">
          <a className="lp-button lp-button-primary" href={APP}>Use Pico in browser <ArrowUpRight size={17}/></a>
          <a className="lp-button lp-button-secondary" href={DOWNLOADS}>Desktop downloads <Download size={17}/></a>
        </div>
      </div>
      <div className="lp-hero-cpu" id="cpu-studio">
        <div className="lp-hero-cpu-bar">
          <span>CPU Studio</span>
          <a href={APP}>Open full studio <ArrowUpRight size={14}/></a>
        </div>
        <div className="lp-cpu-live" aria-label="Live Pico CPU Studio simulation">
          <Suspense fallback={<div className="lp-cpu-loading" role="status">Loading CPU Studio…</div>}>
            <LiveCpuStudio landingPreview onHome={() => window.location.assign(APP)} />
          </Suspense>
        </div>
      </div>
    </section>
    <section id="features" className="lp-features lp-container">
      <Reveal className="lp-section-heading">
        <h2>Features</h2>
        <p>Six workspaces for programming, algorithms and computer architecture.</p>
      </Reveal>
      <div className="lp-feature-grid lp-feature-text-grid">
        <Reveal className="lp-feature-card"><h3>Pseudocode and Python</h3><p>Run Cambridge-style pseudocode and Python with interactive input, debugging and syntax assistance.</p></Reveal>
        <Reveal className="lp-feature-card"><h3>Flowchart Builder</h3><p>Connect blocks, execute algorithms and convert flowcharts to pseudocode.</p></Reveal>
        <Reveal className="lp-feature-card"><h3>Logic Sim</h3><p>Connect logic gates and wires, then inspect live signals in circuits.</p></Reveal>
        <Reveal className="lp-feature-card"><h3>CPU Studio</h3><p>Follow the fetch–decode–execute cycle through working processor registers and memory.</p></Reveal>
        <Reveal className="lp-feature-card"><h3>Binary Lab</h3><p>Explore binary, hexadecimal, logical shifts, overflow and two's complement.</p></Reveal>
      </div>
    </section>
    <DownloadsSection/>
    <section id="about" className="lp-about lp-container">
      <Reveal className="lp-about-layout lp-about-simple">
        <h2>About Pico</h2>
        <div><p>Pico is a computer science learning platform developed by students. It brings together code execution and interactive tools for flowcharts, digital circuits, CPU execution and number systems.</p>
          <a href="/app#team" className="lp-text-link">Pico Team <ArrowUpRight size={16}/></a>
        </div>
      </Reveal>
    </section>
  </main>
  <footer className="lp-footer"><div className="lp-container">
    <div className="lp-footer-top"><div><Brand/></div>
      <nav aria-label="Footer navigation"><a href="#features">Features</a><a href="#cpu-studio">CPU Studio</a><a href="#downloads">Downloads</a><a href="#about">About</a><a href={APP}>Browser app</a><a href="/app#privacy">Privacy</a><a href="/app#terms">Terms</a></nav>
    </div>
    <div className="lp-footer-bottom"><span>© {new Date().getFullYear()} Pico</span></div>
  </div></footer></div>;
}
