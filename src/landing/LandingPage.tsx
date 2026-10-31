import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import { ArrowUpRight, Download, Menu, X, Monitor, Laptop, Terminal, ArrowRight } from 'lucide-react';
import { LandingCurves } from './LandingCurves';
import { getTheme } from '../app/themes';
import './landing.css';

const mocha=getTheme('catppuccin-mocha');
/** Use Pico's own theme seed and derived surface colors. No second landing palette. */
const landingStyle={
  '--lp-bg':mocha.bg,
  '--lp-panel':mocha.surface,
  '--lp-panel-raised':mocha.ui.surfaceRaised,
  '--lp-panel-hover':mocha.ui.surfaceHover,
  '--lp-text':mocha.text,
  '--lp-muted':mocha.muted,
  '--lp-accent':mocha.accent,
  '--lp-accent-strong':mocha.ui.accentStrong,
  '--lp-accent-soft':mocha.ui.accentSoft,
  '--lp-line':mocha.ui.borderSoft,
  '--lp-border':mocha.ui.border,
} as CSSProperties;

const APP = '/app';
const DOWNLOADS = '#downloads';
const LiveCpuStudio = lazy(() => import('../cpu/CpuStudio').then(module => ({ default: module.CpuStudio })));

function Brand() {
  return <a className="lp-brand" href="/" aria-label="Pico home"><img src="/pico-logo.svg" alt="" width="33" height="33"/><span>Pico<span className="lp-brand-dot">.</span></span></a>;
}
function Navigation() {
  const [open,setOpen]=useState(false);
  const [compact,setCompact]=useState(false);
  useEffect(()=>{
    if(!open)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[open]);
  useEffect(()=>{
    let previousY=window.scrollY;
    let lastDirection=0;
    let directionDistance=0;
    setCompact(!open&&previousY>120);
    const onScroll=()=>{
      const y=window.scrollY;
      const delta=y-previousY;
      previousY=y;
      if(open||y<=32){
        lastDirection=0;
        directionDistance=0;
        setCompact(false);
        return;
      }
      if(Math.abs(delta)<1)return;
      const direction=Math.sign(delta);
      if(direction!==lastDirection){
        lastDirection=direction;
        directionDistance=0;
      }
      directionDistance+=Math.abs(delta);
      // Small trackpad reversals should not repeatedly expand and collapse the pill.
      if(directionDistance<24)return;
      if(direction>0&&y>120)setCompact(true);
      if(direction<0)setCompact(false);
      directionDistance=0;
    };
    window.addEventListener('scroll',onScroll,{passive:true});
    return()=>window.removeEventListener('scroll',onScroll);
  },[open]);
  return <div className="lp-header-slot"><header className={compact?'lp-header lp-header-compact':'lp-header'}><div className="lp-container lp-nav"><Brand/><nav className={open?'lp-links is-open':'lp-links'} aria-label="Main navigation">
    <a href="#home" onClick={()=>setOpen(false)}>Home</a>
    <a href="#features" onClick={()=>setOpen(false)}>Tools</a>
    <a href="#downloads" onClick={()=>setOpen(false)}>Downloads</a>
  </nav><div className="lp-nav-actions"><button type="button" className="lp-menu" onClick={()=>setOpen(v=>!v)} aria-label={open?'Close menu':'Open menu'} aria-expanded={open}>{open?<X size={21}/>:<Menu size={21}/>}</button></div></div></header></div>;
}
const installerGroups=[
  {platform:'Windows',icon:Monitor,files:[
    {name:'Pico_x64-setup.exe',format:'EXE installer',sizeBytes:1878445},
    {name:'Pico_x64_en-US.msi',format:'MSI installer',sizeBytes:2850816},
  ]},
  {platform:'macOS',icon:Laptop,files:[
    {name:'Pico_aarch64.dmg',format:'Apple Silicon DMG',sizeBytes:2745913},
    {name:'Pico_x64.dmg',format:'Intel DMG',sizeBytes:2929669},
  ]},
  {platform:'Linux',icon:Terminal,files:[
    {name:'Pico_amd64.deb',format:'DEB package',sizeBytes:2881950},
    {name:'Pico_amd64.AppImage',format:'AppImage',sizeBytes:81304056},
  ]},
] as const;

// Show only one installer per OS after the universal macOS asset has actually
// been published. Until then, leave working legacy download links intact.
const singleInstallerGroups=[
  {platform:'Windows',icon:Monitor,files:[{name:'Pico_x64-setup.exe',format:'EXE installer',sizeBytes:1878445}]},
  {platform:'macOS',icon:Laptop,files:[{name:'Pico_universal.dmg',format:'Universal DMG',sizeBytes:0}]},
  {platform:'Linux',icon:Terminal,files:[{name:'Pico_amd64.AppImage',format:'AppImage',sizeBytes:81304056}]},
] as const;

const formatDownloadSize=(bytes:number)=>`${(bytes/1_000_000).toFixed(2)} MB`;
/** Always serve installers through public Cloudflare Pages assets.
 * Private GitHub releases require authentication, so preview sites link to
 * the live Cloudflare download service instead of GitHub. */
export function installerDownloadHref(filename:string,hostname:string):string{
  const path='/downloads/'+encodeURIComponent(filename);
  return hostname==='picompiler.pages.dev'
    ? path
    : 'https://picompiler.pages.dev'+path;
}
function DownloadsSection(){
  const [currentSizes,setCurrentSizes]=useState<Record<string,number>>({});
  const [singleInstallerRelease,setSingleInstallerRelease]=useState(false);
  useEffect(()=>{
    // This public Pages manifest is the actual published download inventory,
    // including when the source repository and its release are private.
    const controller=new AbortController();
    fetch('/download-assets/manifest.json',{signal:controller.signal})
      .then(response=>response.ok?response.json():null)
      .then((manifest:{files?:Record<string,{size?:number}>}|null)=>{
        if(controller.signal.aborted||!manifest?.files)return;
        const sizes:Record<string,number>={};
        for(const [name,file] of Object.entries(manifest.files)){
          if(typeof file?.size==='number'&&Number.isSafeInteger(file.size)&&file.size>0){
            sizes[name]=file.size;
          }
        }
        if(Object.keys(sizes).length)setCurrentSizes(sizes);
        const three=['Pico_x64-setup.exe','Pico_universal.dmg','Pico_amd64.AppImage'];
        // Never show files that are missing from the public download manifest.
        if(three.every(name=>sizes[name]>0)&&Object.keys(sizes).length===3){
          setSingleInstallerRelease(true);
        }
      })
      .catch(()=>{/* Keep known sizes and legacy links until deployment completes. */});
    return()=>controller.abort();
  },[]);
  return <section id="downloads" className="lp-downloads" aria-labelledby="lp-downloads-title">
    <div className="lp-downloads-heading">
      <h2 id="lp-downloads-title">Download Pico</h2>
    </div>
    <div className="lp-download-groups">
      {(singleInstallerRelease?singleInstallerGroups:installerGroups).map(({platform,icon:Icon,files})=>
        <div className="lp-download-group" key={platform}>
          <div className="lp-download-group-header"><Icon size={19} aria-hidden="true"/><h3>{platform}</h3></div>
          <div className="lp-download-options">
            {files.map(file=><a className="lp-download-option" key={file.name} href={installerDownloadHref(file.name,window.location.hostname)} aria-label={'Download '+file.name+' for '+platform}>
              <span className="lp-download-copy"><strong>{file.name}</strong><small>{(currentSizes[file.name]??file.sizeBytes)>0?formatDownloadSize(currentSizes[file.name]??file.sizeBytes):'Size unavailable'}</small></span>
              <Download className="lp-download-arrow" size={17} aria-hidden="true"/>
            </a>)}
          </div>
        </div>)}
    </div>
  </section>;
}

export default function LandingPage() {
  useEffect(() => {
    document.title='Pico | Built by Students, for Students';
    document.documentElement.style.colorScheme='dark';
    document.documentElement.classList.add('pico-landing-scroll');
    return () => {
      document.documentElement.style.colorScheme='';
      document.documentElement.classList.remove('pico-landing-scroll');
    };
  }, []);
  return <div className="lp" data-landing-theme={mocha.id} style={landingStyle}><LandingCurves/><Navigation/><main id="home">
    <section className="lp-hero lp-container">
      <div className="lp-hero-copy">
        <h1>By the<br/><span className="lp-hero-highlight">Pico Team.</span></h1>
        <p>Built by Students, for Students</p>
        <div className="lp-hero-actions">
          <a className="lp-button lp-button-primary" href={APP}>Use Pico in browser <ArrowUpRight size={17}/></a>
          <a className="lp-button lp-button-secondary" href={DOWNLOADS}>Download for desktop <Download size={17}/></a>
        </div>
      </div>
      <div className="lp-hero-cpu" id="cpu-studio">
        <div className="lp-cpu-live" aria-label="Live Pico CPU Studio simulation">
          <Suspense fallback={<div className="lp-cpu-loading" role="status">Loading CPU Studio…</div>}>
            <LiveCpuStudio landingPreview onHome={() => window.location.assign(APP)} />
          </Suspense>
        </div>
      </div>
    </section>
    <section className="lp-tools-downloads lp-container" aria-label="Pico tools and desktop downloads">
      <section id="features" className="lp-features" aria-labelledby="lp-features-title">
        <div className="lp-section-heading"><h2 id="lp-features-title">Pico's tools</h2></div>
        <div className="lp-feature-groups">
          <div className="lp-feature-group">
            <div className="lp-feature-category"><h3>Programming</h3></div>
            <div className="lp-feature-items">
              <a className="lp-feature-item" href="/app?tool=pseudocode" aria-label="Open Pseudocode in Pico"><span className="lp-feature-item-head"><h4>Pseudocode</h4><ArrowRight size={16} aria-hidden="true"/></span><p>Write and run pseudocode.</p></a>
              <a className="lp-feature-item" href="/app?tool=python" aria-label="Open Python in Pico"><span className="lp-feature-item-head"><h4>Python</h4><ArrowRight size={16} aria-hidden="true"/></span><p>Execute Python code.</p></a>
            </div>
          </div>
          <div className="lp-feature-group">
            <div className="lp-feature-category"><h3>Visual tools</h3></div>
            <div className="lp-feature-items">
              <a className="lp-feature-item" href="/app?tool=flowchart" aria-label="Open Flowchart Builder in Pico"><span className="lp-feature-item-head"><h4>Flowchart Builder</h4><ArrowRight size={16} aria-hidden="true"/></span><p>Build and run flowcharts.</p></a>
              <a className="lp-feature-item" href="/app?tool=logic" aria-label="Open Logic Sim in Pico"><span className="lp-feature-item-head"><h4>Logic Sim</h4><ArrowRight size={16} aria-hidden="true"/></span><p>Test logic circuits.</p></a>
            </div>
          </div>
          <div className="lp-feature-group">
            <div className="lp-feature-category"><h3>Computer systems</h3></div>
            <div className="lp-feature-items">
              <a className="lp-feature-item" href="/app?tool=cpu" aria-label="Open CPU Studio in Pico"><span className="lp-feature-item-head"><h4>CPU Studio</h4><ArrowRight size={16} aria-hidden="true"/></span><p>Explore CPU execution.</p></a>
              <a className="lp-feature-item" href="/app?tool=binary" aria-label="Open Binary Lab in Pico"><span className="lp-feature-item-head"><h4>Binary Lab</h4><ArrowRight size={16} aria-hidden="true"/></span><p>Convert binary and hexadecimal.</p></a>
            </div>
          </div>
        </div>
      </section>
      <DownloadsSection/>
    </section>
  </main>
  <footer className="lp-footer"><div className="lp-container">
    <small>© 2026 Pico Development Team. All rights reserved.</small>
  </div></footer></div>;
}
