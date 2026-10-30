import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronRight, Code2, Cpu, Download, GitBranch, Menu, X, Binary, Play, CheckCircle2, Monitor, Laptop, Terminal, FileDown } from 'lucide-react';
import './landing.css';

const APP = '/app';
const DOWNLOADS = '#downloads';
const tools = [
  {name:'Pseudocode',icon:'<>',desc:'Write, execute and debug Cambridge-style pseudocode.'},
  {name:'Python',icon:'py',desc:'Run Python with interactive input and debugging.'},
  {name:'Flowcharts',icon:'↗',desc:'Build executable flowcharts and convert them to pseudocode.'},
  {name:'Logic Sim',icon:'∧',desc:'Build circuits and inspect live signals.'},
  {name:'CPU Studio',icon:'⌘',desc:'Follow the fetch–decode–execute cycle.'},
  {name:'Binary Lab',icon:'01',desc:'Explore number systems, shifts and two’s complement.'},
];

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
function Reveal({children,className=''}:{children:React.ReactNode;className?:string}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!('IntersectionObserver' in window)){ref.current?.classList.add('lp-visible');return;}
    const obs=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){e.target.classList.add('lp-visible');obs.unobserve(e.target)}}},{threshold:.09,rootMargin:'0px 0px -35px 0px'});
    if(ref.current)obs.observe(ref.current);
    return()=>obs.disconnect();
  },[]);
  return <div className={'lp-reveal '+className} ref={ref}>{children}</div>;
}
function ProcessorScene() {
  return <div className="lp-processor" aria-label="Isometric illustration of a processor and connected computing layers" role="img">
    <div className="lp-scene-glow"/>
    <svg className="lp-processor-svg" viewBox="0 0 650 570" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="lp-top" x1="173" y1="172" x2="467" y2="386" gradientUnits="userSpaceOnUse"><stop stopColor="#28203e"/><stop offset="1" stopColor="#11101f"/></linearGradient>
        <linearGradient id="lp-side" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#241c37"/><stop offset="1" stopColor="#0c0914"/></linearGradient>
        <linearGradient id="lp-edge" x1="150" y1="130" x2="488" y2="430" gradientUnits="userSpaceOnUse"><stop stopColor="#dd9fff"/><stop offset=".58" stopColor="#8651ee"/><stop offset="1" stopColor="#543184"/></linearGradient>
        <filter id="lp-light" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      <g className="lp-scenelines" stroke="#6a488d" strokeWidth="1" opacity=".24">
        {Array.from({length:10},(_,i)=><path key={'a'+i} d={`M ${20+i*60} 425 l 250 110`}/>)}
        {Array.from({length:10},(_,i)=><path key={'b'+i} d={`M ${10+i*65} 535 l 250 -110`}/>)}
      </g>
      <g className="lp-chip-base">
        <path d="M133 335 311 233 515 351 337 454Z" stroke="#4b325f" fill="#0b0a15"/>
        <path d="M161 289 313 201 491 304 339 392Z" fill="#100e1a" stroke="#7749a8"/>
        <path d="M161 289v32l178 102v-31Z" fill="#171124" stroke="#65468d"/>
        <path d="M339 392v31l152-88v-31Z" fill="#0c0a14" stroke="#65468d"/>
        {Array.from({length:8},(_,i)=><g key={i} stroke="#9c69d0" strokeWidth="2"><path d={`M ${186+i*17} ${348+i*10} v14`}/><path d={`M ${384+i*12} ${364-i*7} v13`}/></g>)}
      </g>
      <g className="lp-chip-middle">
        <path d="M198 250 319 180 456 259 335 330Z" fill="url(#lp-top)" stroke="url(#lp-edge)" strokeWidth="1.7"/>
        <path d="M198 250v20l137 80v-20Z" fill="url(#lp-side)" stroke="#7450a2"/>
        <path d="M335 330v20l121-71v-20Z" fill="#13101d" stroke="#7450a2"/>
        <path d="m233 249 86-49 104 60-86 49Z" stroke="#b787ed" strokeOpacity=".44"/>
        {Array.from({length:6},(_,i)=><path key={i} d={`m${242+i*12} ${250+i*7} 85 -49`} stroke="#9964c5" strokeOpacity=".2"/>)}
        <path d="M278 249 319 226l43 25-42 24Z" fill="#a855f7" fillOpacity=".13" stroke="#c88aff"/>
        <path d="M295 250l23-13 27 15-23 14Z" fill="#b777ff" opacity=".28" filter="url(#lp-light)"/>
      </g>
      <g className="lp-chip-top">
        <path d="M229 189 320 137 423 196 331 249Z" fill="#21192f" stroke="#b17ef3" strokeWidth="2"/>
        <path d="M229 189v20l102 59v-19Z" fill="#241733" stroke="#8259ae"/>
        <path d="M331 249v19l92-53v-19Z" fill="#0d0b17" stroke="#8259ae"/>
        <path d="M252 190 320 151 398 196 331 235Z" stroke="#be87fa" strokeOpacity=".45"/>
        <path d="M291 190 320 174l33 19-29 17Z" fill="#b15dff" fillOpacity=".25" stroke="#d8a6ff"/>
        <path d="M320 174v-28 M291 190l-17-10 M353 193l22-13" stroke="#d9abff" strokeWidth="1.5" strokeDasharray="3 6"/>
        <circle cx="320" cy="146" r="3.5" fill="#d6a0ff"/><circle cx="274" cy="180" r="3" fill="#b17ef3"/><circle cx="375" cy="180" r="3" fill="#b17ef3"/>
      </g>
      <g stroke="#a47ade" strokeWidth="1.2" opacity=".74"><path d="m175 290-55 32v28l-54 31"/><path d="m473 310 60-34v-34l51-29"/><path d="m338 425v45l71 41"/><path d="m319 136V93l-48-28"/></g>
      <g fill="#c08cff"><circle cx="66" cy="381" r="3"/><circle cx="584" cy="213" r="3"/><circle cx="409" cy="511" r="3"/><circle cx="271" cy="65" r="3"/></g>
      <g className="lp-chip-label"><rect x="426" y="115" width="116" height="29" rx="6" fill="#151020" stroke="#69488e"/><text x="438" y="133" fill="#d8bdff" fontSize="10" fontFamily="monospace" letterSpacing="2">CORE / PICO</text></g>
    </svg>
    <span className="lp-float-label lp-float-label-1">PROCESS · EXECUTE</span><span className="lp-float-label lp-float-label-2">0010 / 1010</span>
  </div>;
}
function FeatureVisual({type}:{type:'code'|'flow'|'logic'}) {
  if(type==='code') return <div className="lp-visual lp-visual-code"><div className="lp-code-window"><div className="lp-window-head"><i/><i/><i/><span>main.pico</span></div><div className="lp-code-lines"><div><em>01</em> <b>DECLARE</b> score : INTEGER</div><div><em>02</em> <b>INPUT</b> score</div><div><em>03</em> <b>IF</b> score &gt;= 50 <b>THEN</b></div><div><em>04</em> &nbsp; <b>OUTPUT</b> <strong>"Pass"</strong></div><div><em>05</em> <b>ENDIF</b></div></div><div className="lp-code-result"><Play size={11} fill="currentColor"/> Run complete <CheckCircle2 size={13}/></div></div></div>;
  if(type==='flow')return <div className="lp-visual lp-visual-flow"><svg viewBox="0 0 320 220" fill="none" aria-hidden="true"><defs><linearGradient id="lp-fl-node" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#322443"/><stop offset="1" stopColor="#131020"/></linearGradient></defs><path d="M157 36V71 M157 115v30 M157 178v20" stroke="#a87bde" strokeWidth="2" strokeDasharray="5 5"/><path d="m151 66 6 7 6-7m-12 74 6 7 6-7m-12 54 6 7 6-7" stroke="#d8a8ff" strokeWidth="2"/><rect x="116" y="8" width="82" height="27" rx="13" fill="url(#lp-fl-node)" stroke="#b889ed"/><path d="M101 78H213L200 115H114Z" fill="url(#lp-fl-node)" stroke="#ac7cdb"/><path d="m157 144 48 19-48 19-48-19Z" fill="url(#lp-fl-node)" stroke="#ac7cdb"/><rect x="116" y="199" width="82" height="18" rx="9" fill="#261a37" stroke="#b889ed"/><g fill="#e6d6fb" fontSize="11" fontFamily="monospace" textAnchor="middle"><text x="157" y="26">START</text><text x="157" y="100">INPUT x</text><text x="157" y="168">x &gt; 0?</text><text x="157" y="212" fontSize="9">END</text></g><path d="M205 162h48v-60h-43" stroke="#7e55a9" strokeDasharray="4 5"/><text x="232" y="155" fill="#c5a1e3" fontSize="9">NO</text></svg></div>;
  return <div className="lp-visual lp-visual-logic"><svg viewBox="0 0 320 220" fill="none" aria-hidden="true"><g stroke="#9569ca" strokeWidth="2"><path d="M34 74h80 M34 144h80 M208 109h64"/><path d="M114 53h45c32 0 48 20 49 56-1 36-17 57-49 57h-45Z" fill="#21172e" stroke="#c28bff"/></g><g fill="#21172e" stroke="#a77dce"><rect x="12" y="60" width="32" height="28" rx="5"/><rect x="12" y="130" width="32" height="28" rx="5"/><circle cx="285" cy="109" r="20" fill="#331e50" stroke="#df9aff"/></g><g fill="#e3cefd" fontFamily="monospace" textAnchor="middle" fontSize="13"><text x="28" y="79">1</text><text x="28" y="149">1</text><text x="153" y="114">AND</text><text x="285" y="114">1</text></g><circle cx="247" cy="109" r="4" fill="#dca4ff"/><circle cx="285" cy="109" r="28" stroke="#a855f7" opacity=".15"/></svg></div>;
}
function ProductPreview() {
  return <div className="lp-product-window" aria-label="Recreated preview of Pico's real workspace selection and pseudocode editor">
    <div className="lp-product-top"><span className="lp-window-dots"><i/><i/><i/></span><span>picompiler.pages.dev/app</span><span className="lp-product-top-icon">↗</span></div>
    <div className="lp-product-body"><aside className="lp-product-side"><div className="lp-product-side-brand"><img src="/pico-logo.svg" alt="" width="20" height="20"/> Pico.</div><span className="lp-product-side-heading">WORKSPACES</span><span className="lp-side-active"><Code2 size={13}/> Pseudocode</span><span><span className="lp-mini-icon">py</span> Python Compiler</span><span><GitBranch size={13}/> Flowchart Builder</span><span><Binary size={13}/> Logic Sim</span><span><Cpu size={13}/> CPU Studio</span><span><span className="lp-mini-icon">01</span> Binary Lab</span></aside><div className="lp-product-editor"><div className="lp-editor-head"><span>hello.pico</span><span className="lp-editor-badge">● Ready</span></div><div className="lp-editor-code"><p><em>01</em><span className="lp-syntax-purple">DECLARE</span> Name : STRING</p><p><em>02</em><span className="lp-syntax-purple">INPUT</span> Name</p><p><em>03</em><span className="lp-syntax-purple">OUTPUT</span> <span className="lp-syntax-string">"Hello "</span>, Name</p><p><em>04</em></p></div><div className="lp-editor-console"><div className="lp-console-top"><span>Console</span><span className="lp-console-running"><CheckCircle2 size={13}/> Finished</span></div><div className="lp-console-content">Hello, student!<span>Process exited successfully.</span></div></div></div></div>
  </div>;
}

const spotlight=[
  {title:'Pseudocode and Python',body:'Write, run and debug code in the browser.',icon:Code2},
  {title:'Flowchart Builder',body:'Build and execute flowcharts, then convert them into pseudocode.',icon:GitBranch},
  {title:'CPU Studio',body:'Explore the fetch–decode–execute cycle.',icon:Cpu},
  {title:'Binary Lab',body:'Work with binary, hexadecimal, shifts and two’s complement.',icon:Binary},
];

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
      <div><span className="lp-kicker">DESKTOP APP</span><h2>Download Pico</h2></div>
      <p>Choose an installer for your operating system. Pico requires an internet connection.</p>
    </Reveal>
    <div className="lp-download-groups">
      {installerGroups.map(({platform,icon:Icon,files})=>
        <Reveal className="lp-download-group" key={platform}>
          <div className="lp-download-group-header"><Icon size={19} aria-hidden="true"/><h3>{platform}</h3></div>
          <div className="lp-download-options">
            {files.map(file=><a className="lp-download-option" key={file.name} href={'/downloads/'+file.name} download={file.name} aria-label={'Download Pico '+file.format+' for '+file.detail}>
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
  const [active,setActive]=useState(0);
  useEffect(()=>{document.title='Pico | Built by Students, for Students';document.documentElement.style.colorScheme='dark';return()=>{document.documentElement.style.colorScheme='';}},[]);
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
      <div className="lp-hero-art"><ProcessorScene/></div>
    </section>
    <section id="features" className="lp-features lp-container">
      <Reveal className="lp-section-heading">
        <div><h2>Features</h2></div>
        <p>Six workspaces for programming, algorithms and computer architecture.</p>
      </Reveal>
      <div className="lp-feature-grid">
        <Reveal className="lp-feature-card">
          <span className="lp-figure">01 / PROGRAMMING</span><FeatureVisual type="code"/>
          <h3>Pseudocode and Python</h3><p>Run Cambridge-style pseudocode and Python with interactive input, debugging and syntax assistance.</p>
        </Reveal>
        <Reveal className="lp-feature-card">
          <span className="lp-figure">02 / ALGORITHMS</span><FeatureVisual type="flow"/>
          <h3>Flowchart Builder</h3><p>Connect blocks, execute algorithms and convert flowcharts to pseudocode.</p>
        </Reveal>
        <Reveal className="lp-feature-card">
          <span className="lp-figure">03 / DIGITAL LOGIC</span><FeatureVisual type="logic"/>
          <h3>Logic Sim</h3><p>Connect logic gates and wires, then inspect live signals in your circuits.</p>
        </Reveal>
      </div>
    </section>
    <section id="platform" className="lp-showcase-section">
      <div className="lp-container">
        <Reveal className="lp-showcase-heading"><h2>Inside Pico</h2><p>A simplified preview of Pico's browser tools.</p></Reveal>
        <div className="lp-showcase-layout">
          <Reveal className="lp-showcase-left"><ProductPreview/><div className="lp-preview-caption"><span>ILLUSTRATIVE INTERFACE PREVIEW</span><a href={APP}>Open the app <ArrowUpRight size={15}/></a></div></Reveal>
          <Reveal className="lp-showcase-list">
            <span className="lp-list-heading">WORKSPACES</span>
            {spotlight.map(({title,body,icon:Icon},i)=><button key={title} type="button" className={'lp-spotlight '+(active===i?'is-active':'')} onClick={()=>setActive(i)} aria-expanded={active===i}>
              <span className="lp-spotlight-icon"><Icon size={20}/></span>
              <span className="lp-spotlight-text"><strong>{title}</strong><span>{body}</span></span>
              <ChevronRight size={17} className="lp-spotlight-arrow"/>
            </button>)}
          </Reveal>
        </div>
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
      <nav aria-label="Footer navigation"><a href="#features">Features</a><a href="#downloads">Downloads</a><a href="#about">About</a><a href={APP}>Browser app</a><a href="/app#privacy">Privacy</a><a href="/app#terms">Terms</a></nav>
    </div>
    <div className="lp-footer-bottom"><span>© {new Date().getFullYear()} Pico</span></div>
  </div></footer></div>;
}
