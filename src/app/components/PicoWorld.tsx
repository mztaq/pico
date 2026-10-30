import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import './pico-world.css';

type Block = { x: number; y: number; z: number; sx: number; sy: number; sz: number; color: [number, number, number] };
const stone: [number, number, number] = [.15, .12, .23];
const edge: [number, number, number] = [.39, .30, .53];
const violet: [number, number, number] = [.77, .58, .96];
const light: [number, number, number] = [.54, .43, .75];
const dark: [number, number, number] = [.24, .19, .36];
const pearl: [number, number, number] = [.76, .71, .84];

function objects(): Block[] {
  const result: Block[] = [];
  const add = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: Block['color']) => {
    result.push({x, y, z, sx, sy, sz, color});
  };
  // A physical corridor. The user travels along this axis when scrolling.
  for (let z = 7; z >= -42; z -= 3.2) {
    add(-4.45, -.72, z, .045, .045, 1.55, edge);
    add(4.45, -.72, z, .045, .045, 1.55, edge);
    add(-4.45, -.72, z - 1.55, .12, .06, .045, edge);
    add(4.45, -.72, z - 1.55, .12, .06, .045, edge);
  }
  // Chapter 1: stacked code lines suspended above an editor motherboard.
  add(0, -.62, 0, 7.2, .28, 5.6, stone);
  add(-3.45, -.4, 0, .08, .13, 5.55, light);
  add(3.45, -.4, 0, .08, .13, 5.55, light);
  for (let i = 0; i < 8; i++) {
    const w = [3.5, 4.9, 2.7, 5.1, 4.1, 2.5, 4.5, 3.2][i];
    const h = .17 + i * .07;
    add(-2.55 + w / 2, h, 2.03 - .57 * i, w, .11, .15, i % 3 === 0 ? violet : pearl);
    add(-2.84, h, 2.03 - .57 * i, .12, .12, .15, light);
  }
  add(2.95, .68, 1.95, .23, 1.7, .4, dark);
  add(2.95, 1.55, 1.95, .23, .08, .4, violet);
  // Chapter 2: flowchart nodes connected physically to a logic gate.
  add(0, -.62, -14, 7.2, .28, 6.0, stone);
  const nodes = [
    {x: -2.4, z: -11.9}, {x: 0, z: -13.4}, {x: 2.4, z: -14.8}, {x: 0, z: -16.1},
  ];
  nodes.forEach((n,i) => {
    add(n.x, .12, n.z, i===1?1.45:1.2, .48, .9, i===1? violet : edge);
    add(n.x, .4, n.z, .48, .04, .48, pearl);
  });
  const wires = [
    [-1.2,-12.65,-.85,-12.65],[1.2,-14.15,.95,-14.15],[1.25,-15.45,.95,-15.45]
  ];
  wires.forEach(([x1,z1,x2,z2]) => add((x1+x2)/2, .03,(z1+z2)/2,Math.abs(x2-x1)+.75,.08,.09,light));
  // Gate-inspired U-shaped geometry, not a generic floating object.
  add(-2.45,.85,-15.8,.2,1.2,.2,light);
  add(-1.5,.85,-15.8,.2,1.2,.2,light);
  add(-1.97,1.42,-15.8,1.15,.16,.2,violet);
  // Chapter 3: an exposed CPU die, control bus and register columns.
  add(0,-.62,-29,7.5,.28,6.5,stone);
  add(0,.05,-29,3.1,1.12,3.1,edge);
  add(0,.64,-29,2.35,.12,2.35,violet);
  add(0,.75,-29,1.45,.09,1.45,pearl);
  for(let i=0;i<7;i++){
    const p=-2.75+i*.9;
    add(p,-.28,-31, .35,.15,1.12,light);
    add(p,-.28,-27, .35,.15,1.12,light);
    add(-3,-.28,-28.98+i*.5,1.08,.15,.22,light);
    add(3,-.28,-28.98+i*.5,1.08,.15,.22,light);
  }
  for (let i=0; i<4; i++) {
    add(-2.65+i*.58,.45,-25.7,.31,.92,.55,i%2===0?violet:light);
  }
  // Three visible thresholds, a single continuous environment.
  for (const z of [5,-9,-24,-39]) {
    add(0,-.71,z,8.6,.035,.06,edge);
  }
  return result;
}

const vert = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uProjection;
uniform vec3 uCamera;
uniform vec3 uPosition;
uniform vec3 uSize;
uniform float uYaw;
uniform float uPitch;
varying float vLight;
void main() {
  vec3 world = aPosition * uSize + uPosition;
  vec3 r = world - uCamera;
  float c = cos(uYaw), s = sin(uYaw);
  r = vec3(r.x * c - r.z * s, r.y, r.x * s + r.z * c);
  c = cos(uPitch); s = sin(uPitch);
  r = vec3(r.x, r.y * c - r.z * s, r.y * s + r.z * c);
  vLight = 0.52 + 0.42 * max(dot(normalize(aNormal), normalize(vec3(-.6, .9, .7))), 0.0);
  gl_Position = uProjection * vec4(r, 1.0);
}
`;
const frag = `
precision mediump float;
uniform vec3 uColor;
varying float vLight;
void main() { gl_FragColor = vec4(uColor * vLight, 1.0); }
`;

function cubeData(): Float32Array {
  const faces: {normal: number[]; points: number[][]}[] = [
    {normal:[0,0,1],points:[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]},
    {normal:[0,0,-1],points:[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]},
    {normal:[1,0,0],points:[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]]},
    {normal:[-1,0,0],points:[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]},
    {normal:[0,1,0],points:[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]},
    {normal:[0,-1,0],points:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]},
  ];
  const out: number[]=[];
  for(const face of faces) for(const index of [0,1,2,0,2,3]) out.push(...face.points[index],...face.normal);
  return new Float32Array(out);
}

function perspective(aspect: number): Float32Array {
  const f=1/Math.tan(Math.PI/5.4), near=.15, far=110;
  return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,(2*far*near)/(near-far),0]);
}
function shader(gl: WebGLRenderingContext, type: number, code: string): WebGLShader {
  const obj=gl.createShader(type);
  if(!obj) throw new Error('Shader unavailable');
  gl.shaderSource(obj,code); gl.compileShader(obj);
  if(!gl.getShaderParameter(obj,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(obj) || 'Shader compilation failed');
  return obj;
}
function init(gl: WebGLRenderingContext) {
  const program=gl.createProgram();
  if(!program) throw new Error('WebGL program unavailable');
  const v=shader(gl,gl.VERTEX_SHADER,vert);
  const f=shader(gl,gl.FRAGMENT_SHADER,frag);
  gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);
  gl.deleteShader(v);gl.deleteShader(f);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error('Program linking failed');
  const buffer=gl.createBuffer();
  if(!buffer) throw new Error('WebGL buffer unavailable');
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,cubeData(),gl.STATIC_DRAW);
  gl.useProgram(program);
  const position=gl.getAttribLocation(program,'aPosition');
  const normal=gl.getAttribLocation(program,'aNormal');
  gl.enableVertexAttribArray(position);gl.enableVertexAttribArray(normal);
  gl.vertexAttribPointer(position,3,gl.FLOAT,false,24,0);
  gl.vertexAttribPointer(normal,3,gl.FLOAT,false,24,12);
  const uniforms={
    projection:gl.getUniformLocation(program,'uProjection'),
    camera:gl.getUniformLocation(program,'uCamera'),
    position:gl.getUniformLocation(program,'uPosition'),
    size:gl.getUniformLocation(program,'uSize'),
    yaw:gl.getUniformLocation(program,'uYaw'),
    pitch:gl.getUniformLocation(program,'uPitch'),
    color:gl.getUniformLocation(program,'uColor'),
  };
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  gl.clearColor(.082,.066,.12,1);
  return {program,buffer,uniforms};
}

export function PicoWorld({scroller}: {scroller:RefObject<HTMLDivElement|null>}) {
  const scene=useRef<HTMLElement>(null);
  const canvas=useRef<HTMLCanvasElement>(null);
  const [failed,setFailed]=useState(false);
  const [chapter,setChapter]=useState(0);
  useEffect(()=>{
    const area=scroller.current, section=scene.current, element=canvas.current;
    if(!area||!section||!element) return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const gl=element.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power'});
    if(!gl){setFailed(true);return;}
    let renderer:ReturnType<typeof init>;
    try{renderer=init(gl);}catch{setFailed(true);return;}
    const blocks=objects();
    let raf=0, pointer=0;
    const draw=()=>{
      raf=0;
      const bounds=section.getBoundingClientRect();
      const a=area.getBoundingClientRect();
      const range=Math.max(1,section.offsetHeight-area.clientHeight);
      const progress=Math.max(0,Math.min(1,(a.top-bounds.top)/range));
      const stage=progress<.325?0:progress<.66?1:2;
      setChapter(previous=>previous===stage?previous:stage);
      const width=element.clientWidth,height=element.clientHeight;
      if(!width||!height)return;
      const ratio=Math.min(window.devicePixelRatio||1,window.innerWidth<700?1.25:1.6);
      const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
      if(element.width!==w||element.height!==h){element.width=w;element.height=h;gl.viewport(0,0,w,h);}
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(renderer.program);
      const u=renderer.uniforms;
      gl.uniformMatrix4fv(u.projection,false,perspective(w/h));
      const cameraZ=12.8-progress*30.2;
      gl.uniform3f(u.camera,Math.sin(progress*5.2)*.82+pointer*.5,3.3,cameraZ);
      gl.uniform1f(u.yaw,Math.sin(progress*3.4)*.075+pointer*.04);
      gl.uniform1f(u.pitch,.115);
      for(const b of blocks){
        // Minimal mobile draw distance and depth clipping.
        if (b.z>cameraZ+2 || b.z<cameraZ-48)continue;
        gl.uniform3f(u.position,b.x,b.y,b.z);
        gl.uniform3f(u.size,b.sx,b.sy,b.sz);
        gl.uniform3f(u.color,...b.color);
        gl.drawArrays(gl.TRIANGLES,0,36);
      }
    };
    const queue=()=>{if(!raf)raf=requestAnimationFrame(draw);};
    const move=(e:PointerEvent)=>{
      if(reduced.matches||e.pointerType==='touch')return;
      const rect=element.getBoundingClientRect();
      pointer=Math.max(-1,Math.min(1,(e.clientX-rect.left)/Math.max(1,rect.width)*2-1));
      queue();
    };
    const resize=new ResizeObserver(queue);
    resize.observe(element);
    area.addEventListener('scroll',queue,{passive:true});
    element.addEventListener('pointermove',move,{passive:true});
    window.addEventListener('resize',queue,{passive:true});
    reduced.addEventListener('change',queue);
    queue();
    return ()=>{
      if(raf)cancelAnimationFrame(raf);
      resize.disconnect();
      area.removeEventListener('scroll',queue);
      element.removeEventListener('pointermove',move);
      window.removeEventListener('resize',queue);
      reduced.removeEventListener('change',queue);
      gl.deleteBuffer(renderer.buffer);gl.deleteProgram(renderer.program);
    };
  },[scroller]);
  const scenes=[
    {title:'Write code.',detail:'Pseudocode and Python compilers, with execution and debugging.'},
    {title:'Build logic.',detail:'Flowcharts and circuits you design and test.'},
    {title:'Understand the machine.',detail:'CPU execution, registers and binary representation.'},
  ];
  return <section className="pico-world" ref={scene} id="explore" aria-label="Scroll through Pico's computer science tools">
    <div className="pico-world-sticky">
      <canvas ref={canvas} className="pico-world-canvas" aria-hidden="true"/>
      {failed&&<div className="pico-world-fallback" aria-hidden="true"><span>CODE</span><span>LOGIC</span><span>CPU</span></div>}
      <div className="pico-world-overlay">
        <div className="pico-world-top"><span>Pico / Computer Science</span><span>0{chapter+1} / 03</span></div>
        <div className="pico-world-story" aria-live="off">
          {scenes.map((s,i)=><div className={`pico-world-chapter${chapter===i?' active':''}`} key={s.title} aria-hidden={chapter!==i}>
            <h2>{s.title}</h2><p>{s.detail}</p>
          </div>)}
        </div>
        <div className="pico-world-bottom"><span><ArrowDown size={16}/> Scroll to move through Pico</span><a href="/app/">Use Pico in Browser <ArrowUpRight size={18}/></a></div>
      </div>
    </div>
  </section>;
}
