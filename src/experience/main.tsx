import React, {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowUpRight,Download,ChevronDown} from 'lucide-react';
import './world.css';

const releases='https://github.com/mztaq/pico/releases/download/desktop-v0.1.0-build.10/';
const stations=[
  {title:'Pseudocode',sub:'Compile and debug',tag:'.pico'},
  {title:'Python',sub:'Run code interactively',tag:'.py'},
  {title:'Flowchart',sub:'Design algorithms',tag:'FLOW'},
  {title:'Logic Sim',sub:'Connect digital gates',tag:'AND'},
  {title:'CPU Studio',sub:'Fetch, decode, execute',tag:'CPU'},
  {title:'Binary Lab',sub:'Represent data',tag:'01'}
];
const parts=[
  {x:0,y:0,z:0,ry:0,rx:0},
  {x:95,y:-22,z:-920,ry:6,rx:-2},
  {x:-85,y:32,z:-1840,ry:-5,rx:3},
  {x:70,y:-20,z:-2760,ry:6,rx:-2},
  {x:-45,y:8,z:-3680,ry:-4,rx:1},
  {x:0,y:0,z:-4600,ry:0,rx:0},
];
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t)};
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
function World(){
  const area=useRef<HTMLDivElement>(null),rig=useRef<HTMLDivElement>(null);
  const [active,setActive]=useState(0),[reduced,setReduced]=useState(false);
  useEffect(()=>{
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion=()=>setReduced(motion.matches);
    updateMotion();motion.addEventListener('change',updateMotion);
    return()=>motion.removeEventListener('change',updateMotion);
  },[]);
  useEffect(()=>{
    const scroller=area.current,world=rig.current;
    if(!scroller||!world)return;
    let frame=0;
    const paint=()=>{
      frame=0;
      const total=Math.max(1,scroller.scrollHeight-scroller.clientHeight);
      const position=clamp(scroller.scrollTop/total)*5;
      const a=Math.min(4,Math.floor(position)),t=smooth(position-a),b=Math.min(5,a+1);
      const p=parts[a],q=parts[b];
      if(!p||!q)return;
      const x=lerp(p.x,q.x,t),y=lerp(p.y,q.y,t),z=lerp(p.z,q.z,t);
      const ry=lerp(p.ry,q.ry,t),rx=lerp(p.rx,q.rx,t);
      world.style.transform=`translate3d(${-x}px,${-y}px,${-z}px) rotateY(${-ry}deg) rotateX(${-rx}deg)`;
      const next=Math.round(position);
      setActive(v=>v===next?v:next);
    };
    const queue=()=>{if(!frame)frame=requestAnimationFrame(paint)};
    paint();scroller.addEventListener('scroll',queue,{passive:true});
    window.addEventListener('resize',queue,{passive:true});
    return()=>{scroller.removeEventListener('scroll',queue);window.removeEventListener('resize',queue);if(frame)cancelAnimationFrame(frame)};
  },[]);
  function Scene({index,children,extra=''}:{index:number;children:React.ReactNode;extra?:string}){
    const p=parts[index];
    return <section className={`world-stop world-stop-${index} ${extra}`} style={{transform:`translate3d(${p.x}px,${p.y}px,${p.z}px)`}} aria-hidden={Math.abs(index-active)>1} inert={Math.abs(index-active)>1}>{children}</section>;
  }
  return <div className="journey" ref={area}>
    <div className="journey-stage">
      <div className="journey-world" ref={rig}>
        <Scene index={0} extra="scene-hero">
          <div className="hero-heading"><div className="hero-brand"><img src="/pico-logo.svg" alt=""/>Pico<span>.</span></div><h1>Built by students,<br/><em>for students.</em></h1><p>Learn computer science by using it.</p>
          <div className="hero-actions"><a className="world-button" href="/">Use Pico in Browser <ArrowUpRight size={18}/></a><a className="plain-action" href="#downloads" onClick={e=>{e.preventDefault();const v=area.current;if(v)v.scrollTo({top:v.scrollHeight*.8,behavior:reduced?'instant':'smooth'})}}>Download Pico <Download size={17}/></a></div></div>
          <div className="hero-installation" aria-hidden="true"><div className="installation-face"><span>01</span><strong>PICO</strong><small>COMPUTER SCIENCE STUDIO</small></div><div className="installation-edge"/><div className="installation-floor"/></div>
        </Scene>
        <Scene index={1} extra="scene-gallery">
          <div className="scene-intro"><h2>Six spaces.<br/>One Pico.</h2><p>Choose what you want to explore.</p></div>
          <div className="gallery-geometry">{stations.map((s,i)=><a className={`gallery-object gallery-object-${i}`} href="/" key={s.title}><span className="gallery-object-edge" aria-hidden="true"/><span className="gallery-object-face"><small>0{i+1}</small><b>{s.tag}</b><strong>{s.title}</strong><em>{s.sub}</em></span></a>)}</div>
        </Scene>
        <Scene index={2} extra="scene-flow">
          <div className="scene-intro"><h2>Connect<br/>the logic.</h2><p>Build a flowchart. Test a circuit.</p></div>
          <div className="flow-structure" aria-hidden="true"><div className="flow-link flow-link-a"/><div className="flow-link flow-link-b"/><div className="flow-link flow-link-c"/><div className="flow-node flow-node-start"><span>START</span></div><div className="flow-node flow-node-decision"><span>IF</span></div><div className="flow-node flow-node-output"><span>OUTPUT</span></div><div className="flow-gate"><div className="gate-input"/><span>AND</span><div className="gate-output"/></div></div>
        </Scene>
        <Scene index={3} extra="scene-cpu">
          <div className="scene-intro"><h2>Inside<br/>the CPU.</h2><p>Follow the fetch, decode and execute cycle.</p></div>
          <div className="cpu-machine" aria-label="3D arrangement of CPU components"><div className="cpu-base"/><div className="cpu-traces" aria-hidden="true">{Array.from({length:7},(_,i)=><i key={i}/>)}</div><div className="cpu-die"><div className="cpu-die-top">CPU</div><div className="cpu-die-side"/></div><div className="cpu-module module-cu">CU</div><div className="cpu-module module-alu">ALU</div><div className="cpu-module module-registers">REGISTERS</div><div className="cpu-module module-ram">RAM</div></div>
        </Scene>
        <Scene index={4} extra="scene-download" >
          <div className="scene-intro"><h2 id="downloads">Pico,<br/>everywhere.</h2><p>Run it in your browser or install the desktop app. Internet required.</p></div>
          <div className="download-machines"><a className="download-device browser-device" href="/"><strong>Browser</strong><span>Open Pico <ArrowUpRight size={17}/></span></a><a className="download-device windows-device" href={releases+'Pico_x64-setup.exe'}><strong>Windows</strong><span>Installer <Download size={16}/></span></a><a className="download-device mac-device" href={releases+'Pico_aarch64.dmg'}><strong>macOS</strong><span>Apple Silicon <Download size={16}/></span></a><a className="download-device linux-device" href={releases+'Pico_amd64.AppImage'}><strong>Linux</strong><span>AppImage <Download size={16}/></span></a></div>
          <div className="download-alternatives"><a href={releases+'Pico_x64.dmg'}>macOS Intel</a><a href={releases+'Pico_amd64.deb'}>Linux Debian/Ubuntu</a></div>
        </Scene>
        <Scene index={5} extra="scene-team">
          <div className="scene-intro"><h2>Meet the<br/>Pico Team.</h2></div>
          <div className="team-gallery"><div className="team-name team-founder"><small>CO-FOUNDER</small><strong>Muhammad Mustaqim</strong></div><div className="team-name team-founder"><small>CO-FOUNDER</small><strong>Amar Ayache</strong></div><div className="team-name team-concept"><small>CONCEPT DEVELOPER</small><strong>Mohamed Hamza</strong></div><div className="team-name team-concept"><small>CONCEPT DEVELOPER</small><strong>Mithunan Yogeswaran</strong></div></div>
          <div className="team-bottom"><a href="/">Launch Pico <ArrowUpRight size={17}/></a><a href="/#privacy">Privacy</a><a href="/#terms">Terms</a><a href="https://github.com/mztaq/pico">GitHub</a></div>
        </Scene>
      </div>
      <div className="journey-nav">
        <a className="journey-logo" href="/experience/" aria-label="Pico home"><img src="/pico-logo.svg" alt=""/>Pico.</a>
        <div className="journey-nav-right"><span className="journey-count">{String(active+1).padStart(2,'0')} / 06</span><a href="/" className="journey-launch">Use Pico in Browser <ArrowUpRight size={16}/></a></div>
      </div>
      <div className="journey-bottom"><span>Scroll to explore <ChevronDown size={15}/></span><div className="journey-chapters">{parts.map((_,i)=><button key={i} type="button" onClick={()=>{const scroller=area.current;if(scroller)scroller.scrollTo({top:i/5*(scroller.scrollHeight-scroller.clientHeight),behavior:reduced?'instant':'smooth'})}} aria-label={`Go to chapter ${i+1}`} aria-current={i===active?'step':undefined}/>)}</div></div>
    </div>
    <div className="journey-spacer" aria-hidden="true"/>
  </div>;
}
createRoot(document.getElementById('root')!).render(<World/>);
