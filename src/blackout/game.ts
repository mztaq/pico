// @ts-nocheck
// Bundled by Vite as an application module. Network operations exist only in memory.
import * as THREE from 'three';
import { createTrafficFeed } from './traffic-model';
import { drawTerminalScreen, terminalHitTest } from './terminal-screen';
import { isSightBlocked, chooseHackerPhase, hackerAreaIsClear } from './stealth-logic';
import { routeTo } from './navigation';
import { moveGuardWithAvoidance } from './guard-movement';
import {EVIDENCE_STATIONS,selectGuardEvidence,collectGuardEvidence} from './evidence-coordination';
import { renderOfficeFeed } from './office-monitor';
import { rankedCoverSpots, formationPosition } from './ai-coordination';
import {estimatedBitsPerSecond, formatBandwidth,DEFAULT_BYTES_PER_REQUEST} from './traffic-bandwidth';
import {ATTACK_TRAFFIC_SCALE,DEFENSE_WAVE_SCALE,poweredProxyCount,firstUnpoweredProxy,nearestPoweredProxy} from './proxy-mechanics';
import {
  flagSecurityIncident, observeSecurityAlarm, shouldDispatchSecurity,
  acknowledgeSecurityDispatch, securityOfficersReturned,
} from './security-response';

/* Everything in the incident model stays inside browser memory. */
const $ = id => document.getElementById(id);

// --------------------------------------------------------------------------
// 3D scene, physical lighting, materials and reusable geometry.
// --------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color('#25313f');
scene.fog = new THREE.FogExp2('#25313f', .010);
const camera = new THREE.PerspectiveCamera(84, 1, .07, 120);
const gpuMemory=Number(navigator.deviceMemory)||4;
const gpuCores=Number(navigator.hardwareConcurrency)||4;
const autoLow=gpuMemory<=4||gpuCores<=4||Math.min(innerWidth,innerHeight)<680;
let preferredQuality='auto';
try {preferredQuality=localStorage.getItem('pico.blackout.graphics')||'auto';}catch { /* Storage is disabled on some classroom browsers. */ }
if(!['auto','low','high'].includes(preferredQuality))preferredQuality='auto';
let lowQuality=preferredQuality==='low'||(preferredQuality==='auto'&&autoLow);
const renderer = new THREE.WebGLRenderer({ antialias: !lowQuality, powerPreference: 'low-power', alpha: false });
const qualitySelect=$('quality');
qualitySelect.value=preferredQuality;
function updateQuality(setting) {
  const mode=['auto','low','high'].includes(setting)?setting:'auto';
  preferredQuality=mode;qualitySelect.value=mode;
  lowQuality=mode==='low'||(mode==='auto'&&autoLow);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lowQuality?.72:1.5));
  renderer.shadowMap.enabled=!lowQuality;
  renderer.shadowMap.autoUpdate=!lowQuality;
  renderer.toneMappingExposure=lowQuality?1.95:1.72;
  renderer.setSize(innerWidth,innerHeight);
  bpApplyQuality();
  try {localStorage.setItem('pico.blackout.graphics',mode);}catch{}
  if(game)notify('GRAPHICS / '+mode.toUpperCase()+(lowQuality?' / PERFORMANCE':' / DETAIL'));
}
qualitySelect.addEventListener('pointerdown',event=>event.stopPropagation());
qualitySelect.addEventListener('click',event=>event.stopPropagation());
qualitySelect.addEventListener('change',event=>{event.stopPropagation();updateQuality(event.target.value);});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lowQuality?.72:1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.85;
renderer.shadowMap.enabled = !lowQuality;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(innerWidth, innerHeight);
renderer.domElement.setAttribute('aria-label','Interactive three-dimensional data center. Drag to orbit or use camera buttons.');
renderer.domElement.style.touchAction = 'none';
$('viewport').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xe1e7ff, 0x1e2335, 2.25));
const ambient = new THREE.AmbientLight(0x9aabcc, 1.1); scene.add(ambient);
const keyLight = new THREE.DirectionalLight(0xc8deef, 3.1);
keyLight.position.set(5, 12, 10); keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048,2048);
keyLight.shadow.camera.left = -32; keyLight.shadow.camera.right = 36;
keyLight.shadow.camera.top = 23; keyLight.shadow.camera.bottom = -23;
keyLight.shadow.bias = -.00035;
scene.add(keyLight);

const matCache = new Map();
function mat(hex, opts = {}) {
  const key = String(hex) + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({
    color: hex, metalness: opts.metal ?? .48, roughness: opts.rough ?? .53,
    transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
    emissive: opts.glow ? new THREE.Color(hex) : new THREE.Color('#000000'),
    emissiveIntensity: opts.glow ?? 0,
    side: opts.double ? THREE.DoubleSide : THREE.FrontSide,
  }));
  return matCache.get(key);
}
const metal = mat('#28323e',{metal:.87,rough:.39});
const edgeMetal = mat('#50616b',{metal:.91,rough:.29});
const darkMetal = mat('#111b26',{metal:.77,rough:.35});
const panel = mat('#152431',{metal:.66,rough:.36});
const black = mat('#0b1018',{metal:.29,rough:.91});
const mint = mat('#65e8d1',{metal:.24,rough:.3,glow:2.7});
const red = mat('#ff594e',{metal:.21,rough:.3,glow:2.8});
const orange = mat('#ffad64',{metal:.22,rough:.3,glow:2.2});
const blue = mat('#6ea7fc',{metal:.21,rough:.3,glow:2.5});
const ice = mat('#e0f3fa',{metal:.3,rough:.33,glow:.55});
const floor = mat('#1c2832',{metal:.65,rough:.25});
const concrete = mat('#25313d',{metal:.12,rough:.9});
const white = mat('#afc3c9',{metal:.28,rough:.51});
const screen = mat('#132c32',{metal:.18,rough:.24,glow:.5});
const geoBox = new THREE.BoxGeometry(1,1,1);
const geoSphere = new THREE.SphereGeometry(1,12,9);
const geoCyl = new THREE.CylinderGeometry(1,1,1,12);
const world = new THREE.Group(); scene.add(world);
const jail = new THREE.Group(); jail.visible = false; scene.add(jail);
const dynamic = new THREE.Group(); scene.add(dynamic);
const serverLeds = [], warningLights = [], proxyObjects = [], hackerEyes = [];
const V = (x,y,z)=>new THREE.Vector3(x,y,z);
function mesh(g, m, p, parent=world, shadow=true) {
  const o = new THREE.Mesh(g,m); o.position.set(p[0],p[1],p[2]);
  o.castShadow=shadow; o.receiveShadow=true; parent.add(o); return o;
}
function box(x,y,z,w,h,d,m,parent=world) {let o=mesh(geoBox,m,[x,y,z],parent); o.scale.set(w,h,d); return o;}
function ball(x,y,z,r,m,parent=world) {let o=mesh(geoSphere,m,[x,y,z],parent);o.scale.setScalar(r);return o;}
function cyl(x,y,z,r,h,m,parent=world) {let o=mesh(geoCyl,m,[x,y,z],parent);o.scale.set(r,h,r);return o;}
function line(a,b,r,m,parent=world){let start=V(...a),end=V(...b),v=end.clone().sub(start),o=mesh(geoCyl,m,start.clone().add(end).multiplyScalar(.5).toArray(),parent);o.scale.set(r,v.length(),r);o.quaternion.setFromUnitVectors(V(0,1,0),v.normalize());return o;}
function torus(x,y,z,major,tube,m,parent=world){return mesh(new THREE.TorusGeometry(major,tube,7,40),m,[x,y,z],parent,false);}
function light(x,y,z,hex,intensity,range,parent=scene) {const l=new THREE.PointLight(hex,intensity,range,2);l.position.set(x,y,z);parent.add(l);return l;}
function sign(text, w=512, h=128, fg='#bcefe2', bg='#071b26') {
  const c=document.createElement('canvas'); c.width=w;c.height=h;
  const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#1a4850';ctx.lineWidth=5;ctx.strokeRect(5,5,w-10,h-10);
  ctx.font='bold '+Math.round(h*.26)+'px monospace';ctx.fillStyle=fg;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,w/2,h/2,w-35);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function label(text,x,y,z,w,h,rotationY=0,fg='#bcefe2',parent=world){
  const plane=mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({map:sign(text),side:THREE.DoubleSide,transparent:false}),[x,y,z],parent,false);plane.rotation.y=rotationY;return plane;
}
const bpFixtureLights=[];
function fixture(x,z) {
  box(x,6.16,z,2.8,.12,.5,edgeMetal);
  box(x,6.06,z,2.42,.05,.28,ice);
  bpFixtureLights.push(light(x,5.78,z,0xb6eeff,3,10));
}
// Real-scale server room: raised floor, walls, cable conduits, cooling lanes.
box(-14.5,-.19,0,60,.35,29,concrete);
box(-14.5,3.15,13.78,60,6.5,.35,mat('#202c37',{metal:.22,rough:.82}));
box(23,-.19,0,17,.35,24,concrete);
for(let x=-43;x<=31;x+=(lowQuality?4.2:2)) for(let z=-13;z<=13;z+=(lowQuality?3.5:2)){
  box(x,.015,z,lowQuality?3.88:1.96,.025,lowQuality?3.47:1.96,floor);
  // Tiny metallic seams make the floor read as modular raised flooring.
  if(!lowQuality&&Math.abs(x)<13) box(x+.97,.032,z,.018,.01,1.92,darkMetal);
}
box(-14.5,3.15,-14.35,60,6.5,.42,mat('#1d2b36',{metal:.3,rough:.81}));
box(-44.7,3.15,0,.45,6.5,29,mat('#202e3a',{metal:.28,rough:.88}));
const bpOfficeWall=mat('#223644',{metal:.34,rough:.35});
box(14.7,3.15,-7.85,.40,6.5,12.8,bpOfficeWall);
box(14.7,3.15,8.1,.40,6.5,12.5,bpOfficeWall);
box(31.5,3.15,0,.42,6.5,24,bpOfficeWall);
box(23.05,3.15,-11.9,17,.42,.34,bpOfficeWall);
box(23.05,3.15,11.9,17,.42,.34,bpOfficeWall);
box(23,6.35,0,17,.3,24,mat('#25313e',{metal:.45,rough:.8}));
box(14.7,6.15,.2,.45,.47,3.25,edgeMetal);
box(14.78,.15,.2,.63,.28,3.1,metal);
box(15.55,3.05,-1.52,1.25,5.9,.18,mat('#345668',{metal:.55,rough:.18}));
label('SECURITY ACCESS',15.69,4.7,-1.5,.92,.25,Math.PI/2);
for(let z of [-8,0,8]){
  box(22.8,6.02,z,2.6,.15,.66,edgeMetal);
  box(22.8,5.94,z,2.3,.035,.46,ice);
}
const officeTint=mat('#2d3b48',{metal:.21,rough:.74});
for(let [x,z] of [[20.5,-7],[26.8,-7],[20.5,6],[27.1,6]]){
  box(x,1.05,z,2.5,.14,1.25,officeTint);
  for(const px of [-1,1])box(x+px,0.52,z,.09,1,.12,edgeMetal);
  box(x,1.72,z-.39,1.48,.9,.085,darkMetal);
  box(x,1.72,z-.33,1.32,.72,.022,mat('#193447',{metal:.15,rough:.34,glow:.5}));
  box(x,1.16,z+.25,1.2,.038,.4,black);
}
box(24,3.42,11.7,6.1,2.1,.13,darkMetal);
label('SECURITY CONTROL ROOM',24,3.65,11.78,5.5,.7);
for(let x of [20,22,24,26,28])box(x,2.62,11.76,.5,.10,.025,mint);

box(-14.5,6.45,-13.5,60,.4,1.0,edgeMetal);
for(let x=-43;x<=30;x+=4){box(x,6.25,0,.16,.15,29,darkMetal); for(let z=-10;z<=10;z+=6)box(x,6.1,z,.22,.13,2.5,metal);}
for(let x of (lowQuality?[-40,-26,-9,9,24]:[-41,-33,-25,-19,-9,0,9,21,28]))for(let z of (lowQuality?[-8,8]:[-9,0,9]))fixture(x,z);
for(let x of [-39,-26,-12.2,12.2])for(let z of [-10,0,10]){
  cyl(x,4.3,z,.11,8.4,edgeMetal);
  light(x,4.5,z,0x6da4e0,1.2,7);
}
// Overhead cooling pipeline and duct fans.
for(let x of [-39,-30,-4,4]){
  line([x,5.4,-13],[x,5.4,12],.19,edgeMetal);
  for(let z of [-11,-5,1,7]){
    cyl(x,5.65,z,.45,.12,metal);
    torus(x,5.68,z,.31,.045,darkMetal).rotation.x=Math.PI/2;
  }
}
// Wall displays with legitimate demo-only IP blocks.
box(0,3.3,-14.02,9.3,3.3,.11,darkMetal);
label('CORE WEB CLUSTER  /  203.0.113.24',0,4.06,-13.94,8.65,.92);
label('NETWORK OPERATIONS CENTRE',0,2.83,-13.94,6.5,.62);
for(let x of [-11,11]){
  box(x,3,-14.03,4.4,2.55,.12,darkMetal);
  label(x<0?'SECURITY FEED':'EDGE CLUSTER',x,3.2,-13.93,3.75,.68);
  for(let j=0;j<9;j++)box(x-1.75+j*.43,2.38,-13.91,.24,.075,.04,j%4===0?mint:mat('#406e77',{glow:.8}));
}

const bpRackDecor=[];
function rack(x,z,index){
  const g=new THREE.Group();g.position.set(x,0,z);world.add(g);
  box(0,2.2,0,1.82,4.42,2.04,darkMetal,g);
  box(0,4.4,0,1.9,.17,2.15,edgeMetal,g);
  box(0,.12,0,1.9,.21,2.16,edgeMetal,g);
  for(let dx of [-.84,.84]){
    box(dx,2.25,1.025,.095,4.23,.11,edgeMetal,g);
    box(dx,2.25,-1.025,.095,4.23,.11,edgeMetal,g);
  }
  for(let j=0;j<11;j++){
    if(lowQuality&&j%2===1)continue;
    const y=.42+j*.336;
    bpRackDecor.push(box(0,y,1.036,1.57,.275,.09,metal,g));
    bpRackDecor.push(box(-.22,y,1.101,.88,.022,.011,black,g));
    if(!lowQuality)for(let k=0;k<4;k++)box(-.59+k*.13,y+.069,1.11,.075,.035,.014,darkMetal,g);
    const led=box(.63,y,1.107,.065,.055,.017,j%4===0?orange:mint,g);serverLeds.push(led);
    bpRackDecor.push(box(0,y,-1.05,1.5,.26,.04,panel,g));
  }
  box(0,3.97,1.109,1.3,.11,.02,mat('#344855',{glow:.35}),g);
  label('SRV-' + String(index).padStart(2,'0'),x,4.08,z+1.13,1.2,.25);
  // Powered fan exhaust on the sides.
  for(let j=0;j<4;j++)torus(x-.915,1.15+j*.78,z,.21,.028,edgeMetal).rotation.y=Math.PI/2;
  return g;
}
const rackCoords=[
  [2.3,-8],[5.9,-8],[2.3,-3],[5.9,-3],[2.3,2],[5.9,2],[2.3,7],[5.9,7],
  [-18,-8],[-18,-3],[-18,3],[-18,8],
  [-30,-8],[-30,-3],[-30,3],[-30,8],[-37,-8],[-37,-3],[-37,3],[-37,8],
];
rackCoords.forEach(([x,z],i)=>rack(x,z,i+1));

// Additional west-hall structure, access markings and cold-aisle containment.
const bpAnnexTrim=mat('#475769',{metal:.75,rough:.42});
for(const x of [-40,-34,-28,-22]){
  box(x,.075,11.2,1.6,.02,.10,bpAnnexTrim);
  box(x,.075,-11.2,1.6,.02,.10,bpAnnexTrim);
  box(x,5.78,-12.65,.14,.16,2.1,edgeMetal);
}
for(const z of [-11.4,-5.7,0,5.7,11.4]){
  box(-26.1,.055,z,.085,.018,1.9,mat('#5f8590',{metal:.45,rough:.75}));
  box(-41.4,.055,z,.085,.018,1.9,mat('#5f8590',{metal:.45,rough:.75}));
}
label('WEST SERVER HALL / COLD AISLE',-35.4,4.15,-14.04,11,.66);
label('ZONE W',-42.8,3.75,-14.02,2.4,.55);
for(const z of [-8,0,8]){
  box(-43.6,5.6,z,.25,.75,1.55,metal);
  box(-43.35,5.55,z,.10,.58,1.26,darkMetal);
}


/* Batched equipment details: hundreds of perforated vent marks in one draw. */
const bpRackDetail=new THREE.Group();world.add(bpRackDetail);
const bpVentMaterial=mat('#718899',{metal:.72,rough:.31});
const bpVents=new THREE.InstancedMesh(geoBox,bpVentMaterial,rackCoords.length*30);
bpVents.castShadow=false;bpVents.receiveShadow=false;
const bpVentDummy=new THREE.Object3D();
let bpVentIndex=0;
for(const [rx,rz] of rackCoords){
  for(let section=0;section<10;section++)for(let slot=0;slot<3;slot++){
    bpVentDummy.position.set(rx-.45+slot*.45,.46+section*.342,rz+1.145);
    bpVentDummy.scale.set(.30,.015,.023);
    bpVentDummy.updateMatrix();bpVents.setMatrixAt(bpVentIndex++,bpVentDummy.matrix);
  }
}
bpVents.instanceMatrix.needsUpdate=true;
bpVents.count=bpVentIndex;bpRackDetail.add(bpVents);
const bpTray=mat('#475b69',{metal:.83,rough:.35});
for(const x of [-18,-9,2.3,5.9,11.6]){
  box(x,5.88,0,.24,.13,25.5,bpTray,bpRackDetail);
  for(const z of [-10,-5,0,5,10]){
    box(x,5.88,z,1.1,.12,.13,edgeMetal,bpRackDetail);
  }
}
for(const z of [-10.55,-5.6,-.55,4.5,9.5]){
  box(-6.2,.06,z,29,.035,.11,mat('#54616c',{metal:.77,rough:.34}),bpRackDetail);
  for(const x of [-20.5,-12,-2,8]){
    box(x,.075,z,.16,.06,.15,bpVentMaterial,bpRackDetail);
  }
}
// Ventilation louvres on the west wall.
for(const z of [-10.2,-6.4,-2.6,1.2,5.0,8.8]){
  box(-44.42,3.75,z,.11,1.65,1.9,edgeMetal,bpRackDetail);
  for(let j=0;j<8;j++)box(-44.33,3.1+j*.185,z,.07,.055,1.60,black,bpRackDetail);
}

for(let x of [1.1,7.1]){
  for(let z of [-10.5,-5.5,-.5,4.5,9.5])box(x,.07,z,.06,.08,2.2,mat('#4b6773',{glow:.45}));
}
// Intruder workstation and the recognizable hooded operator.
function character(x,z,type='attacker',parent=world) {
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
  const coat=type==='attacker'?mat('#15181d',{metal:.05,rough:1}):type==='guard'?mat('#23374d',{metal:.05,rough:.98}):mat('#636b75',{metal:.04,rough:.98});
  const hem=type==='attacker'?mat('#07090e',{metal:0,rough:1}):mat('#101a29',{metal:0,rough:1});
  const face=type==='attacker'?mat('#090d11',{metal:0,rough:.98}):mat('#9a806d',{metal:0,rough:.9});
  box(-.16,.38,.04,.29,.76,.38,hem,g);box(.16,.38,.04,.29,.76,.38,hem,g);
  box(-.16,.1,.21,.37,.22,.66,hem,g);box(.16,.1,.21,.37,.22,.66,hem,g);
  const torso=mesh(new THREE.CylinderGeometry(.38,.57,1.35,12),coat,[0,1.38,0],g);torso.rotation.x=.07;
  const arm1=line([-.41,1.85,0],[-.6,1.12,.50],.18,coat,g);
  const arm2=line([.41,1.85,0],[.62,1.12,.50],.18,coat,g);
  ball(-.6,1.10,.54,.14,face,g);ball(.62,1.10,.54,.14,face,g);
  const hood=mesh(new THREE.SphereGeometry(.52,15,11),coat,[0,2.37,.03],g);
  hood.scale.set(1.06,1.12,.9);
  ball(0,2.36,.39,.365,face,g);
  if(type==='attacker'){
    const upper=mesh(new THREE.ConeGeometry(.54,.72,12),coat,[0,2.84,-.05],g); upper.rotation.x=-.09;
    const leftEye=box(-.14,2.42,.715,.075,.023,.04,red,g),rightEye=box(.14,2.42,.715,.075,.023,.04,red,g);
    hackerEyes.push(leftEye,rightEye);
  } else {
    box(0,1.52,.51,.52,.28,.08,type==='guard'?mat('#7b91a4',{metal:.13,rough:.75}):white,g);
  }
  return g;
}
const attacker=character(-8.8,4.5);
const security=character(10.9,-3,'guard');security.rotation.y=-1.3;
const technician=character(26,1.8,'engineer');technician.rotation.y=Math.PI;
// The intruder has a portable laptop connected to a server, not a full workstation.
const bpPortableRack=box(-10.55,2.20,2.2,1.65,4.35,1.88,darkMetal);
for(let y=.6;y<4.2;y+=.35){
  box(-10.55,y,3.14,1.45,.24,.055,metal);
  for(let x of [-11.05,-10.70,-10.35])box(x,y,3.183,.085,.028,.023,y<1.5?mint:blue);
}
box(-10.53,1.58,3.23,.74,.18,.09,mat('#182b37',{metal:.75,rough:.25}));
const bpNetworkPort=ball(-10.28,1.57,3.29,.075,mint);
// The portable laptop is built as one movable group below. The rack stays put.
const bpCableGeometry=new THREE.CatmullRomCurve3([
  V(-9.38,1.32,3.1),V(-9.75,1.03,3.6),V(-10.9,1.03,3.65),V(-10.85,1.48,3.34),V(-10.28,1.57,3.29)
]);
const bpCable=mesh(new THREE.TubeGeometry(bpCableGeometry,24,.028,5,false),
  mat('#d8a968',{metal:.09,rough:.76}),[0,0,0],world,false);
const bpCableLight=ball(-10.30,1.57,3.35,.065,mint);
light(-8.55,2.51,3.1,0x90c6e9,2.1,4);
// Portable laptop is wired to the rack; the hooded character leaves it to flee.
// Security operations workstation, inside the office with the guard team.
const bpOfficeConsoleX=23.15, bpOfficeConsoleZ=-8.15;
box(bpOfficeConsoleX,1.03,bpOfficeConsoleZ,2.65,.13,1.08,edgeMetal);
for(const xx of [bpOfficeConsoleX-1.14,bpOfficeConsoleX+1.14])
  box(xx,.54,bpOfficeConsoleZ,.10,.96,.12,edgeMetal);
box(bpOfficeConsoleX,1.75,bpOfficeConsoleZ-.46,2.0,1.24,.11,darkMetal);
box(bpOfficeConsoleX,1.11,bpOfficeConsoleZ+.30,1.60,.035,.34,black);
box(bpOfficeConsoleX,1.1,bpOfficeConsoleZ-.18,.24,.12,.24,edgeMetal);
light(bpOfficeConsoleX,2.38,bpOfficeConsoleZ,0x539fed,1.8,5);
// Defense proxy pylons appear as network layers under load.
function createProxy(index){
  const g=new THREE.Group();
  // Powered-down edge appliances await a physical switch from a responding guard.
  g.position.set(9.35+(index%2)*2.15,0,-9.45+Math.floor(index/2)*1.55);dynamic.add(g);
  const p=mat('#2a4647',{metal:.76,rough:.3});
  box(0,.17,0,.8,.28,.8,edgeMetal,g);
  box(0,1.15,0,.55,1.78,.55,p,g);
  const statusIndicators=[];
  for(let y of [.48,.86,1.24,1.62]){
    box(0,y,.3,.43,.14,.024,screen,g);
    statusIndicators.push(box(.16,y,.322,.04,.036,.02,mat('#303c48',{metal:.3,rough:.68}),g));
  }
  const ring=torus(0,2.25,0,.54,.06,mint,g);ring.rotation.x=Math.PI/2;
  const cap=ball(0,2.3,0,.22,mint,g);
  const glow=light(0,2.4,0,0x54e8c6,0,3,g);
  const switchBox=box(.32,1.12,.33,.09,.2,.12,edgeMetal,g);
  const switchLever=box(.32,1.15,.41,.045,.11,.045,mat('#efc58c',{metal:.45,rough:.4}),g);
  ring.material=mat('#323c4a',{metal:.51,rough:.48});
  cap.material=mat('#263b43',{metal:.31,rough:.42});
  g.userData={ring,cap,glow,statusIndicators,switchLever,powered:false};
  proxyObjects.push(g);return g;
}
for(let i=0;i<6;i++){let g=createProxy(i);g.visible=true;}
function bpPowerProxy(index){
  const proxy=proxyObjects[index];
  if(!proxy||proxy.userData.powered)return false;
  proxy.userData.powered=true;
  proxy.userData.ring.material=mint;
  proxy.userData.cap.material=mint;
  proxy.userData.glow.intensity=2.1;
  proxy.userData.switchLever.rotation.x=-.5;
  for(const light of proxy.userData.statusIndicators)light.material=mint;
  sfx.deploy();
  proxy.userData.glow.color.setHex(0x54e8c6);
  proxy.userData.repairAt=0;
  if(game)game.proxies=poweredProxyCount(proxyObjects);
  bpShowIncident('EDGE APPLIANCE '+String(index+1).padStart(2,'0')+' / POWER ON');
  return true;
}
function bpDisableProxy(index,who='intruder'){
  if(!game||game.ended)return false;
  const proxy=proxyObjects[index];
  if(!proxy||!proxy.userData.powered)return false;
  proxy.userData.powered=false;
  proxy.userData.repairAt=game.elapsed+14;
  proxy.userData.ring.material=mat('#703846',{metal:.35,rough:.55});
  proxy.userData.cap.material=mat('#493744',{metal:.28,rough:.54});
  proxy.userData.glow.color.setHex(0xff5467);
  proxy.userData.glow.intensity=.7;
  proxy.userData.switchLever.rotation.x=.58;
  for(const led of proxy.userData.statusIndicators)led.material=red;
  game.proxies=poweredProxyCount(proxyObjects);
  game.proxyOrders=Math.min(6-game.proxies,Math.max(1,game.proxyOrders||0));
  flagSecurityIncident(game);
  game.nextDefenderProxy=Math.min(game.nextDefenderProxy||game.elapsed+12,game.elapsed+12);
  sfx.metal();bpShowIncident('EDGE PROXY '+String(index+1).padStart(2,'0')+' / POWER LOST');
  log('Proxy '+(index+1)+' shut down by '+who+'.','warn');
  return true;
}
function bpResetProxies(){
  for(const proxy of proxyObjects){
    proxy.visible=true;proxy.userData.powered=false;proxy.userData.repairAt=0;
    proxy.userData.glow.color.setHex(0x54e8c6);
    proxy.userData.ring.material=mat('#323c4a',{metal:.51,rough:.48});
    proxy.userData.cap.material=mat('#263b43',{metal:.31,rough:.42});
    proxy.userData.glow.intensity=0;proxy.userData.switchLever.rotation.x=0;
    for(const led of proxy.userData.statusIndicators)led.material=mat('#303c48',{metal:.3,rough:.68});
  }
}

// Flowing request packets. No requests are emitted by this code.
const requestCurve=new THREE.CatmullRomCurve3([V(-8.5,2.5,2.1),V(-5.8,4.1,-.3),V(-1.3,3.2,-3),V(2,3.8,-3),V(4.3,3.1,-3)]);
const outgoingCurve=new THREE.CatmullRomCurve3([V(4.2,3.3,-3),V(7.2,4.8,-1),V(9.5,2.8,-4)]);
const reqTube=mesh(new THREE.TubeGeometry(requestCurve,72,.015,4,false),mat('#58aebe',{glow:1.7,transparent:true,opacity:.48}),[0,0,0],dynamic,false);
reqTube.visible=false;
const particleGeo=new THREE.OctahedronGeometry(.072,0);
const packets=[];
for(let i=0;i<100;i++){
  const p=new THREE.Mesh(particleGeo,i%6===0?mint:i%8===0?orange:red);
  p.castShadow=false;p.visible=false;dynamic.add(p);packets.push(p);
}
const blocked=[];
for(let i=0;i<24;i++){
  const p=new THREE.Mesh(particleGeo,blue);p.castShadow=false;p.visible=false;dynamic.add(p);blocked.push(p);
}

// Arrest ending: separate cinematic set, shown only when the defender traces the suspect.
box(0,-.13,0,18,.26,15,mat('#454b50',{metal:.1,rough:.95}),jail);
box(0,4,-5.5,18,8,.5,concrete,jail);
box(-8.8,4,0,.5,8,11,concrete,jail);box(8.8,4,0,.5,8,11,concrete,jail);
box(0,6.5,0,17,.25,11,mat('#343e46',{metal:.2,rough:.75}),jail);
box(0,0,4.5,15,.15,.5,darkMetal,jail);
for(let x=-6.6;x<=6.6;x+=.95){
  cyl(x,3,2.5,.095,6,edgeMetal,jail);
  ball(x,6,2.5,.13,edgeMetal,jail);
}
box(0,5.75,2.5,14,.18,.3,darkMetal,jail);
box(0,1.05,2.5,14,.19,.3,darkMetal,jail);
box(0,3.7,-5.14,9,1.3,.12,darkMetal,jail);
label('DETENTION  /  CASE  #0809',0,3.7,-5.02,7,.8,0,'#cfeae9',jail);
const jailed=character(0,-1,'attacker',jail);jailed.rotation.y=.17;
box(-5.5,.65,-3.8,3,1.2,1.3,metal,jail);
box(6.5,2,-4.5,.2,3.4,.2,red,jail);
const jailSpot=new THREE.SpotLight(0xece8d6,18,26,Math.PI/5,.4,1);jailSpot.position.set(0,7.2,4);jailSpot.target.position.set(0,1,-1);jailSpot.castShadow=!lowQuality;jail.add(jailSpot,jailSpot.target);
const sirenRed=light(-5,5,0,0xff3849,3,12,jail),sirenBlue=light(5,5,0,0x357cec,3,12,jail);

/* Defense finale: a separate, low-poly court hearing before the jail cinematic. */
const courtroom=new THREE.Group();courtroom.visible=false;scene.add(courtroom);
const courtWood=mat('#584638',{metal:.08,rough:.72});
const courtDark=mat('#2b2b38',{metal:.12,rough:.85});
const courtCarpet=mat('#333b52',{metal:.04,rough:.95});
const robe=mat('#161722',{metal:0,rough:.98});
box(0,-.16,0,18,.27,15,courtCarpet,courtroom);
box(0,3.4,-6.35,18,7,.42,concrete,courtroom);
box(-8.8,3.4,0,.34,7,13,concrete,courtroom);
box(8.8,3.4,0,.34,7,13,concrete,courtroom);
box(0,6.7,0,17,.26,14,mat('#2d303d',{metal:.14,rough:.82}),courtroom);
for(let i=-1;i<=1;i++){
  box(i*4.6,.9,3.4,3.7,.31,1.05,courtWood,courtroom);
  box(i*4.6,1.38,4.02,3.7,.76,.17,courtWood,courtroom);
  box(i*4.6,.27,3.65,3.3,.43,.12,courtDark,courtroom);
}
box(0,.62,-4.9,6.9,1.16,2.5,courtWood,courtroom);
box(0,1.25,-4.0,5.6,.22,1.3,courtWood,courtroom);
box(0,2.02,-4.42,3.5,1.35,.3,courtDark,courtroom);
label('COURT OF DIGITAL INCIDENTS',0,4.84,-6.09,9.4,.92,0,'#e7d9b9',courtroom);
label('HEARING IN SESSION',0,1.92,-4.238,3.0,.35,0,'#f4e7cb',courtroom);
const bpJudge=character(0,-4.83,'judge',courtroom);
bpJudge.rotation.y=0;
box(0,1.41,-.36,.8,1.22,.37,robe,bpJudge);
box(0,1.82,.37,.67,.21,.07,mat('#e8e0d0',{metal:0,rough:.9}),bpJudge);
box(0,2.96,.05,.75,.15,.8,robe,bpJudge);
const bpGavel=box(.75,1.43,-3.61,.42,.13,.14,courtWood,courtroom);
box(.76,1.28,-3.63,.11,.44,.10,courtWood,courtroom);
const bpAccused=character(-1.75,0.45,'attacker',courtroom);
bpAccused.rotation.y=Math.PI;
const bpCourtGuardLeft=character(-3.5,.4,'guard',courtroom);
const bpCourtGuardRight=character(.1,.4,'guard',courtroom);
bpCourtGuardLeft.rotation.y=0;bpCourtGuardRight.rotation.y=0;
const bpCourtClerk=character(4,-3.5,'engineer',courtroom);
bpCourtClerk.rotation.y=-.15;
box(4.0,1.08,-3.4,2.35,.15,1.2,courtWood,courtroom);
for(const x of [-6,6])light(x,5.8,-2.0,0xffe6c5,2.1,11,courtroom);
light(0,6.0,-3.2,0xffffff,3.6,12,courtroom);

/* Court staging uses pooled box geometry. Optional dressing can be hidden
   at runtime on slower classroom machines without hiding the core scene. */
const bpCourtDetail=new THREE.Group();courtroom.add(bpCourtDetail);
const bpCourtBrass=mat('#c3a974',{metal:.68,rough:.36});
const bpCourtVelvet=mat('#3b3146',{metal:.02,rough:.95});
const bpCourtPaper=mat('#e5ddc7',{metal:0,rough:1});
for(const z of [2.0,5.15]){
  for(const x of [-5.8,-1.9,1.9,5.8]){
    box(x,.72,z,2.75,.22,.88,courtWood,bpCourtDetail);
    box(x,1.14,z+.44,2.75,.81,.19,courtWood,bpCourtDetail);
    box(x,.85,z,2.51,.065,.70,bpCourtVelvet,bpCourtDetail);
    for(const dx of [-1.16,1.16]){
      box(x+dx,.39,z,.10,.6,.11,courtDark,bpCourtDetail);
    }
  }
}
// Separate advocate tables, witness platform and jury area.
for(const x of [-3.5,3.5]){
  box(x,.75,-.50,2.8,.19,1.4,courtWood,bpCourtDetail);
  for(const dx of [-1.1,1.1])box(x+dx,.37,-.50,.13,.69,.16,courtDark,bpCourtDetail);
  for(const dx of [-.60,.15]){
    box(x+dx,.868,-.62,.53,.018,.72,bpCourtPaper,bpCourtDetail);
    box(x+dx,.887,-.68,.36,.012,.025,mat('#8f8c88',{metal:.08,rough:.7}),bpCourtDetail);
  }
}
box(-6.1,.76,-2.85,2.25,1.37,1.55,courtWood,bpCourtDetail);
box(-6.1,1.52,-2.34,2.2,.16,.48,bpCourtBrass,bpCourtDetail);
for(const x of [4.7,6.5]){
  box(x,.52,-3.0,1.35,.18,1.1,courtWood,bpCourtDetail);
  box(x,.92,-3.57,1.35,.84,.13,courtWood,bpCourtDetail);
}
for(const x of [-7.55,7.55]){
  box(x,1.62,-.8,.19,3.25,.24,courtWood,bpCourtDetail);
}
box(0,1.07,1.12,15,.15,.17,courtWood,bpCourtDetail);
for(let x=-7;x<=7;x+=1.4)box(x,.6,1.12,.115,.95,.115,bpCourtBrass,bpCourtDetail);
box(0,1.45,1.12,15,.10,.22,bpCourtBrass,bpCourtDetail);
// A simple scales-of-justice relief, not an extra interface label.
torus(0,4.58,-6.105,.62,.055,bpCourtBrass,bpCourtDetail);
line([0,4.9,-6.03],[0,4.15,-6.03],.04,bpCourtBrass,bpCourtDetail);
line([-.78,4.62,-6.03],[.78,4.62,-6.03],.045,bpCourtBrass,bpCourtDetail);
for(const side of [-1,1]){
  line([side*.67,4.6,-6.04],[side*.67,4.36,-6.04],.016,bpCourtBrass,bpCourtDetail);
  box(side*.67,4.34,-6.01,.47,.047,.19,bpCourtBrass,bpCourtDetail);
}
// Bailiff positions and a few nonanimated gallery silhouettes.
const bpBailiff=character(5.75,-3.96,'guard',bpCourtDetail);bpBailiff.rotation.y=-.18;
const bpCourtSpectators=[];
for(const x of [-5.65,-2.1,2.1,5.8]){
  const person=character(x,4.8,'engineer',bpCourtDetail);
  person.scale.setScalar(.78);person.rotation.y=Math.PI;
  bpCourtSpectators.push(person);
}
box(-7.1,3.03,-6.04,.18,2.7,.15,bpCourtBrass,bpCourtDetail);
box(7.1,3.03,-6.04,.18,2.7,.15,bpCourtBrass,bpCourtDetail);
const bpClockFrame=torus(6.4,4.6,-6.0,.41,.04,bpCourtBrass,bpCourtDetail);
for(let n=0;n<12;n++){
  const a=n*Math.PI/6;
  box(6.4+Math.sin(a)*.32,4.6+Math.cos(a)*.32,-5.95,.035,.06,.017,bpCourtPaper,bpCourtDetail);
}



// --------------------------------------------------------------------------
// Camera with smooth cinematic transitions and drag-to-orbit movement.
// --------------------------------------------------------------------------
const view={yaw:.71,pitch:.33,distance:22,target:V(0,2,0),desiredYaw:.71,desiredPitch:.33,desiredDistance:22,desiredTarget:V(0,2,0),drag:false,px:0,py:0};
const presets={
  overview:{yaw:.68,pitch:.35,distance:23,target:V(0,2.0,-1)},
  hacker:{yaw:-.32,pitch:.26,distance:9.3,target:V(-8.3,1.95,3)},
  servers:{yaw:.44,pitch:.22,distance:13.5,target:V(4.3,2.1,-2)},
  courtroom:{yaw:0,pitch:.18,distance:13.1,target:V(0,2,-1.2)},
  jail:{yaw:0,pitch:.12,distance:12,target:V(0,2,-.5)},
};
function focus(name){if(bp?.active)return;let p=presets[name]||presets.overview;view.desiredYaw=p.yaw;view.desiredPitch=p.pitch;view.desiredDistance=p.distance;view.desiredTarget.copy(p.target);for(let b of document.querySelectorAll('[data-camera]'))b.classList.toggle('selected',b.dataset.camera===name);}
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0||bp?.active)return;view.drag=true;view.px=e.clientX;view.py=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!view.drag||bp?.active)return;view.desiredYaw-=(e.clientX-view.px)*.007;view.desiredPitch=Math.max(.06,Math.min(1.15,view.desiredPitch+(e.clientY-view.py)*.005));view.px=e.clientX;view.py=e.clientY;});
renderer.domElement.addEventListener('pointerup',()=>{view.drag=false});
renderer.domElement.addEventListener('pointercancel',()=>{view.drag=false});
renderer.domElement.addEventListener('wheel',e=>{if(bp?.active)return;e.preventDefault();view.desiredDistance=Math.max(4.5,Math.min(35,view.desiredDistance+Math.sign(e.deltaY)*1.4));},{passive:false});
for(let b of document.querySelectorAll('[data-camera]'))b.addEventListener('click',()=>{sfx.tap();focus(b.dataset.camera);});
function moveCamera(dt){
  let f=1-Math.exp(-dt*3.5);view.yaw+=(view.desiredYaw-view.yaw)*f;view.pitch+=(view.desiredPitch-view.pitch)*f;view.distance+=(view.desiredDistance-view.distance)*f;view.target.lerp(view.desiredTarget,f);
  const cp=Math.cos(view.pitch);
  camera.position.copy(view.target).add(V(Math.sin(view.yaw)*cp*view.distance,Math.sin(view.pitch)*view.distance,Math.cos(view.yaw)*cp*view.distance));
  camera.lookAt(view.target);
}

// --------------------------------------------------------------------------
// Real-time Web Audio sound design: ventilation, fans, keyboard, sirens,
// filtered static, metal impacts, warning sweeps and low bass ambience.
// Starts only after the player clicks a mode, respecting autoplay rules.
// --------------------------------------------------------------------------
const RECORDED_SFX = Object.freeze({
  'click_001': 'data:audio/ogg;base64,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',
  'confirmation_001': 'data:audio/ogg;base64,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AJABAMAYg5BBBiFjEEIIIYQQQggJAAAYcAAACDChDBQashIASAUAAAxSijEHpaQUKcWYcxBKSSlSijHnIJSSUsWYcxBKSam1ijHnIJSSUmudcxBKSam1GDvnIJSSUmsxhhBKSam1GGMMIZSSUmsx1lpKSam1GGvMtZSSUmsx1lprSq21GGutNeeUWmsx1lpzzgUAIDQ4AIAd2LA6wknRWGChISsBgDwAAEgpxhhjjDGlFGOMMcaYUooxxhhjjDHGGGOMMaYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHmGGOMMcYYY8w5xhhjjDnmHGOMMcacc04AAFCBAwBAgI0imxOMBBUashIACAcAAIxhzDnnIJSQSqOUcxBCKCWVVhqlnIMSQikptZY5JyWlUlJqLbbMOSkplZJSay12ElJqLaXWYqyxg5BSa6m1FmONHYRSWootxhpz7SCUklprMcZaayilpdhirLHWmkMpqbUWY60151xSai3GWmvNteeSUmsxxlprrbmn1mKssdZcc+89tRZjjbXmnHvOBQCYPDgAQCXYOMNK0lnhaHChISsBgNwAAEYpxpxzDkIIIYQQQgiVUow55xyEEEIIIYQQKqUYc845CCGEEEIIIWSMOeccdBBCCCGEEELIGHPOOQghhBBCCCGE0DnnHIQQQgghhFBCKaVzzjkHIYQQQgghhFBK5xyEEEIIIYQSSiillM45CCGEEEIIpYRSSikhhBBCCCGEEkoppZRSOgghhBBCCKWUUkoppYQQQgghhBBKKaWUUkoJIYQQQgghlFJKKaWUEkIIIYQSSimllFJKKSWEEEIIoZRSSimllFJKCCGEUkoppZRSSimllBBCKCGUUkoppZRSSikhhBJKKKWUUkoppZRSQggllFJKKaWUUkoppYQQQiillFJKKaWUUkoJIZRSSimllFJKKaWUUgAA0IEDAECAEZUWYqcZVx6BIwoZJqBCQ1YCAOEAAAAhlFJKKaWUUmokpZRSSimllFIjJaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSqWUUkoppZRSSimllFJKKaWUUkoppQCoywwHwOgJG2dYSTorHA0uNGQl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',
  'error_001': 'data:audio/ogg;base64,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',
  'switch_001': 'data:audio/ogg;base64,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hJOiscBCQ1YCAHkAAJBSSjHGGGNMKaUYY4wxppRSjDHGmFNKKcYYY8w5pxRjjDHmnGOMMcYYc84xxhhjjDnnGGOMMcacc84xxhhjzjnnGGOMMeecc4wxxpgAAKACBwCAABtFNicYCSo0ZCUAEA4AABjDlHPOQSgllQohxiB0UEpKrVUIMQYhhFJSai1qzjkIIZSSUmvRc85BCKGUlFqLqoVQSiklpdZadC10UkpJqbUYo5QihJBSSq21GJ0TIYSSUmotxuacjKWk1FqMMTbnZCwlpdZijLE555xrrbUWY63NOedcaym2GGttzjmne2wx1lhrc845n1uLrcZaCwAweXAAgEqwcYaVpLPC0eBCQ1YCALkBAIxSjDHmnHPOOeecc85JpRhzzjkIIYQQQgghlEox5pxzEEIIIYQQQigZc845ByGEEEIIIYRQSumccxBCCCGEEEIIoZTSOecghBBCCCGEEEIppXPOQQghhBBCCCGEUkoIIYQQQgghhBBCCKWUUkIIIYQQQgghhBBKKaWEEEIIIYQQQgghlFJKCSGEEEIIIYQQQiillBJCCCGEEEIIJYRQSimllBBCCKGEEEIIoZRSSikhhFJKKSGEEEIppZRSQiihhBBCCCGUUkoppZQSQikhhBBCCKWUUkoppZRSQgghhBBKKaWUUkoppYRQQgghlFJKKaWUUkIoJYQSQiillFJKKaWEUEIIIYRQSimllFJKCSGEEkIIoQAAoAMHAIAAIyotxE4zrjwCRxQyTECFhqwEANICAABDrLXWWmuttdZaaw1S1lprrbXWWmuttUYpa6211lprrbXWWmuptdZaa6211lprrbXWWmuttdZaa6211lprrbXWWmuttdZaa6211lprrbXWWmuttdZaa6211lprrbXWWmuttdZaa6211lprrbXWWmuttdZaa6211lprrbXWWmuttdZaa6211lprrbXWWmuttdZaa6211lprrbXWWmuttdZaa6211lpLKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFJKKaWUUkoppZRSSimllFIB2AUbDoDRE0YSUmcZVhpx4wkYIpBCQ1YCAGkBAIAxjDHmGHQQSkkppQoh5yCETkIqrcUWY4SQcxBCKCWl1mKLMXgOQgghlNJSbDHGWDwHIYQQUmotxhhjDLKFUEopKbXWYoy1FtlCKKWUlFqLMdZagzGmlJJSaq3VWGOsxRgTSkiptdZizLXWYnysJaXUYoyxxlhrMca2FFKJLcZYa421GGGMaq3FWGOtsdZajDHClRZiirXWWnMtRghjc4sx1lhrrrkWYYzRuZVaao2x1lqLL8YYYWusNcZaa87FGCOEsLW2GmvNNddijDHGCB9jrLXW3HMxxhhjhJAxxhprzrkAgNwIBwDEBSMJqbMMK4248QQMEUihIasAgBgAgCEAhGKyAQCACQ4AAAFWsCuztGqjuKmTvOiDwCd0xGZkyKVUzORE0CM11GIl2KEV3OAFYKEhKwEAMgAAxFnNOcecK+SktdhqLBVSDlKKMXbIIOUkxVoyZBCD1GLqFDKIQWqpdAwZBCXGVDqFDINcYyuhYw5aq7GlEjoIAACAIADAQITMBAIFUGAgAwAOEBKkAIDCAkPHcBEQkEvIKDAoHBPOSacNAEAQIjNEImIxSEyoBoqK6QBgcYEhHwAyNDbSLi6gywAXdHHXgRCCEIQgFgdQQAIOTrjhiTc84QYn6BSVOhAAAAAAAAgAeAAASDaAiGhm5jg6PD5AQkRGSEpMTlBSVAQAAAAAABAAPgAAkhUgIpqZOY4Ojw+QEJERkhKTE5QUlQAAQAABAAAAABBAAAICAgAAAAAAAQAAAAICT2dnUwAEZ2oAAAAAAADRJQAAAgAAAPuUT60tnoWGiIf/rWkBAQEBAQEBAVOZgYWIe/+5dQEBAQEBAQEBAQEBAQEBAQEBAQEBDOboqJnRbnQojlkP5uiomdFudCiOWY9Y7GKHWK1YLJimWreahkVMqxo22NppFaPEtDVF1Go3bBaLg4O5rS0W02prp522Vqupqk4Rw2KzWVp7wKIFAQTBEYk4HB6PhXAogifAOBgDYzEYPBHFwgQsggUEHAQR8Yw4ASIiBAIGT8TDeBQGGAhHQCJAZIxGIBIzSExDJIVkAilVlQFSIgAU7lBLGkm05N5YbJAX7lBLGkm05N5YbJB3yirFlAZWi6rV2jMjswKx2tjValGaUtWKAn0M60T1MiSAgAKApyHAECCU5DCMBVgCgiEho6HBYFCACBAGxhJhPBDhKPDEtIjEJCKBQUNBSIUS4WgjywEDD55cSAh4DMQkpD4qE1SF9NNFhNYAdN1KFMvG0Wigd/auW4li2TgaDfTO3lWWVMlKBaupFvVtTFGLVSWUlVGglUF1MtgMRUVozOJqA1EUVQJUJAA2gBAALA0NSoEjJQNEBIPBEiAMQDEwhoDDUZJhaGkRUmIaCkqUGE9OSJwx4DQIETmCxxKiOBIqFI8DEgAhTFAJAIATi0Ao0QF01byYGXaShkGlpuyqeTEz7CQNg0pN2RbA6sRwcGoTY4tVTKtpsaKGXW1UpNRq2Ilgp00FxbQ2qlSIyFCoLA5IdAEFQCYlSQQIQBygBAgloAQclgjDGAAjeASHw+Eg4owz5JyEmoqEEoujogBqMiyKRYCgAw3TcUJGzIDjhSEGTFAF6w3o1BkAhNEQoOnI/bhYFr/RPoyGAE1H7sfFsviN9qMWO+wU0zDFapiGaWxarAamYTWshl1tBLE5OrEKKqRht9kNRRQsCkCEvscBgIAh4IgIHsIBPABYBMEDFIMScBgcgsMjWAzCOEdknANjDIEAhyIIBmBgRGVSSAoDQFo9+uqny1ErrY4qJAGtWlsBulMbAy2QFzzK40Qtn/rSRp6XGn1tpzYGWiAveJTHiVo+9aWNPC81+toWELXYaYeddrHTDjvtsNOmLGRkZGRkobhKtRVvNVRU1DAN02K12FqsFqvFapiGKSoAy7BarDa7zW6z2+w2u81uWO2wq11M02K1WC2mYUruOmzfe7qu67q0CBcVFRUVFRU1rJdFVaupWlFcKAsZGRlpsVpMwzRMUVEBKAmAgJACiGmx2+wWq8U0TMISAAAAAAAAIHgsEQ8QPBGLwSIIAUhpKQgRDCEGISeloSYnIKJ4DBZHxCMAS0QQAg4LARSHQ2EcDkaJCEIkQM4ZR0JCAiAClojBAgIKAIaIhRACFShMOgEkhc5g0Gl0BkJUBoOKABAGIGk0PAaLwWKwCIqgEMADLAElIQktFQ5HTU2Gx6BYHAPiCMQYAXKORAhESIjIgBOgjlaRRFLRanR1dDVaRRJJja4effXTXz999dGrozIrWh29evTq0dXRKlIwjEHBBGM0UoBYSEXVaHV09ejVR1+tra2trZG+s7OzE7RGQN/Z2dnZ2dnZSaOfvnp0dbSKKqRgYgDeU6O3r+9ZaqzYRajGOvfU6O3re5YaK3YRqrHOhAQAANQwTYtpww5WEQUAAACAELFhi6MTK6IAAAAAQAAAAAAAAAAIwACCsQiBiGAwBAA4I844Q04IBADEOTFihEAAAAAAAACAIVRJ0woGAAAAAAAAAITYpuoC8IvDMsQ2VReAXxyWQgiKAQBI6qvRT9Wf9IP+rJ+iv1YfHb16dfRR9Sf9oL/UR6NXV6NH1Ut6SFfVaFQt6UBTKopUSYHKipAyYGigqzVEFApFQ6bkWf0z/bMXCkVDpuRZ/TP9s49hhx3YaVosalXDMCxjazUsWE3DLnYRU8Qs07AxTDXEqR2wGNaytara2tVOW6eOdhMRQlXF5sSJzVC73VRVBgECHosQIQjgURQHsBAKQzgU4CEcjMAQhggwAE9A8XgczDljjIBjIIDFELAQ5wgAHBgwBkSABICMODQEg1VWBAs9GnADFBoBZGT78REhnQkLjQAysv34iJDOhKvY1Q7TsFoM02KKYWIdtraK1RAAGoSKamFdAJVJAHFUICAAgIBFEQxCQPE4ALAQAQYECE9A8UjUANRASEiGRRFZLFQLIMAUOgMonCMjQkyJOfAEoMChVwBCCG3KniNnUtZ0gKLVV4AAuBkA7AkpWsql3fng9KnvCSlayqXd+eD0qXcZ1UdZsmAYBramdVgNq9WiCkCzkLJqgYSHXcW0i0ALASDYFRSx24EgACiKkOEpaBAMnohDiSgAWByCxWIJUSkBKUpKRURLSk5QMMYIUQEg4gCCYBgEk44wAiAAIkKGDBCBnmwpmFEU8LTSA1AJANz5gJ4UQ/vUW4oVRt35gJ4UQ/vUW4oVRo1ph40tdlUbK1bDalh9GxHDNEXLykImaVeLWjAt2lRWKAoCKtYAMWxOhQMAQFAcDsAIEUVxCA5g8TBMhGAEEFBSkhAABQAMFgNjIQiHYmhISYlwDDpJoyMAwEAwKZhOnCMj4HqJCCR1dUEggEPs7ASUBbHO0GUz4NZckpebtiyIdYYumwG35pK83LTtAIYVNUyL1RfDalFEq0QJeJklYDFsBQgkAoBSRsKiGDxKBASUCEF4BMECDSUZggKeiIcRAoziDS1vNnxIOJCjj/46LDW6OqqQQhLU0BppYq9oFZZ69NWBqqEKJu7U2gqaUzuHVoEywf/DuuP8JbnU6wGxFR9yaufQKlAm+H9Yd5y/JJd6PSC24sMWQA1bGzvtsNMOO+2w046yUBbKQlkoi8qyorio3C1Wi9VitVgtVsM0TMPsQ9d1XfcgKqahgmmHXW2shmmYhmmYhtVitVgtptG61Pd9T8W0WG12m91mt5iCmbbYnTh14tTB0WY1TAERUlFRUTEN0zAtVtvFjLJQXFRZTbVVSpGRPUCQkoBAVFRU1DANq8Vqc3SykdXG1sZqmKKiAkACAAAAAAAAQCgBgiECAQAYhnF4UhweMFgCYmJSLOBIqQHCEQl4HBGHxxGIBCyCYWAqHSg0TFLoNCpCTBiPogQCnghhcVgCDkERFIEBhCUQsAgMABGmA4NAdDqBESaoDAowRE4cEIARATLgwBkxRGIMiDgjBELOGCFw4IgnI0EoSAjJKQmpgJqMkgbTGHQCAyIpVBqdRqcxjkCMc0AGHBgHRBRGMTgEwuKIRAIRp6tHX3301Uevjq5GFQwwSaEqqiKFJAax0NTQVFRFCkkMgLizs7OzE62tra0ROjs7QRMBAOjGoGA0NTQ1VEVVpJCCiSkCAN5T24pF8r+rb8/3p5w/EZoE557aViyS/119e74/5fyJ0CQ4E1JUBUVUHRwtpkA4YQkghQJkUWVRAgCAgHAAAAAAAACAMcYZI2KcAxAhCggWT4UlxZFRElDSoHigs5WRUAZKKAAAAINUHa0At3QBgMax1ykAAA4ODg4ODg4ODg4ODg4ODg4ODg4O',
  'select_001': 'data:audio/ogg;base64,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',
  'bong_001': 'data:audio/ogg;base64,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'
});
class Soundscape {
  constructor(){this.ctx=null;this.master=null;this.enabled=true;this.fan=null;this.fanFilter=null;this.fanWhine=null;this.alarm=null;this.alarmGain=null;this.vent=null;}
  init(){
    if(!this.enabled)return;
    if(this.ctx){void this.ctx.resume();return;}
    try {
      const C=window.AudioContext||window.webkitAudioContext;
      if(!C)return;
      const a=this.ctx=new C();
      this.master=a.createGain();this.master.gain.value=.77;this.master.connect(a.destination);
      const size=a.sampleRate*3;
      const noise=a.createBuffer(2,size,a.sampleRate);
      for(let ch=0;ch<2;ch++){let d=noise.getChannelData(ch);for(let i=0;i<size;i++)d[i]=(Math.random()*2-1)*.49;}
      const source=a.createBufferSource();source.buffer=noise;source.loop=true;
      const lp=a.createBiquadFilter();lp.type='lowpass';lp.frequency.value=290;this.fanFilter=lp;
      const low=a.createBiquadFilter();low.type='highpass';low.frequency.value=70;
      this.fan=a.createGain();this.fan.gain.value=.038;
      source.connect(low);low.connect(lp);lp.connect(this.fan);this.fan.connect(this.master);source.start();
      const hum=a.createOscillator();hum.type='sine';hum.frequency.value=56;
      const hum2=a.createOscillator();hum2.type='triangle';hum2.frequency.value=113.5;this.fanWhine=hum2;
      this.vent=a.createGain();this.vent.gain.value=.026;
      hum.connect(this.vent);hum2.connect(this.vent);this.vent.connect(this.master);hum.start();hum2.start();
      const siren=a.createOscillator();siren.type='sine';siren.frequency.value=390;
      this.alarmGain=a.createGain();this.alarmGain.gain.value=0;
      siren.connect(this.alarmGain);this.alarmGain.connect(this.master);siren.start();this.alarm=siren;
    } catch (e){console.warn('Audio unavailable',e);}
  }
  sample(name,volume=.36){
    if(!this.enabled)return;
    const clip=RECORDED_SFX[name];if(!clip)return;
    try{const audio=new Audio(clip);audio.volume=volume;void audio.play().catch(()=>{});}catch{}
  }
  toggle(){this.enabled=!this.enabled; if(this.enabled){this.init();this.master?.gain.setTargetAtTime(.77,this.ctx.currentTime,.09);}else if(this.master)this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.05);return this.enabled;}
  tone(freq,duration=.13,type='sine',gain=.12,endfreq=freq){
    if(!this.enabled||!this.ctx)return;
    const a=this.ctx,t=a.currentTime,o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(25,endfreq),t+duration);
    g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(Math.max(.001,gain),t+.012);g.gain.exponentialRampToValueAtTime(.001,t+duration);
    o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.03);
  }
  noise(duration=.11,gain=.08,hp=600){
    if(!this.enabled||!this.ctx)return;
    const a=this.ctx,t=a.currentTime,len=Math.floor(a.sampleRate*duration),b=a.createBuffer(1,len,a.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
    const src=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();src.buffer=b;f.type='highpass';f.frequency.value=hp;g.gain.value=gain;src.connect(f);f.connect(g);g.connect(this.master);src.start(t);
  }
  tap(){this.sample('click_001',.28);this.tone(730,.035,'triangle',.038,460);this.noise(.025,.024,2300)}
  keyboard(){this.sample('select_001',.21);for(let i=0;i<6;i++)setTimeout(()=>{this.noise(.03,.024,1800);this.tone(850+Math.random()*550,.021,'triangle',.028,560);},i*45);}
  burst(){this.sample('bong_001',.53);this.noise(.55,.17,85);this.tone(102,.46,'sawtooth',.18,42);this.tone(530,.17,'square',.065,265)}
  deploy(){this.sample('confirmation_001',.41);this.tone(250,.22,'sine',.11,790);setTimeout(()=>this.tone(1040,.15,'sine',.08,960),105)}
  alert(){this.sample('error_001',.3);this.tone(720,.2,'square',.045,690);setTimeout(()=>this.tone(580,.2,'square',.04,575),260)}
  scan(){this.sample('switch_001',.37);this.noise(.18,.06,1000);this.tone(430,.32,'sine',.075,1200)}
  win(){this.sample('confirmation_001',.47);[480,620,790,1040].forEach((f,i)=>setTimeout(()=>this.tone(f,.45,'sine',.09),i*170))}
  lose(){this.sample('error_001',.47);[350,285,210,140].forEach((f,i)=>setTimeout(()=>this.tone(f,.4,'sawtooth',.065),i*230))}
  metal(){this.sample('bong_001',.7);this.noise(.63,.24,145);this.tone(145,.58,'sawtooth',.19,50);setTimeout(()=>this.tone(60,.9,'triangle',.14,34),145)}
  update(time,health,active,traffic=0,fanLoad=0){
    if(!this.ctx||!this.master)return;
    const t=this.ctx.currentTime;
    if(this.fan)this.fan.gain.setTargetAtTime(active?.04+Math.min(1,fanLoad)*(.22+Math.min(.18,traffic/120000)):.03,t,1.2);
    if(this.fanFilter)this.fanFilter.frequency.setTargetAtTime(active?300+fanLoad*(600+Math.min(1700,traffic/24)):280,t,1.0);
    if(this.fanWhine)this.fanWhine.frequency.setTargetAtTime(active?72+fanLoad*(35+Math.min(140,traffic/380)):72,t,.8);
    if(this.alarm){this.alarm.frequency.setTargetAtTime(430+210*Math.sin(time*6.7),t,.035);this.alarmGain.gain.setTargetAtTime(active&&fanLoad>.6&&(health<55||traffic>13000)?.065:0,t,.3);}
  }
}
const sfx=new Soundscape();
$('audio').onclick=()=>{$('audio').textContent=sfx.toggle()?'♫ ON':'♫ OFF';sfx.tap();};

// --------------------------------------------------------------------------
// Fictional gameplay model. There are no fetch(), WebSocket or live IP calls.
// --------------------------------------------------------------------------
const GAME_SECONDS=1080;
let game=null,uiTick=0,toastTimer=0,visualTime=0,flashAlpha=0,endingDelay=0,alarmCooldown=0;
const ACTIONS={
  attack:[
    {id:'bots',title:'Recruit remote devices',description:'Increase the size of your device swarm.',cd:2,kind:'primary'},
    {id:'burst',title:'Launch traffic surge',description:'Trigger a short, intense traffic wave.',cd:12,kind:'hot'},
    {id:'reroute',title:'Change traffic routing',description:'Temporarily reduce how many requests proxies block.',cd:19},
    {id:'hide',title:'Obscure signal',description:'Lower your exposure to investigators.',cd:23},
  ],
  defend:[
    {id:'proxy',title:'Deploy protective proxy',description:'Add an edge appliance to absorb malicious requests.',cd:6,kind:'primary'},
    {id:'limit',title:'Enable emergency rate limits',description:'Briefly reduce the pressure on the application servers.',cd:19},
    {id:'analyze',title:'Analyze traffic fingerprints',description:'Collect case evidence from telemetry.',cd:9},
    {id:'trace',title:'Trace suspicious relay hops',description:'Review recorded relay hops to locate the suspect.',cd:12},
  ]
};
let actionButtons=new Map();
function formatRate(r){return r>=1e6?(r/1e6).toFixed(2)+'M':r>=1000?(r/1000).toFixed(1)+'K':Math.round(r).toString()}
function timestamp(){const e=Math.floor(game?.elapsed||0);return String(Math.floor(e/60)).padStart(2,'0')+':'+String(e%60).padStart(2,'0')}
function log(message,tone=''){if(!game)return;game.logs.unshift({at:timestamp(),message,tone});game.logs.length=Math.min(game.logs.length,18);}
function notify(message,alert=false){if(alert)bpShowIncident(message);clearTimeout(toastTimer);$('toast').textContent=message;$('toast').style.borderColor=alert?'#f28a7c':'#7ae9d49e';$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2900);}
function createGame(mode){
  return {mode,ended:false,win:false,elapsed:0,health:100,traffic:0,delivered:0,bots:mode==='attack'?12:48,proxies:0,
    risk:mode==='attack'?0:8,trace:0,fanLoad:0,
    burst:0,reroute:0,limit:0,logs:[],cooldowns:{},phase:0,
    nextDefenderProxy:18,nextAttackerWave:13,nextSabotageAt:28,nextCoolingIncident:46,nextAutoProxyAt:13,nextEvidenceDispatch:17,attackerWave:0,arrested:false,caseClosed:false,flash:0,proxyOrders:0,proxySabotage:null,coolingNeedsRepair:false,nextDispatchAllowed:0,securityResponseUntil:0,securityIncidentSerial:0,securityDispatchedSerial:0,securityAlarmWasHigh:false,requestFeed:createTrafficFeed((Math.random()*0xffffffff)>>>0),collectedEvidence:{},suspectHeld:false,suspectHoldGuard:null,patrolSeed:(Math.random()*0xffffffff)>>>0,
  };
}
function startGame(mode){
  // Ignore any stale mode-card click, keypress or delayed UI action during a mission.
  if(game&&!game.ended)return;
  if(mode!=='attack'&&mode!=='defend')return;
  sfx.init();sfx.tap();game=createGame(mode);
  $('home').classList.add('hidden');$('home').hidden=true;$('home').inert=true;
  $('game').classList.add('active');$('ending').classList.remove('visible');
  $('panelname').textContent=mode==='attack'?'ATTACK TERMINAL':'SECURITY OPERATIONS';
  $('panelmeta').textContent=mode==='attack'?'OFFENSIVE ACTIONS':'RESPONSE ACTIONS';
  $('trace-label').textContent=mode==='attack'?'TRACE EXPOSURE':'CASE EVIDENCE';
  $('trace-sub').textContent=mode==='attack'?'DETECTION THRESHOLD':'SUSPECT IDENTIFICATION';
  $('progressbar').classList.toggle('alert',mode==='attack');
  bpResetProxies();
  bpCoolingIndicator.material=mint;
  reqTube.visible=true;world.visible=true;dynamic.visible=true;jail.visible=false;courtroom.visible=false;
  scene.fog.density=.010;scene.background.set('#25313f');
  actionButtons.clear();$('actions').replaceChildren();
  for(let a of ACTIONS[mode]){
    const b=document.createElement('button');b.className='action '+(a.kind||'');b.type='button';
    const strong=document.createElement('strong');const title=document.createTextNode(a.title);const cd=document.createElement('span');strong.append(title,cd);
    const small=document.createElement('small');small.textContent=a.description;
    b.append(strong,small);b.onclick=()=>act(a.id);$('actions').append(b);actionButtons.set(a.id,{button:b,cd});
  }
  log(mode==='attack'?'Remote terminal established. Target: 203.0.113.24':'Alert: anomalous requests hit the public edge.',mode==='attack'?'warn':'good');
  log('LINK ESTABLISHED. INCIDENT CLOCK ACTIVE.');
  notify(mode==='attack'?'OBJECTIVE: BRING THE SERVER TO ZERO INTEGRITY':'OBJECTIVE: PROTECT THE NETWORK AND ARREST THE SUSPECT');
  focus(mode==='attack'?'hacker':'servers');
  updateUI(true);
}
function actionReady(id){return !!game && !game.ended && (game.cooldowns[id]||0)<=0;}
function act(id){
  if(!game||game.ended||!actionReady(id))return;
  const g=game;
  if(g.mode==='attack'){
    switch(id){
      case'bots':g.bots=Math.min(340,g.bots+22);g.risk+=3;flagSecurityIncident(g);log('Device group expanded. Nodes: '+g.bots,'warn');sfx.keyboard();break;
      case'burst':g.burst=8;g.risk+=9;flagSecurityIncident(g);log('Traffic surge initiated.','warn');sfx.burst();flashAlpha=.1;break;
      case'reroute':g.reroute=11;g.risk+=5;flagSecurityIncident(g);log('Routing variation detected by edge security.','warn');sfx.scan();break;
      case'hide':g.risk=Math.max(0,g.risk-19);log('Signal exposure temporarily reduced.','good');sfx.keyboard();break;
    }
    const a=ACTIONS.attack.find(v=>v.id===id);g.cooldowns[id]=a.cd;
  } else {
    switch(id){
      case'proxy':
        if(g.proxies+(g.proxyOrders||0)>=6)return;
        g.proxyOrders=(g.proxyOrders||0)+1;
        g.nextDispatchAllowed=Math.min(g.nextDispatchAllowed??g.elapsed,g.elapsed);
        notify('SECURITY CREW ASSIGNED TO EDGE CABINET');
        sfx.scan();break;
      case'limit':g.limit=13;log('Emergency rate limiting enabled.','good');notify('RATE LIMITS ACTIVE');sfx.deploy();break;
      case'analyze':g.trace=Math.min(100,g.trace+15);log('Matching traffic fingerprint filed as evidence.','good');sfx.scan();break;
      case'trace':if(g.trace<22)return;g.trace=Math.min(100,g.trace+19);log('Relay trail correlated with security cameras.','good');sfx.scan();focus('hacker');break;
      case'arrest':if(g.trace<100)return;g.arrested=true;endGame(true,'SUSPECT ARRESTED','The response team stabilized the web servers, verified the incident evidence, and secured the hooded attacker in a detention cell.');return;
    }
    const a=ACTIONS.defend.find(v=>v.id===id);g.cooldowns[id]=a.cd;
  }
  updateUI(true);
}
function endGame(win,title,description){
  if(!game||game.ended)return;
  const g=game;g.ended=true;g.win=win;
  g.endTitle=title;g.endDescription=description;
  sfx[win?'win':'lose']();
  log(win?'Operation completed successfully.':'Mission failed. Network incident unresolved.',win?'good':'warn');
  if(g.arrested){
    world.visible=false;dynamic.visible=false;jail.visible=false;courtroom.visible=true;
    scene.fog.density=.008;scene.background.set('#242535');
    focus('courtroom');
    g.courtPhase='hearing';g.courtTimer=8.0;g.gavelPlayed=false;endingDelay=0;
    bpShowIncident('COURT / HEARING IN SESSION');
    sfx.scan();
  }
  else{endingDelay=.85;}
  updateUI(true);
}
function showEnd(){if(!game)return;$('result-type').textContent=game.win?'OPERATION COMPLETE':'MISSION FAILED';$('result-type').classList.toggle('loss',!game.win);$('result-title').textContent=game.endTitle;$('result-text').textContent=game.endDescription;$('ending').classList.add('visible');}
function stepGame(dt){
  if(!game)return;
  const g=game;
  if(g.ended){
    if(g.arrested&&g.courtPhase==='hearing'){
      g.courtTimer-=dt;
      if(g.courtTimer<4.5&&!g.gavelPlayed){
        g.gavelPlayed=true;sfx.metal();
        bpShowIncident('COURT / SENTENCE DELIVERED');
      }
      if(g.courtTimer<=0){
        courtroom.visible=false;jail.visible=true;
        scene.background.set('#14191f');scene.fog.density=.012;
        focus('jail');sfx.metal();g.courtPhase='detention';endingDelay=4.0;
      }
      return;
    }
    if(endingDelay>0){endingDelay-=dt;if(endingDelay<=0)showEnd();}
    return;
  }
  g.elapsed+=dt;
  for(let id of Object.keys(g.cooldowns))g.cooldowns[id]=Math.max(0,g.cooldowns[id]-dt);
  g.burst=Math.max(0,g.burst-dt);g.reroute=Math.max(0,g.reroute-dt);g.limit=Math.max(0,g.limit-dt);
  if(g.mode==='attack'){
    // Automated defenders gradually bring edge mitigation online.
    if(g.elapsed>=g.nextDefenderProxy && (g.burst>0||g.traffic>11000) && g.proxies+(g.proxyOrders||0)<6){
      g.proxyOrders=(g.proxyOrders||0)+1;
      g.nextDefenderProxy=g.elapsed+49;
    }
    const targetRps=(750+g.bots*185+(g.burst>0?14500:0))*ATTACK_TRAFFIC_SCALE;
    g.traffic=g.requestFeed.step({targetRps,elapsed:g.elapsed,health:g.health,proxies:g.proxies,burst:g.burst>0},dt);
    if(g.elapsed>=g.nextCoolingIncident&&g.traffic>16000)bpTriggerCoolingIssue(g);
    const blockedRatio=Math.min(.88,Math.max(0,g.proxies*.13+(g.proxies>=3?.11:0)-(g.reroute>0?.24:0)));
    g.delivered=g.traffic*(1-blockedRatio);
    g.risk=Math.min(100,g.risk+dt*(g.traffic>15000?.15:.055)+dt*(g.burst>0?.18:0)+dt*g.proxies*.065);
    if(g.risk>=100){endGame(false,'YOU WERE TRACED','The security team correlated security logs and identified your workstation before the service went offline.');return;}
  } else {
    if(g.elapsed>=g.nextAutoProxyAt&&g.traffic>9000&&g.proxies+(g.proxyOrders||0)<4){
      g.proxyOrders++;
      flagSecurityIncident(g);
      g.nextAutoProxyAt=g.elapsed+29;
      log('Security operations authorized another protective proxy.','good');
    }
    if(g.elapsed>=g.nextAttackerWave){g.attackerWave=9;g.nextAttackerWave+=24;flagSecurityIncident(g);log('Intruder launched another traffic wave.','warn');notify('INCOMING TRAFFIC SURGE',true);sfx.burst();}
    g.attackerWave=Math.max(0,g.attackerWave-dt);
    g.bots+=dt*.42;
    const targetRps=(3800+g.bots*118+(g.attackerWave>0?4700:0))*DEFENSE_WAVE_SCALE;
    g.traffic=g.requestFeed.step({targetRps,elapsed:g.elapsed,health:g.health,proxies:g.proxies,burst:g.attackerWave>0},dt);
    const blockedRatio=Math.min(.89,g.proxies*.13+(g.limit>0?.34:0));
    g.delivered=g.traffic*(1-blockedRatio);
  }
  const saturation=g.delivered/(g.mode==='attack'?10200:12500);
  if(saturation>1){g.health=Math.max(0,g.health-dt*Math.pow(saturation-1,1.14)*1.35);}else{g.health=Math.min(100,g.health+dt*.23);}
  if(g.coolingNeedsRepair&&g.coolingEventUntil>g.elapsed)
    g.health=Math.max(0,g.health-dt*.16);
  if(g.health<50 && alarmCooldown<=0){sfx.alert();alarmCooldown=5;log('Server health warning: high application pressure.','warn');}
  if(g.health<=0){
    if(g.mode==='attack')endGame(true,'SERVER OFFLINE','The web cluster stopped responding after sustained overload.');
    else endGame(false,'SERVER COMPROMISED','The service became unavailable before the defense team completed its investigation.');
    return;
  }
  if(g.elapsed>=GAME_SECONDS){
    if(g.mode==='attack')endGame(false,'DEFENSE HELD','Time expired. The blue team maintained enough capacity to keep the server online.');
    else endGame(false,'SUSPECT ESCAPED','The service survived, but the investigation did not produce an arrest before the case deadline.');
    return;
  }
  if(g.mode==='attack'){
    g.phase=g.proxies>=3?2:g.proxies>0?1:0;
  } else {
    g.phase=g.trace>=100?3:g.trace>=48?2:g.trace>=22?1:0;
  }
}
function updateUI(force=false){
  if(!game)return;const g=game;
  $('traffic').textContent=formatRate(g.traffic);
  $('health').textContent=Math.round(g.health)+'%';
  $('health').classList.toggle('critical',g.health<35);
  $('proxies').textContent=String(g.proxies);
  const progress=g.mode==='attack'?g.risk:g.trace;
  $('trace').textContent=Math.round(progress)+'%';
  $('trace').classList.toggle('critical',g.mode==='attack'&&g.risk>70);
  $('progress').style.width=progress+'%';
  $('trace-description').textContent=g.mode==='attack'?'INVESTIGATION RISK / '+Math.round(g.risk)+'%':'VERIFIED CASE EVIDENCE / '+Math.round(g.trace)+'%';
  const seconds=Math.max(0,Math.ceil(GAME_SECONDS-g.elapsed));
  $('timer').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  const phase=g.phase;
  const phases=g.mode==='attack'?[['PHASE 01 / BUILD THE SWARM','Establish traffic flow.','Recruit devices, then launch a burst before defenders recover.'],['PHASE 02 / EDGE DEFENSES','Proxy servers are online.','The blue team is absorbing requests. Reroute to increase pressure.'],['PHASE 03 / FINAL PUSH','Overwhelm the cluster.','Balance traffic intensity against your growing trace exposure.']]:[['PHASE 01 / RESPONSE','Protect the live service.','Deploy proxies before traffic exceeds application capacity.'],['PHASE 02 / FORENSICS','Analyze the traffic signature.','Collect evidence to narrow down the source.'],['PHASE 03 / INVESTIGATION','Locate the hooded attacker.','Follow the relay trail and complete the security case.'],['PHASE 04 / APPREHENSION','Suspect identified.','Order a lawful arrest to complete the investigation.']];
  const p=phases[Math.min(phase,phases.length-1)];$('stage').textContent=p[0];$('stage').classList.toggle('attack',g.mode==='attack');$('objective').textContent=p[1];$('mission').textContent=p[2];
  for(const a of ACTIONS[g.mode]){
    const o=actionButtons.get(a.id);if(!o)continue;
    const cool=Math.max(0,g.cooldowns[a.id]||0);
    const disabled=g.ended||cool>0||(a.id==='proxy'&&g.proxies>=6)||(a.id==='trace'&&g.trace<22)||(a.id==='arrest'&&g.trace<100);
    o.button.disabled=disabled;
    o.cd.textContent=cool>0?Math.ceil(cool)+'s':a.id==='proxy'&&g.proxies>=6?'MAX':a.id==='arrest'&&g.trace<100?'LOCKED':a.id==='trace'&&g.trace<22?'LOCKED':'READY';
  }
  proxyObjects.forEach(o=>{o.visible=world.visible;});
  reqTube.visible=false;
}
function animateScene(t,dt){
  const g=game;
  // Subtle server and warning indicators.
  const offline=g&&g.health<35;
  for(let i=0;i<serverLeds.length;i++){
    const led=serverLeds[i];if(lowQuality&&i%3!==0)continue;
    led.material=offline&&i%3===0?red:i%11===0&&Math.sin(t*2+i)>0?orange:mint;
    led.scale.y=.04+(Math.sin(t*7+i*.51)>0?.02:0);
  }
  const active=g&&!g.ended;
  const count=active?Math.min(lowQuality?35:100,Math.max(10,Math.floor(Math.sqrt(g.traffic)*.69))):0;
  for(let i=0;i<packets.length;i++){
    const p=packets[i];p.visible=false;
    if(!p.visible)continue;
    const progress=(t*(.18+(g.traffic/120000))+i*.071)%1;
    p.position.copy(requestCurve.getPointAt(progress));
    p.position.y+=Math.sin(t*3+i)*.07;
    p.scale.setScalar(.7+Math.random()*.65);
    p.material=active&&g.mode==='attack'?i%6===0?orange:red:i%5===0?orange:red;
  }
  const blockedCount=active?Math.min(blocked.length,Math.floor(g.proxies*3.5)):0;
  for(let i=0;i<blocked.length;i++){
    blocked[i].visible=false;
    if(blocked[i].visible)blocked[i].position.copy(outgoingCurve.getPointAt((t*.15+i*.13)%1));
  }
  proxyObjects.forEach((o,i)=>{
    if(!o.userData.powered)return;
    o.userData.ring.rotation.z=t*.52+(i%2)*.4;
    o.userData.glow.intensity=1.35+.4*Math.sin(t*2+i);
  });
  if(courtroom.visible&&game?.courtPhase==='hearing'){
    const progress=1-Math.max(0,Math.min(1,game.courtTimer/8));
    bpGavel.rotation.z=progress>.42&&progress<.55 ? -Math.sin((progress-.42)/.13*Math.PI)*.55 : 0;
    bpGavel.position.y=1.43+(progress>.42&&progress<.55?Math.sin((progress-.42)/.13*Math.PI)*.12:0);
  }
  if(jail.visible){sirenRed.intensity=2.5+2*Math.max(0,Math.sin(t*6));sirenBlue.intensity=2.5+2*Math.max(0,Math.sin(t*6+Math.PI));}
  flashAlpha+=(0-flashAlpha)*Math.min(1,dt*2.4);
  $('flash').style.opacity=String(Math.max(0,flashAlpha));
  sfx.update(t,g?.health??100,Boolean(active),g?.traffic??0,g?.fanLoad??0);
}

// --------------------------------------------------------------------------
// Input, restart, responsive rendering and fixed-delta loop.
// --------------------------------------------------------------------------
// Mode selection must never receive clicks behind an active 3D scene.
for(const b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',event=>{
  event.stopPropagation();
  if(game || $('home').hidden || $('home').classList.contains('hidden'))return;
  const mode=b.dataset.mode;
  if(mode!=='attack'&&mode!=='defend')return;
  startGame(mode);
});
function menu(){game=null;endingDelay=0;world.visible=true;dynamic.visible=true;jail.visible=false;courtroom.visible=false;scene.fog.density=.010;scene.background.set('#25313f');$('home').hidden=false;$('home').inert=false;$('home').classList.remove('hidden');$('game').classList.remove('active');$('ending').classList.remove('visible');reqTube.visible=false;for(let o of proxyObjects)o.visible=false;focus('overview');sfx.tap();}
$('restart').onclick=()=>menu();
$('again').onclick=()=>{const mode=game?.mode||'defend';startGame(mode);};
$('menu').onclick=()=>menu();
document.addEventListener('keydown',e=>{
  if(e.code==='Escape'&&game){if(window.__bpEscape?.())return;menu();return;}
  if(!game||game.ended)return;
  if(!window.__bpIsFPS?.()&&['Digit1','Digit2','Digit3'].includes(e.code))focus(['overview','hacker','servers'][Number(e.code.slice(-1))-1]);
});
function resize(){const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);}
window.addEventListener('resize',resize);
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(game)notify('GRAPHICS CONTEXT LOST. RELOAD THE PAGE.',true);});
const clock=new THREE.Clock();
let lastDraw=0;
function frame(now=0){
  requestAnimationFrame(frame);
  const dt=Math.min(clock.getDelta(),.05);visualTime+=dt;alarmCooldown=Math.max(0,alarmCooldown-dt);
  stepGame(dt);moveCamera(dt);animateScene(visualTime,dt);
  uiTick+=dt;if(game&&(uiTick>.18)){updateUI();uiTick=0;}
  const targetFps=lowQuality?27:60;
  if(now-lastDraw>=1000/targetFps){renderer.render(scene,camera);lastDraw=now;}
}

/* Blackout Protocol: embodied first-person missions and cinematic incident AI.
   Every "attack", trace, proxy and request is in-memory gameplay only. */
const bp = {
  player: V(-8.3, 0, 6.15), yaw:.24, pitch:-.06, keys:new Set(),
  terminal:false, active:false, third:false, crouching:false,dragging:false,dragX:0,dragY:0,
  stepClock:0, npcTyping:true, npcHiding:false,
  targetDesk: V(-8.8,0,4.0), guardAlert:false,
};
const bpClamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const bpDistance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const bpAttackerDesk=V(-8.5,0,3.97);
const bpDefenseDesk=V(bpOfficeConsoleX,0,bpOfficeConsoleZ+1.05);
const bpHideSpot=V(-4.15,0,8.8);
const bpCoolingStation=V(8.4,0,4.4);
const bpCoolingFrame=box(8.27,1.35,4.4,.19,2.02,1.05,edgeMetal);
const bpCoolingPanel=box(8.42,1.62,4.4,.035,.79,.70,mat('#172a39',{metal:.3,rough:.25,glow:.7}));
const bpCoolingIndicator=ball(8.47,2.2,4.4,.09,mint);
label('COOLANT / RESET',8.48,1.73,4.4,.57,.16,Math.PI/2);

const bpPlayerAvatar=character(23.0,-3.55,'engineer');
bpPlayerAvatar.visible=false;
let bpSmoothedRpm=940;
const bpFanRotors=[];

function bpApplyQuality(){
  // Runtime switching changes actual GPU work, not only the dropdown label.
  // Fewer active point lights, smaller render targets, lower DPR and 27 fps on Low.
  for(let i=0;i<bpFixtureLights.length;i++)
    bpFixtureLights[i].intensity=lowQuality?(i%3===0?2.8:0):3.0;
  for(let i=0;i<bpFanRotors.length;i++)
    bpFanRotors[i].visible=!lowQuality||(i%3===0);
  bpRackDetail.visible=!lowQuality;
  bpCourtDetail.visible=!lowQuality;
  for(const target of bpCctvTargets)target.setSize(lowQuality?256:448,lowQuality?144:252);
  const officeW=lowQuality?512:768,officeH=lowQuality?288:432;
  if(bpOfficeMonitorCanvas.width!==officeW){
    bpOfficeMonitorCanvas.width=officeW;
    bpOfficeMonitorCanvas.height=officeH;
    bpPaintOfficeMonitor();
  }
  for(let i=0;i<bpRackDecor.length;i++)
    bpRackDecor[i].visible=!lowQuality||(i%4===0);
  if(typeof bpWallCanvas!=='undefined'){
    const w=lowQuality?512:1024,h=lowQuality?288:576;
    if(bpWallCanvas.width!==w){bpWallCanvas.width=w;bpWallCanvas.height=h;bpWallGraph(visualTime);}
  }
}

const bpFanSpeedLeds=[];
const bpFanBlurMaterial=new THREE.MeshBasicMaterial({
  color:0xa1c5ea,transparent:true,opacity:.028,depthWrite:false,
  side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
});
const bpFanBlurGeometry=new THREE.RingGeometry(.10,.275,24);
for(const [rx,rz] of rackCoords){
  for(let j=0;j<4;j++){
    if(lowQuality&&j%2===1)continue;
    const rotor=new THREE.Group();
    rotor.position.set(rx-.973,1.15+j*.78,rz);
    rotor.rotation.y=Math.PI/2;
    world.add(rotor);
    for(let bladeIndex=0;bladeIndex<(lowQuality?3:5);bladeIndex++){
      const angle=bladeIndex*Math.PI*2/(lowQuality?3:5);
      const blade=box(Math.cos(angle)*.125,Math.sin(angle)*.125,0,.23,.078,.028,mat('#b6d5df',{metal:.8,rough:.28}),rotor);
      blade.rotation.z=angle;
    }
    ball(0,0,0,.075,edgeMetal,rotor);
    const motionBlur=new THREE.Mesh(bpFanBlurGeometry,bpFanBlurMaterial);
    motionBlur.position.z=.025;
    motionBlur.renderOrder=3;
    rotor.add(motionBlur);
    bpFanSpeedLeds.push(ball(rx-1.02,1.41+j*.78,rz,.042,mint,world));
    bpFanRotors.push(rotor);
  }
}
const bpEmergencyLights=[
  light(-11,5.8,-1,0xff2b4e,0,13),
  light(11,5.8,4,0xff2b4e,0,13),
  light(1,5.8,-9,0xff2b4e,0,12)
];
for(const l of bpEmergencyLights){
  ball(l.position.x,6.0,l.position.z,.16,red);
}
const bpHoodCloth=mat('#242330',{metal:0,rough:1});
const bpStitch=mat('#5d5465',{metal:0,rough:.85});
box(0,1.40,-.52,.75,.76,.24,bpHoodCloth,attacker);
box(0,1.58,-.661,.56,.12,.035,bpStitch,attacker);
for(const side of [-1,1]){
  box(side*.37,1.51,.18,.055,.52,.04,bpStitch,attacker);
  box(side*.35,.77,.16,.15,.14,.21,bpHoodCloth,attacker);
  box(side*.29,2.4,.43,.065,.38,.05,bpHoodCloth,attacker);
}
box(0,2.85,.16,.54,.1,.30,bpHoodCloth,attacker);
const bpLaptopRig=new THREE.Group();world.add(bpLaptopRig);
const bpLaptopDock=V(-8.5,1.3,3.09);
bpLaptopRig.position.copy(bpLaptopDock);
const bpLaptopBottom=box(0,.03,0,1.69,.06,.91,darkMetal,bpLaptopRig);
box(0,.065,.25,1.43,.035,.39,black,bpLaptopRig);
for(let k=0;k<12;k++)for(let row=0;row<3;row++){
  box(-.69+k*.124,.09,-.05+row*.103,.103,.012,.075,mat('#536378',{metal:.22,rough:.7}),bpLaptopRig);
}
box(0,.084,.31,.39,.012,.16,mat('#343c4e',{metal:.31,rough:.41}),bpLaptopRig);
const bpLaptopLid=box(0,.52,-.47,1.84,1.19,.09,darkMetal,bpLaptopRig);
box(0,.51,-.418,1.74,1.08,.015,black,bpLaptopRig);
for(const x of [-.62,.62])box(x,.12,-.46,.08,.17,.08,edgeMetal,bpLaptopRig);

const bpLaptopBeacon=light(-8.5,2.49,2.79,0x8de4d4,1.35,4);
const bpConsoleBeacon=light(bpOfficeConsoleX,2.62,bpOfficeConsoleZ,0x9e8ceb,1.7,4);

const bpDisplayCanvas=document.createElement('canvas');
bpDisplayCanvas.width=1024;bpDisplayCanvas.height=720;
const bpDisplayContext=bpDisplayCanvas.getContext('2d');
const bpDisplayTexture=new THREE.CanvasTexture(bpDisplayCanvas);
bpDisplayTexture.colorSpace=THREE.SRGBColorSpace;
const bpDisplayPlane=new THREE.Mesh(
  new THREE.PlaneGeometry(1.68,1.045),
  new THREE.MeshBasicMaterial({map:bpDisplayTexture,side:THREE.FrontSide,toneMapped:false})
);
bpDisplayPlane.position.set(0,.52,-.405);
bpDisplayPlane.renderOrder=2;
bpLaptopRig.add(bpDisplayPlane);
const bpSecurityCanvas=document.createElement('canvas');
bpSecurityCanvas.width=1024;bpSecurityCanvas.height=620;
const bpSecurityCtx=bpSecurityCanvas.getContext('2d');
const bpSecurityTexture=new THREE.CanvasTexture(bpSecurityCanvas);
bpSecurityTexture.colorSpace=THREE.SRGBColorSpace;
const bpSecurityPlane=new THREE.Mesh(new THREE.PlaneGeometry(1.98,1.2),new THREE.MeshBasicMaterial({map:bpSecurityTexture,side:THREE.DoubleSide}));
bpSecurityPlane.position.set(bpOfficeConsoleX,1.75,bpOfficeConsoleZ-.396);world.add(bpSecurityPlane);

const bpOfficeMonitorCanvas=document.createElement('canvas');
bpOfficeMonitorCanvas.width=lowQuality?512:768;
bpOfficeMonitorCanvas.height=lowQuality?288:432;
const bpOfficeMonitorContext=bpOfficeMonitorCanvas.getContext('2d');
const bpOfficeMonitorTexture=new THREE.CanvasTexture(bpOfficeMonitorCanvas);
bpOfficeMonitorTexture.colorSpace=THREE.SRGBColorSpace;
bpOfficeMonitorTexture.minFilter=THREE.LinearFilter;
box(25.75,3.52,-11.68,6.35,3.07,.12,darkMetal);
const bpOfficeMonitorPlane=new THREE.Mesh(
  new THREE.PlaneGeometry(6.04,2.77),
  new THREE.MeshBasicMaterial({map:bpOfficeMonitorTexture,toneMapped:false})
);
bpOfficeMonitorPlane.position.set(25.75,3.52,-11.597);
bpOfficeMonitorPlane.renderOrder=3;
world.add(bpOfficeMonitorPlane);
const bpOfficeStatusLeds=[
  ball(22.75,5.02,-11.53,.065,mint),
  ball(28.75,5.02,-11.53,.065,mint)
];

/* Four physical surveillance cameras render the live 3D scene into the
 * security-room CCTV wall. Render one camera at a time to protect low-end PCs.
 * The source is the current in-memory 3D world, not recorded video or an IP. */
const bpCctvModels=[
  {label:'CAM 01 / WEST HALL',at:[-41,5.55,-10],toward:[-32,1.6,2]},
  {label:'CAM 02 / CORE',at:[-13,5.55,-11.7],toward:[-12,1.6,5]},
  {label:'CAM 03 / EDGE',at:[11.2,5.55,-10],toward:[7,1.6,2.3]},
  {label:'CAM 04 / ACCESS',at:[-1,5.55,11.5],toward:[-9.5,1.7,1]},
];
const bpCctvFeeds=[],bpCctvPlanes=[],bpCctvTargets=[];
let bpCctvTick=0,bpCctvIndex=0;
const bpCctvMetal=mat('#34475a',{metal:.88,rough:.35});
box(19.4,3.55,-11.69,5.82,4.25,.14,darkMetal);
for(let i=0;i<bpCctvModels.length;i++){
  const spec=bpCctvModels[i];
  const [x,y,z]=spec.at;
  box(x,y,z,.56,.33,.82,bpCctvMetal);
  box(x,y-.21,z,.16,.27,.16,edgeMetal);
  const lens=ball(x,y,z+.39,.17,black);
  ball(x+.18,y+.13,z+.43,.045,red);
  const cam=new THREE.PerspectiveCamera(69,16/9,.1,110);
  cam.position.set(x,y,z);
  cam.lookAt(V(...spec.toward));
  cam.updateMatrixWorld();
  const target=new THREE.WebGLRenderTarget(lowQuality?256:448,lowQuality?144:252,{
    depthBuffer:true,stencilBuffer:false,
  });
  target.texture.colorSpace=THREE.SRGBColorSpace;
  target.texture.minFilter=THREE.LinearFilter;
  bpCctvTargets.push(target);
  const dx=i%2,dy=Math.floor(i/2),screenX=18.04+dx*2.73,screenY=4.48-dy*1.83;
  box(screenX,screenY,-11.575,2.57,1.61,.045,edgeMetal);
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(2.44,1.37),
    new THREE.MeshBasicMaterial({map:target.texture,toneMapped:false}));
  plane.position.set(screenX,screenY,-11.522);
  plane.renderOrder=3;
  world.add(plane);
  bpCctvPlanes.push(plane);
  label(spec.label,screenX,screenY+.79,-11.504,2.35,.17,0,'#e3ecf6');
  bpCctvFeeds.push({cam,target,lens});
}
function bpRenderCctv(dt){
  if(!game||game.ended||!world.visible||courtroom.visible||jail.visible)return;
  bpCctvTick+=dt;
  if(bpCctvTick<(lowQuality?.31:.055))return;
  bpCctvTick=0;
  const feed=bpCctvFeeds[bpCctvIndex++%bpCctvFeeds.length];
  const original=renderer.getRenderTarget();
  // Avoid feeding CCTV pictures back into themselves while rendering.
  for(const plane of bpCctvPlanes)plane.visible=false;
  try{
    renderer.setRenderTarget(feed.target);
    renderer.clear(true,true,true);
    renderer.render(scene,feed.cam);
  }finally{
    renderer.setRenderTarget(original);
    for(const plane of bpCctvPlanes)plane.visible=true;
  }
}

let bpOfficeMonitorTick=0;
function bpPaintOfficeMonitor(){
  const ctx=bpOfficeMonitorContext;
  if(!ctx)return;
  const g=game;
  const alert=Boolean(g&&!g.ended&&bpGuardEmergency(g));
  renderOfficeFeed(ctx,{
    traffic:g?.traffic??0,health:g?.health??100,proxies:g?.proxies??0,
    bytesPerRequest:g?.requestFeed?.averageBytesPerRequest,
    dispatchActive:Boolean(g?.securityDispatchActive),alert,
    history:bpWallHistory,
    requests:g?.requestFeed?.recent??[],
  });
  bpOfficeMonitorTexture.needsUpdate=true;
  for(const led of bpOfficeStatusLeds)led.material=alert?red:mint;
}


/* Main network operations wall. The timeline is generated from the in-game
   counters, not from a live server or any external endpoint. */
const bpWallCanvas=document.createElement('canvas');
bpWallCanvas.width=lowQuality?640:1024;
bpWallCanvas.height=lowQuality?360:576;
const bpWallContext=bpWallCanvas.getContext('2d');
const bpWallTexture=new THREE.CanvasTexture(bpWallCanvas);
bpWallTexture.colorSpace=THREE.SRGBColorSpace;
bpWallTexture.minFilter=THREE.LinearFilter;
const bpWallFrame=box(0,3.32,-13.876,9.62,3.55,.16,darkMetal);
bpWallFrame.castShadow=false;
const bpWallDisplay=new THREE.Mesh(
  new THREE.PlaneGeometry(9.15,3.25),
  new THREE.MeshBasicMaterial({map:bpWallTexture,side:THREE.DoubleSide,toneMapped:false})
);
bpWallDisplay.position.set(0,3.32,-13.774);
bpWallDisplay.renderOrder=2;world.add(bpWallDisplay);
for(const x of [-4.7,4.7])ball(x,1.48,-13.72,.055,mint,world);
const bpWallHistory=[];
let bpWallSampleTimer=0;
let bpWallPaintTimer=0;
function bpWallGraph(t){
  const ctx=bpWallContext;if(!ctx)return;
  const w=bpWallCanvas.width,h=bpWallCanvas.height;
  const sx=w/1024,sy=h/576;
  ctx.setTransform(sx,0,0,sy,0,0);
  ctx.fillStyle='#0b1424';ctx.fillRect(0,0,1024,576);
  ctx.fillStyle='#162237';ctx.fillRect(0,0,1024,86);
  ctx.fillStyle='#cdd6f4';ctx.font='bold 30px monospace';ctx.fillText('PICO  /  NETWORK OPERATIONS',35,47);
  ctx.font='16px monospace';ctx.fillStyle='#9eaac5';ctx.fillText('LIVE LOAD MONITOR  •  CORE CLUSTER',36,72);
  const g=game;
  const req=g?.traffic??0;
  const hp=g?.health??100;
  const redMode=g&&(hp<55||g.burst>0||g.attackerWave>0);
  ctx.fillStyle=redMode?'#f38ba8':'#a6e3a1';
  ctx.fillRect(933,26,17,17);
  ctx.font='bold 18px monospace';ctx.textAlign='right';
  ctx.fillText(redMode?'ALERT':'ONLINE',918,43);
  ctx.textAlign='left';
  ctx.fillStyle='#bac2de';ctx.font='18px monospace';
  const avgBytes=g?.requestFeed?.averageBytesPerRequest??DEFAULT_BYTES_PER_REQUEST;
  const bits=estimatedBitsPerSecond(req,avgBytes);
  ctx.fillText('ESTIMATED NETWORK THROUGHPUT',35,127);
  ctx.fillStyle='#f2f4ff';ctx.font='bold 42px monospace';
  ctx.fillText(formatBandwidth(bits),35,177);
  ctx.font='15px monospace';ctx.fillStyle='#8997b3';
  ctx.fillText(Math.round(req).toLocaleString('en-US')+' RPS  /  LAST 120 SECONDS',35,208);
  const plot={x:34,y:235,w:685,h:274};
  ctx.strokeStyle='#314057';ctx.lineWidth=1;
  for(let i=0;i<=5;i++){
    const y=plot.y+(i/5)*plot.h;
    ctx.beginPath();ctx.moveTo(plot.x,y);ctx.lineTo(plot.x+plot.w,y);ctx.stroke();
  }
  for(let i=0;i<=8;i++){
    const x=plot.x+(i/8)*plot.w;
    ctx.beginPath();ctx.moveTo(x,plot.y);ctx.lineTo(x,plot.y+plot.h);ctx.stroke();
  }
  const history=bpWallHistory.slice(-120);
  const scaleMax=Math.max(estimatedBitsPerSecond(18000,avgBytes),
    ...history.map(v=>(v.bitsPerSecond??estimatedBitsPerSecond(v.traffic,avgBytes))*1.12));
  ctx.strokeStyle='#e8c18c';ctx.setLineDash([8,8]);ctx.lineWidth=2;
  const baseline=plot.y+plot.h-(estimatedBitsPerSecond(9000,avgBytes)/scaleMax)*plot.h;
  ctx.beginPath();ctx.moveTo(plot.x,baseline);ctx.lineTo(plot.x+plot.w,baseline);ctx.stroke();ctx.setLineDash([]);
  const gradient=ctx.createLinearGradient(0,plot.y,0,plot.y+plot.h);
  gradient.addColorStop(0,'#cba6f74f');gradient.addColorStop(1,'#cba6f700');
  ctx.lineJoin='round';ctx.lineCap='round';
  if(history.length>1){
    ctx.beginPath();
    history.forEach((v,i)=>{
      const x=plot.x+(i/119)*plot.w;
      const y=plot.y+plot.h-((v.bitsPerSecond??estimatedBitsPerSecond(v.traffic,avgBytes))/scaleMax)*plot.h;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    });
    const last=history[history.length-1],endX=plot.x+((history.length-1)/119)*plot.w;
    const endY=plot.y+plot.h-((last.bitsPerSecond??estimatedBitsPerSecond(last.traffic,avgBytes))/scaleMax)*plot.h;
    ctx.lineTo(endX,plot.y+plot.h);ctx.lineTo(plot.x,plot.y+plot.h);
    ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
    ctx.beginPath();
    history.forEach((v,i)=>{
      const x=plot.x+(i/119)*plot.w;
      const y=plot.y+plot.h-((v.bitsPerSecond??estimatedBitsPerSecond(v.traffic,avgBytes))/scaleMax)*plot.h;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    });
    ctx.strokeStyle=redMode?'#f38ba8':'#cba6f7';ctx.lineWidth=4;ctx.stroke();
    ctx.fillStyle=redMode?'#f38ba8':'#cba6f7';ctx.beginPath();ctx.arc(endX,endY,6,0,Math.PI*2);ctx.fill();
  } else {
    ctx.fillStyle='#626b86';ctx.font='18px monospace';ctx.fillText('AWAITING TRAFFIC DATA',plot.x+135,plot.y+138);
  }
  ctx.fillStyle='#9eaac5';ctx.font='14px monospace';
  ctx.fillText('02:00 AGO',plot.x,544);ctx.fillText('NOW',plot.x+648,544);
  const px=752;
  ctx.fillStyle='#19243a';ctx.fillRect(px,102,241,443);
  ctx.strokeStyle='#34425e';ctx.strokeRect(px+.5,102.5,240,442);
  const drawMetric=(label,value,y,color)=>{
    ctx.fillStyle='#9daac3';ctx.font='17px monospace';ctx.fillText(label,px+18,y);
    ctx.fillStyle=color;ctx.font='bold 36px monospace';ctx.fillText(String(value),px+18,y+43);
    ctx.fillStyle='#334259';ctx.fillRect(px+18,y+56,205,2);
  };
  drawMetric('SERVER HEALTH',Math.round(hp)+'%',132,hp<50?'#f38ba8':'#a6e3a1');
  drawMetric('COOLING FAN RPM',Math.round(bpSmoothedRpm).toLocaleString('en-US'),210,'#89b4fa');
  drawMetric('EDGE PROXIES',g?.proxies??0,288,'#cba6f7');
  ctx.fillStyle='#bac2de';ctx.font='bold 17px monospace';ctx.fillText('RECENT REQUESTS',px+18,365);
  const latest=(g?.requestFeed?.recent??[]).slice(-3).reverse();
  if(!latest.length){ctx.fillStyle='#7d89a4';ctx.font='15px monospace';ctx.fillText('No requests yet',px+18,403);}
  for(let i=0;i<latest.length;i++){
    const entry=latest[i],y=389+i*48;
    ctx.fillStyle=entry.status>=500?'#f38ba8':entry.status===429?'#f9e2af':'#a6e3a1';
    ctx.font='bold 15px monospace';ctx.fillText('#'+entry.id+'  '+entry.status,px+18,y);
    ctx.fillStyle='#a6adc8';ctx.font='14px monospace';
    ctx.fillText(entry.method+' '+entry.path.slice(0,17),px+18,y+17);
  }
  bpWallTexture.needsUpdate=true;
}

let bpMonitorTick=0;
function bpDrawStandbyScreen(ctx,texture){
  if(!ctx)return;
  ctx.setTransform(1,0,0,1,0,0);
  const w=ctx.canvas.width,h=ctx.canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#111324';ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#cba6f7';ctx.fillRect(0,0,w,7);
  ctx.fillStyle='#dce2f7';ctx.font='bold 44px sans-serif';
  ctx.fillText('Pico.',45,Math.min(h*.31,180));
  ctx.font='22px sans-serif';ctx.fillStyle='#aeb7cf';
  ctx.fillText('Select a mission to begin',45,Math.min(h*.43,250));
  texture.needsUpdate=true;
}

let bpAttackLaptopCarried=false;
function bpResetLaptop(){
  bpLaptopRig.visible=true;
  bpLaptopRig.position.copy(bpLaptopDock);
  bpLaptopRig.rotation.y=0;
  bpLaptopRig.rotation.z=0;
  bpCable.visible=true;
  bpCableLight.material=mint;
  bpAttackLaptopCarried=false;
}
function bpSetLaptopCarrier(position,heading,dt=1){
  // Put the carried laptop beside and behind the actor, never directly in
  // the sight line. First-person attackers do not render their own carried
  // geometry, avoiding clipping even when walking backward into a rack.
  const right=1.12,behind=.77;
  const dx=Math.cos(heading)*right+Math.sin(heading)*behind;
  const dz=-Math.sin(heading)*right+Math.cos(heading)*behind;
  const goal=V(position.x+dx,.88,position.z+dz);
  bpLaptopRig.position.lerp(goal,Math.min(1,dt*15));
  const yawDelta=Math.atan2(Math.sin(heading-bpLaptopRig.rotation.y),Math.cos(heading-bpLaptopRig.rotation.y));
  bpLaptopRig.rotation.y+=yawDelta*Math.min(1,dt*12);
  bpLaptopRig.visible=!(game?.mode==='attack'&&bpAttackLaptopCarried&&!bp.third);
  bpCable.visible=false;
}
function bpToggleAttackLaptop(){
  if(!game||game.ended||game.mode!=='attack')return;
  if(bp.terminal)bpCloseTerminal();
  if(!bpAttackLaptopCarried&&bpDistance(bp.player,bpAttackerDesk)>3.2){
    notify('GET CLOSER TO THE LAPTOP');return;
  }
  if(bpAttackLaptopCarried){
    if(bpDistance(bp.player,bpAttackerDesk)>3.2){
      notify('RETURN TO THE SERVER RACK TO RECONNECT');return;
    }
    bpResetLaptop();sfx.tap();notify('LAPTOP RECONNECTED TO SERVER');
  }else{
    bpAttackLaptopCarried=true;bpCable.visible=false;
    bpLaptopRig.visible=bp.third;
    sfx.scan();notify('LAPTOP UNPLUGGED / KEEP MOVING');
  }
}

const bpTerminalAttackEye=V(-8.5,1.82,3.92);
const bpTerminalDefenseEye=V(bpOfficeConsoleX,1.76,bpOfficeConsoleZ+1.05);
const bpTerminalRaycaster=new THREE.Raycaster();
const bpTerminalNdc=new THREE.Vector2();
let bpTerminalHover=-1;
function bpActiveTerminalDisplay(){
  const attack=game?.mode==='attack';
  return attack
    ? {mesh:bpDisplayPlane,ctx:bpDisplayContext,texture:bpDisplayTexture,canvas:bpDisplayCanvas}
    : {mesh:bpSecurityPlane,ctx:bpSecurityCtx,texture:bpSecurityTexture,canvas:bpSecurityCanvas};
}
function bpPaintTerminal(){
  if(!game||game.ended)return;
  const {ctx,texture}=bpActiveTerminalDisplay();if(!ctx)return;
  const actions=ACTIONS[game.mode].map(a=>{
    const cooldown=Math.max(0,game.cooldowns[a.id]||0);
    const blocked=a.id==='proxy'&&game.proxies>=6||a.id==='trace'&&game.trace<22||game.mode==='attack'&&bpAttackLaptopCarried;
    return {id:a.id,title:a.title,description:a.description,cooldown,available:!blocked&&cooldown===0&&!game.ended};
  });
  drawTerminalScreen(ctx,{
    mode:game.mode,actions,traffic:game.traffic,
    bytesPerRequest:game.requestFeed?.averageBytesPerRequest,
    health:game.health,proxies:game.proxies,
    progress:game.mode==='attack'?game.risk:game.trace,
    elapsed:game.elapsed,hovered:bpTerminalHover,
    focused:bp.terminal,connected:game.mode!=='attack'||!bpAttackLaptopCarried,
  });
  texture.needsUpdate=true;
}
function bpCanUseTerminal(){
  if(!bp.active||!game||game.ended)return false;
  if(game.mode==='attack'&&bpAttackLaptopCarried)return false;
  const desk=game.mode==='attack'?bpAttackerDesk:bpDefenseDesk;
  return bp.terminal||bpDistance(bp.player,desk)<3.9;
}
function bpTerminalActionAt(x,y){
  if(!bpCanUseTerminal())return -1;
  const bounds=renderer.domElement.getBoundingClientRect();
  if(bounds.width<=0||bounds.height<=0)return -1;
  const locked=document.pointerLockElement===renderer.domElement&&!bp.terminal;
  const px=locked?bounds.left+bounds.width/2:x;
  const py=locked?bounds.top+bounds.height/2:y;
  bpTerminalNdc.set((px-bounds.left)/bounds.width*2-1,-((py-bounds.top)/bounds.height*2-1));
  camera.updateMatrixWorld();
  bpTerminalRaycaster.setFromCamera(bpTerminalNdc,camera);
  const {mesh,canvas}=bpActiveTerminalDisplay();
  mesh.updateWorldMatrix(true,false);
  const hit=bpTerminalRaycaster.intersectObject(mesh,false)[0];
  // Never activate a distant screen through racks or other room geometry.
  if(!hit?.uv||(!bp.terminal&&hit.distance>4.8))return -1;
  return terminalHitTest(hit.uv.x*canvas.width,(1-hit.uv.y)*canvas.height,
    canvas.width,canvas.height,ACTIONS[game.mode].length);
}
function bpTerminalSelect(index){
  if(!bpCanUseTerminal())return;
  const action=ACTIONS[game.mode][index];if(!action)return;
  const disabled=game.cooldowns[action.id]>0||
    action.id==='proxy'&&game.proxies>=6||
    action.id==='trace'&&game.trace<22;
  if(disabled){sfx.tap();return;}
  act(action.id);
  bpPaintTerminal();
}
renderer.domElement.addEventListener('pointermove',e=>{
  if(!bpCanUseTerminal())return;
  const hovered=bpTerminalActionAt(e.clientX,e.clientY);
  if(document.pointerLockElement!==renderer.domElement)
    renderer.domElement.style.cursor=hovered>=0?'pointer':'crosshair';
  if(hovered!==bpTerminalHover){bpTerminalHover=hovered;bpPaintTerminal();}
});

const bpOriginalCamera=moveCamera;
moveCamera=function(dt){
  if(!bp.active || !game || game.ended){
    bpOriginalCamera(dt);return;
  }
  if(bp.terminal){
    const attack=game.mode==='attack';
    camera.position.copy(attack?bpTerminalAttackEye:bpTerminalDefenseEye);
    camera.lookAt(attack?bpDisplayPlane.getWorldPosition(new THREE.Vector3()):bpSecurityPlane.position);
    return;
  }
  const eyeHeight=bp.crouching?1.15:1.74;
  if(bp.third){
    const behind=V(Math.sin(bp.yaw)*3.5,2.15,Math.cos(bp.yaw)*3.5);
    camera.position.copy(bp.player).add(behind);
    camera.lookAt(bp.player.x-Math.sin(bp.yaw)*4,eyeHeight+bp.pitch*2,bp.player.z-Math.cos(bp.yaw)*4);
  } else {
    camera.position.set(bp.player.x,eyeHeight,bp.player.z);
    camera.rotation.order='YXZ';
    camera.rotation.set(bp.pitch,bp.yaw,0);
  }
};
const bpOriginalStartGame=startGame;
startGame=function(mode){
  bpOriginalStartGame(mode);
  document.body.classList.remove('bp-mission-finished');
  bp.active=true;bp.terminal=false;bp.third=false;
  bp.yaw=mode==='attack'?.24:0;bp.pitch=-.06;
  bp.player.copy(mode==='attack'?V(-8.3,0,6.15):V(23.0,0,-3.55));
  view.drag=false;
  bp.keys.clear();bp.dragging=false;
  bp.stepClock=0;bp.npcHiding=false;bp.npcTyping=true;
  bpHackerState='working';bpHackerStateTime=0;bpHackerHoldUntil=0;bpHackerPackUntil=0;bpHackerSafeSince=-1;attacker.scale.y=1;
  bpHackerRoute=[];bpHackerRouteIndex=0;bpHackerCoverDestination=null;bpHackerRepathAt=0;
  bpHackerTargetProxy=-1;bpHackerSabotageUntil=0;bpHackerSortieCount=0;bpHackerSortieVisited.clear();
  for(const p of patrols){p.index=0;p.state='idle';p.path=[];p.wait=0;p.lastSeen=null;p.agent.position.set(p.home[0],0,p.home[1]);p.repathAt=0;p.chaseUntil=0;p.stalledFor=0;p.evidenceId=null;}
  bpWallHistory.length=0;bpWallSampleTimer=0;bpWallPaintTimer=0;
  bpResetLaptop();
  attacker.visible=mode==='defend';attacker.position.set(-8.5,0,4.18);attacker.rotation.y=Math.PI;
  security.position.set(patrols[0].home[0],0,patrols[0].home[1]);
  bpPlayerAvatar.visible=false;
  document.body.classList.remove('terminal-open');
  $('interaction-hint').classList.remove('visible');
  $('red-alert').classList.remove('visible');
  $('mission-step').textContent=mode==='attack'
    ? 'Click the laptop screen controls, or aim and press 1–4. Press F to take the laptop when escaping.'
    : 'Click the security console controls, or aim and press 1–4. Investigate the server hall with your guards.';
  $('control-help').style.display='block';
  updateUI(true);
};
const bpOriginalMenu=menu;
menu=function(){
  bpCloseTerminal();bp.active=false;bp.keys.clear();
  document.body.classList.remove('bp-mission-finished');
  if(document.pointerLockElement===renderer.domElement)void document.exitPointerLock?.();
  bpOriginalMenu();
  attacker.visible=true;attacker.position.set(-8.8,0,4.5);
  bpPlayerAvatar.visible=false;
  $('interaction-hint').classList.remove('visible');
  $('red-alert').classList.remove('visible');
};
function bpOpenTerminal(){
  if(!game||game.ended)return;
  bp.terminal=true;bpTerminalHover=-1;
  camera.fov=game.mode==='attack'?56:60;
  camera.updateProjectionMatrix();
  document.body.classList.add('terminal-open');
  if(document.pointerLockElement===renderer.domElement)void document.exitPointerLock?.();
  bp.dragging=false;view.drag=false;
  $('panelname').textContent=game.mode==='attack'?'LAPTOP / LOCAL TRAFFIC SIM':'SECURITY CONSOLE / INCIDENT RESPONSE';
  $('panelmeta').textContent='PRESS ESC TO RETURN TO THE ROOM';
  $('interaction-hint').classList.remove('visible');
  $('control-help').innerHTML='<kbd>1–4</kbd> Select action  ·  <kbd>ESC</kbd> Leave laptop';
  bpPaintTerminal();
  sfx.keyboard();
}
function bpCloseTerminal(){
  if(!bp.terminal)return false;
  bp.terminal=false;bpTerminalHover=-1;
  camera.fov=84;
  camera.updateProjectionMatrix();
  document.body.classList.remove('terminal-open');
  $('control-help').innerHTML='<kbd>W A S D</kbd> Move · <kbd>SHIFT</kbd> Sprint<br><kbd>CLICK / 1–4</kbd> Screen actions · <kbd>E</kbd> Zoom<br><kbd>F</kbd> Take laptop · <kbd>C</kbd> Crouch · <kbd>V</kbd> Camera';
  renderer.domElement.style.cursor='crosshair';
  sfx.tap();
  return true;
}
$('terminal-close').addEventListener('click',()=>bpCloseTerminal());
$('terminal-backdrop').addEventListener('click',()=>bpCloseTerminal());
window.__bpEscape=()=>{
  if(bpCloseTerminal())return true;
  if(document.pointerLockElement===renderer.domElement){void document.exitPointerLock?.();return true;}
  return false;
};
window.__bpIsFPS=()=>Boolean(bp.active);
function bpNearbyProxy(position,range=2.55,poweredOnly=false){
  const list=proxyObjects.map((proxy,index)=>({
    index,distance:bpDistance(position,proxy.position),powered:proxy.userData.powered,
  })).filter(v=>v.distance<range&&(!poweredOnly||v.powered));
  list.sort((a,b)=>a.distance-b.distance);
  return list[0]?.index??-1;
}
const bpOriginalAct=act;
act=function(id){
  if(!bpCanUseTerminal()){notify('GET CLOSER TO YOUR WORKSTATION');return;}
  if(id==='arrest'){notify('LEAVE THE CONSOLE AND LOCATE THE SUSPECT');return;}
  bpOriginalAct(id);
};
function bpTryInteract(){
  if(!game || game.ended)return;
  if(bp.terminal){bpCloseTerminal();return;}
  const desk=game.mode==='attack'?bpAttackerDesk:bpDefenseDesk;
  const proxyIndex=bpNearbyProxy(bp.player,2.6);
  if(proxyIndex>=0){
    const proxy=proxyObjects[proxyIndex];
    if(game.mode==='attack'){
      if(!proxy.userData.powered){notify('PROXY ALREADY OFFLINE');return;}
      if(game.proxySabotage?.index===proxyIndex)return;
      game.proxySabotage={index:proxyIndex,until:game.elapsed+2.2};
      sfx.scan();notify('DISCONNECTING EDGE PROXY / STAY CLOSE');
      return;
    }
    if(game.mode==='defend'&&!proxy.userData.powered){
      if(bpPowerProxy(proxyIndex)){
        game.proxyOrders=Math.max(0,(game.proxyOrders||0)-1);
        log('Edge cabinet '+(proxyIndex+1)+' powered on manually.','good');
      }
      return;
    }
  }
  if(game.mode==='defend'&&game.coolingEventUntil>game.elapsed&&bpDistance(bp.player,bpCoolingStation)<2.4){
    game.coolingEventUntil=0;game.coolingNeedsRepair=false;
    game.health=Math.min(100,game.health+13);bpCoolingIndicator.material=mint;
    bpShowIncident('COOLING STABILIZED / RACK TEMPERATURE NORMAL');
    log('Manual cooling reset completed.','good');
    sfx.deploy();return;
  }
  if(game.mode==='attack'&&bpAttackLaptopCarried){
    notify('PRESS F NEAR THE SERVER RACK TO RECONNECT THE LAPTOP');return;
  }
  if(game.mode==='defend'&&bpDistance(bp.player,attacker.position)<2.65){
    if(game.trace>=100){
      log('The suspect was detained with the laptop.','good');
      bpOriginalAct('arrest');
      return;
    }
    notify('SUSPECT SEEN / BUILD EVIDENCE BEFORE ARREST');
    if(!game.nextObservation||game.elapsed>game.nextObservation){
      game.trace=Math.min(100,game.trace+5);
      game.nextObservation=game.elapsed+5;sfx.scan();
    }
    return;
  }
  if(bpDistance(bp.player,desk)<3.15){bpOpenTerminal();return;}
  notify('MOVE CLOSER TO A CONSOLE OR SUSPECT');
}
const bpReservedKeys=new Set(['KeyW','KeyA','KeyS','KeyD','KeyC','KeyV','KeyE','KeyF','ShiftLeft','ShiftRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Digit1','Digit2','Digit3','Digit4']);
document.addEventListener('keydown',e=>{
  if(!bp.active || !game || game.ended)return;
  if(bpReservedKeys.has(e.code))e.preventDefault();
  bp.keys.add(e.code);
  if(e.repeat)return;
  if(/^Digit[1-4]$/.test(e.code)){
    const box=renderer.domElement.getBoundingClientRect();
    if(bpCanUseTerminal()&&(bp.terminal||
       bpTerminalActionAt(box.left+box.width/2,box.top+box.height/2)>=0))
      bpTerminalSelect(Number(e.code.slice(-1))-1);
    return;
  }
  if(e.code==='KeyF'&&game.mode==='attack'){bpToggleAttackLaptop();return;}
  if(e.code==='KeyE')bpTryInteract();
  if(e.code==='KeyV'&&!bp.terminal){bp.third=!bp.third;sfx.tap();notify(bp.third?'SHOULDER CAMERA':'FIRST-PERSON CAMERA');}
});
document.addEventListener('keyup',e=>{bp.keys.delete(e.code);});
window.addEventListener('blur',()=>{bp.keys.clear();bp.dragging=false;});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===renderer.domElement)bp.dragging=false;});
renderer.domElement.addEventListener('pointerdown',e=>{
  if(!bp.active||bp.terminal||e.button!==0||document.pointerLockElement===renderer.domElement)return;
  bp.dragging=true;bp.dragX=e.clientX;bp.dragY=e.clientY;
});
renderer.domElement.addEventListener('pointermove',e=>{
  if(!bp.active||!bp.dragging||bp.terminal||document.pointerLockElement===renderer.domElement)return;
  bp.yaw-=bpClamp(e.clientX-bp.dragX,-90,90)*.004;
  bp.pitch=bpClamp(bp.pitch-bpClamp(e.clientY-bp.dragY,-90,90)*.003,-1.3,1.3);
  bp.dragX=e.clientX;bp.dragY=e.clientY;
});
renderer.domElement.addEventListener('pointerup',()=>{bp.dragging=false;});
renderer.domElement.addEventListener('pointercancel',()=>{bp.dragging=false;});
document.addEventListener('mousemove',e=>{
  if(!bp.active || bp.terminal || document.pointerLockElement!==renderer.domElement)return;
  bp.yaw-=bpClamp(e.movementX,-110,110)*.0023;
  bp.pitch=bpClamp(bp.pitch-bpClamp(e.movementY,-110,110)*.0019,-1.3,1.3);
});
renderer.domElement.addEventListener('click',event=>{
  if(!bp.active||!game||game.ended)return;
  const index=bpTerminalActionAt(event.clientX,event.clientY);
  if(index>=0){bpTerminalSelect(index);return;}
  if(!bp.terminal&&document.pointerLockElement!==renderer.domElement)
    void renderer.domElement.requestPointerLock?.();
});
function bpWalkable(x,z){
  if(x < -44.2 || x > 31.1 || z < -12.8 || z > 12.8)return false;
  if(x>14.2&&x<15.1&&!(z>-1.0&&z<1.7))return false;
  if(x>15.1&&(z < -11.4 || z > 11.4))return false;
  for(const [rx,rz] of rackCoords)
    if(Math.abs(x-rx)<1.26 && Math.abs(z-rz)<1.38)return false;
  if(x>-11.55 && x<-7.55 && z>1.55 && z<3.80)return false;
  if(x>21.7&&x<24.62&&z>-8.85&&z<-7.47)return false;
  for(const [ox,oz] of [[20.5,-7],[26.8,-7],[20.5,6],[27.1,6]])
    if(x>ox-1.3&&x<ox+1.3&&z>oz-.72&&z<oz+.72)return false;
  return true;
}
function bpGuardWalkable(x,z){
  // Guards need clearance for their shoulders, not only a collision-free center.
  return bpWalkable(x,z)&&bpWalkable(x+.22,z)&&bpWalkable(x-.22,z)&&
    bpWalkable(x,z+.22)&&bpWalkable(x,z-.22);
}
function bpMovePlayer(dt){
  if(bp.terminal || !game || game.ended)return;
  const x=(bp.keys.has('KeyD')?1:0)-(bp.keys.has('KeyA')?1:0);
  const z=(bp.keys.has('KeyS')?1:0)-(bp.keys.has('KeyW')?1:0);
  bp.crouching=bp.keys.has('KeyC');
  if(bp.keys.has('ArrowLeft'))bp.yaw+=dt*1.45;
  if(bp.keys.has('ArrowRight'))bp.yaw-=dt*1.45;
  if(bp.keys.has('ArrowUp'))bp.pitch=bpClamp(bp.pitch+dt*.95,-1.05,1.05);
  if(bp.keys.has('ArrowDown'))bp.pitch=bpClamp(bp.pitch-dt*.95,-1.05,1.05);
  if(!x&&!z)return;
  const wantsSprint=bp.keys.has('ShiftLeft')||bp.keys.has('ShiftRight');
  const sprintAllowed=game.mode!=='attack'||bpAttackLaptopCarried||!game.securityDispatchActive;
  const speed=(bp.crouching?2.0:wantsSprint&&sprintAllowed?5.9:3.6)*Math.min(1,1/Math.hypot(x,z));
  const dx=(Math.cos(bp.yaw)*x+Math.sin(bp.yaw)*z)*speed*dt;
  const dz=(-Math.sin(bp.yaw)*x+Math.cos(bp.yaw)*z)*speed*dt;
  if(bpWalkable(bp.player.x+dx,bp.player.z))bp.player.x+=dx;
  if(bpWalkable(bp.player.x,bp.player.z+dz))bp.player.z+=dz;
  bp.stepClock+=dt;
  if(bp.stepClock>(bp.crouching?.65:.39)){
    bp.stepClock=0;
    sfx.noise(bp.crouching?.035:.06,bp.crouching?.012:.025,380);
  }
  const avatar=game.mode==='attack'?attacker:bpPlayerAvatar;
  avatar.position.set(bp.player.x,0,bp.player.z);
  avatar.rotation.y=bp.yaw+Math.PI;
  avatar.visible=bp.third;
}

/* Security guards follow separate patrol routes and inspect the aisles. */

/* Guards patrol independently and move to distinct response stations when traffic surges. */

/* Guard office: crews remain inside until a genuine alarm or dispatch order.
   Dispatches end with a physical return to base. No teleporting NPCs. */
const patrols=[
  {agent:security,role:'proxy',home:[21.2,-.6],index:0,speed:1.70,state:'idle',path:[],wait:0,proxyIndex:-1},
  {agent:character(23.4,4.1,'guard'),role:'search',home:[23.4,4.1],index:0,speed:1.58,state:'idle',path:[],wait:0,proxyIndex:-1,approachIndex:0},
  {agent:character(25.8,-4.5,'guard'),role:'search',home:[25.8,-4.5],index:0,speed:1.52,state:'idle',path:[],wait:0,proxyIndex:-1,approachIndex:1},
  {agent:character(19.0,-1.8,'guard'),role:'forensic',home:[19.0,-1.8],index:0,speed:1.50,state:'idle',path:[],wait:0,proxyIndex:-1,evidenceId:null},
  {agent:character(27.4,2.9,'guard'),role:'forensic',home:[27.4,2.9],index:0,speed:1.50,state:'idle',path:[],wait:0,proxyIndex:-1,evidenceId:null},
];
const bpGuards=patrols.map(p=>p.agent);
for(const p of patrols){
  p.agent.position.set(p.home[0],0,p.home[1]);
  const guard=p.agent;
  const badge=mat('#c5bbd3',{metal:.45,rough:.3});
  const uniform=mat('#304960',{metal:.1,rough:.78});
  box(0,1.38,.585,.28,.16,.055,badge,guard);
  box(-.16,1.76,.47,.19,.075,.045,uniform,guard);
  box(.36,1.65,.22,.14,.25,.21,black,guard);
  box(-.40,1.65,.24,.16,.22,.22,uniform,guard);
  box(-.31,.28,.33,.09,.31,.08,uniform,guard);
  box(.31,.28,.33,.09,.31,.08,uniform,guard);
}
const bpWorkPosition=V(-8.5,0,4.18);
const bpHackerCover={minX:-19.24,maxX:-16.71,minZ:6.7,maxZ:9.37};
let bpHackerState='working',bpHackerHoldUntil=0,bpHackerStateTime=0,bpHackerPackUntil=0,bpHackerSafeSince=-1;
let bpHackerTargetProxy=-1,bpHackerSabotageUntil=0,bpHackerSortieCount=0,bpHackerSortieVisited=new Set();
let bpHackerRoute=[],bpHackerRouteIndex=0,bpHackerCoverDestination=null,bpHackerRepathAt=0;
/* Search points are generated from the floor plan. All movement routes
   are resolved through the collision grid instead of scripted corridors. */
function bpRandom(g){
  g.patrolSeed=(Math.imul((g.patrolSeed||0x5abc9de3),1664525)+1013904223)>>>0;
  return g.patrolSeed/4294967296;
}
function bpRandomSearchTarget(g){
  for(let attempt=0;attempt<35;attempt++){
    const x=-42+bpRandom(g)*54,z=-10.8+bpRandom(g)*21.6;
    if(bpWalkable(x,z))return [x,z];
  }
  return [-4,9];
}
function bpGuardRoute(from,to){
  const target={x:to[0],z:to[1]};
  const result=routeTo({x:from.x,z:from.z},target,bpGuardWalkable);
  if(result.length)return result.map(p=>[p.x,p.z]);
  // Do not move directly through a server cabinet when no route exists.
  return bpGuardWalkable(target.x,target.z)&&
    Math.hypot(from.x-target.x,from.z-target.z)<.5
      ? [[target.x,target.z]] : [];
}
function bpGuardEmergency(g){
  return Boolean(g&&!g.ended&&(g.burst>0||g.attackerWave>0||g.traffic>12500||g.health<75||g.coolingEventUntil>g.elapsed));
}
function bpGuardCanSee(guard,position,distanceLimit=7){
  const distance=bpDistance(guard.position,position);
  if(distance>distanceLimit)return false;
  // Cabinets and the security office wall stop sight lines through solid geometry.
  for(const [rx,rz] of rackCoords){
    if(isSightBlocked(guard.position,position,{
      minX:rx-1.03,maxX:rx+1.03,minZ:rz-1.18,maxZ:rz+1.18,
    }))return false;
  }
  if(isSightBlocked(guard.position,position,bpHackerCover))return false;
  for(const side of [{minX:14.48,maxX:14.98,minZ:-14,maxZ:-1.0},
                     {minX:14.48,maxX:14.98,minZ:1.7,maxZ:14}]){
    if(isSightBlocked(guard.position,position,side))return false;
  }
  if(distance<2.25)return true;
  const dx=position.x-guard.position.x,dz=position.z-guard.position.z;
  const fx=Math.sin(guard.rotation.y),fz=Math.cos(guard.rotation.y);
  return (dx*fx+dz*fz)/Math.max(.1,distance)>.2;
}
function bpWalkGuard(p,target,dt,urgent=true){
  const oldX=p.agent.position.x,oldZ=p.agent.position.z;
  const others=patrols.filter(other=>other!==p).map(other=>other.agent.position);
  const movement=moveGuardWithAvoidance(
    {x:oldX,z:oldZ},{x:target[0],z:target[1]},others,bpGuardWalkable,
    p.speed*(urgent?(p.state==='chasing'&&game?.mode==='defend'&&game.trace>=100?3.3:2.44):1),dt
  );
  p.agent.position.set(movement.point.x,0,movement.point.z);
  if(movement.moved>.002){
    const angle=Math.atan2(movement.point.x-oldX,movement.point.z-oldZ);
    const delta=Math.atan2(Math.sin(angle-p.agent.rotation.y),Math.cos(angle-p.agent.rotation.y));
    p.agent.rotation.y+=delta*Math.min(1,dt*8);
  }
  return movement.arrived;
}
function bpRecoverGuard(p,g){
  // A patrol reroutes when crowding, a cabinet edge or a wall blocks progress.
  // If older geometry left the officer inside a collision volume, move only
  // the minimum necessary distance to the closest navigable floor position.
  if(!bpGuardWalkable(p.agent.position.x,p.agent.position.z)){
    let nearest=null,best=Infinity;
    for(let radius=.25;radius<=1.75;radius+=.25){
      for(let n=0;n<16;n++){
        const theta=n*Math.PI/8;
        const x=p.agent.position.x+Math.cos(theta)*radius;
        const z=p.agent.position.z+Math.sin(theta)*radius;
        if(bpGuardWalkable(x,z)&&radius<best){nearest={x,z};best=radius;}
      }
      if(nearest)break;
    }
    if(nearest)p.agent.position.set(nearest.x,0,nearest.z);
  }
  const destination=p.path[p.path.length-1]||p.home;
  let route=bpGuardRoute(p.agent.position,destination);
  if(!route.length&&(p.state==='searching'||p.state==='chasing'))
    route=bpGuardRoute(p.agent.position,bpRandomSearchTarget(g));
  if(route.length){
    p.path=route;p.index=0;
  }else if(p.state==='returning'&&bpDistance(p.agent,{x:p.home[0],z:p.home[1]})<1){
    p.agent.position.set(p.home[0],0,p.home[1]);p.state='idle';
  }else if(p.state==='searching'||p.state==='chasing'){
    p.state='returning';p.path=bpGuardRoute(p.agent.position,p.home);p.index=0;
  }
  p.stalledFor=0;
}
function bpDispatchForensicGuards(g){
  if(g.mode!=='defend'||g.ended||g.trace>=100||g.elapsed<g.nextEvidenceDispatch)return;
  g.nextEvidenceDispatch=g.elapsed+17;
  const reserved=new Set(patrols.map(p=>p.evidenceId).filter(Boolean));
  for(const p of patrols){
    if(p.role!=='forensic'||p.state!=='idle')continue;
    const station=selectGuardEvidence(EVIDENCE_STATIONS,g.collectedEvidence,reserved,
      p.agent.position,bpGuardWalkable);
    if(!station)continue;
    const path=bpGuardRoute(p.agent.position,[station.x,station.z]);
    if(!path.length)continue;
    p.evidenceId=station.id;reserved.add(station.id);
    p.state='investigating';p.path=path;p.index=0;p.wait=0;p.stalledFor=0;
    log('Security officer deployed to collect '+station.description+'.','good');
  }
}
function bpGuardSetReturn(p){
  p.state='returning';p.index=0;
  p.path=bpGuardRoute(p.agent.position,p.home);
  p.lastSeen=null;p.repathAt=0;
}
const bpSearchWindowSeconds=24;
const bpMaxChaseSeconds=8;
function bpAssignSecurityDispatch(g){
  acknowledgeSecurityDispatch(g);
  g.securityDispatchActive=true;
  g.securityResponseUntil=g.elapsed+bpSearchWindowSeconds;
  // A new attack wave restarts the response even if guards are returning.
  // Responders follow a new path from their current physical positions.
  g.guardResponseStarted=true;
  bpShowIncident('SECURITY ALERT / OFFICERS RESPONDING');
  sfx.alert();
  for(let i=0;i<patrols.length;i++){
    const p=patrols[i];
    if(p.role==='forensic')continue;
    p.index=0;p.wait=0;p.lastSeen=null;p.repathAt=0;p.chaseUntil=0;p.stalledFor=0;
    if(p.role==='proxy'&&g.coolingNeedsRepair&&g.coolingEventUntil>g.elapsed){
      p.proxyIndex=-1;p.path=bpGuardRoute(p.agent.position,[bpCoolingStation.x+.3,bpCoolingStation.z+.6]);
      p.state=p.path.length?'coolingTravel':'returning';
      if(!p.path.length)bpGuardSetReturn(p);
    }else if(p.role==='proxy'&&(g.proxyOrders||0)>0&&firstUnpoweredProxy(proxyObjects)>=0){
      p.proxyIndex=firstUnpoweredProxy(proxyObjects);
      const position=proxyObjects[p.proxyIndex].position;
      p.path=bpGuardRoute(p.agent.position,[position.x+.85,position.z+.66]);
      p.state=p.path.length?'deploying':'returning';
      if(!p.path.length)bpGuardSetReturn(p);
    }else{
      // On an attacker-triggered surge, the first sweep covers the wired
      // laptop's server rack. Search paths themselves remain obstacle-aware,
      // with randomized patrol targets after the first sweep.
      const firstSweep=g.mode==='attack'
        ? [bpAttackerDesk.x+(i===1?-2.1:2.0),
           bpAttackerDesk.z+(i===1?2.1:1.6)]
        : bpRandomSearchTarget(g);
      p.path=bpGuardRoute(p.agent.position,firstSweep);
      p.state='searching';
    }
  }
}
function bpMoveGuard(p,dt,g){
  if(p.state==='collecting'){
    p.wait-=dt;
    if(p.wait<=0){
      const station=EVIDENCE_STATIONS.find(v=>v.id===p.evidenceId);
      if(station&&collectGuardEvidence(g,station)){
        log('Officer secured '+station.description+' (+'+station.value+' evidence).','good');
        bpShowIncident('CASE EVIDENCE / '+Math.round(g.trace)+'% VERIFIED');
        sfx.scan();
        if(g.trace>=100&&!g.caseEvidenceComplete){
          g.caseEvidenceComplete=true;
          flagSecurityIncident(g);
          bpShowIncident('CASE VERIFIED / ARREST AUTHORIZED');
        }
      }
      p.evidenceId=null;bpGuardSetReturn(p);
    }
    return;
  }
  if(p.state==='detaining'){
    p.wait-=dt;
    if(p.wait<=0&&g.mode==='defend'&&g.trace>=100&&!g.ended){
      g.arrested=true;
      endGame(true,'SUSPECT DETAINED',
        'Security officers collected verified evidence, caught the attacker and transferred the suspect to court.');
    }
    return;
  }
  if(p.state==='idle'){
    const fx=p.home[0],fz=p.home[1];
    p.agent.position.x+=(fx-p.agent.position.x)*Math.min(1,dt*4);
    p.agent.position.z+=(fz-p.agent.position.z)*Math.min(1,dt*4);
    const monitorYaw=Math.atan2(25.75-p.agent.position.x,-11.6-p.agent.position.z);
    const angle=monitorYaw+Math.sin(g.elapsed*.38+p.agent.id)*.06;
    const diff=Math.atan2(Math.sin(angle-p.agent.rotation.y),Math.cos(angle-p.agent.rotation.y));
    p.agent.rotation.y+=diff*Math.min(1,dt*2.5);
    if(p.agent.children[5])p.agent.children[5].rotation.z=
      -.11+Math.sin(g.elapsed*.8+p.agent.id)*.12;
    return;
  }
  if(p.state==='coolingFix'){
    p.wait-=dt;
    const turn=Math.atan2(bpCoolingStation.x-p.agent.position.x,bpCoolingStation.z-p.agent.position.z);
    p.agent.rotation.y+=Math.atan2(Math.sin(turn-p.agent.rotation.y),Math.cos(turn-p.agent.rotation.y))*Math.min(1,dt*8);
    if(p.wait<=0){
      if(g.coolingNeedsRepair&&g.coolingEventUntil>g.elapsed){
        g.coolingNeedsRepair=false;
        g.coolingEventUntil=0;g.health=Math.min(100,g.health+11);
        bpCoolingIndicator.material=mint;sfx.deploy();
        bpShowIncident('COOLING RESTORED / OFFICER COMPLETED REPAIR');
        log('On-site technician restored the cooling panel.','good');
      }
      bpGuardSetReturn(p);
    }
    return;
  }
  if(p.state==='switching'){
    p.wait-=dt;
    const station=proxyObjects[p.proxyIndex];
    if(station){
      const targetAngle=Math.atan2(station.position.x-p.agent.position.x,station.position.z-p.agent.position.z);
      p.agent.rotation.y+=Math.atan2(Math.sin(targetAngle-p.agent.rotation.y),Math.cos(targetAngle-p.agent.rotation.y))*Math.min(1,dt*9);
    }
    if(p.wait<=0){
      if(station&&!station.userData.powered){
        if(g.elapsed<(station.userData.repairAt||0)){
          p.wait=Math.min(1,station.userData.repairAt-g.elapsed);
          return;
        }
        if(bpPowerProxy(p.proxyIndex)){
          g.proxyOrders=Math.max(0,(g.proxyOrders||0)-1);
          log('Officer restored edge proxy '+(p.proxyIndex+1)+'.','good');
        }
      }
      bpGuardSetReturn(p);
    }
    return;
  }

  // Hard cutoff prevents an endless chase when the player stays visible.
  // Once ordered back, a guard will not reacquire until the next dispatch.
  if((p.state==='searching'||p.state==='chasing')&&
      (g.elapsed>=g.securityResponseUntil||
       p.state==='chasing'&&g.elapsed>=(p.chaseUntil||0))){
    bpGuardSetReturn(p);
  }
  const suspect=g.mode==='attack'?bp.player:attacker.position;
  const isHunter=p.role==='search'&&(p.state==='searching'||p.state==='chasing');
  const seen=isHunter&&p.agent.position.x<14&&bpGuardCanSee(p.agent,suspect,13.2);
  if(seen){
    p.lastSeen={x:suspect.x,z:suspect.z,until:g.elapsed+5.5};
    if(p.state!=='chasing'){
      p.state='chasing';p.repathAt=0;
      p.chaseUntil=Math.min(g.securityResponseUntil,g.elapsed+bpMaxChaseSeconds);
      sfx.alert();bpShowIncident('SECURITY / INTRUDER LOCATED');
    }
    if(g.mode==='defend')g.suspectSpotted=true;
  }
  if(isHunter&&p.state==='chasing'){
    if(p.lastSeen&&g.elapsed<=p.lastSeen.until){
      if(g.elapsed>=(p.repathAt||0)){
        // Recalculate toward the last observed location, so turns and
        // changing player routes cause credible pursuit around server racks.
        let destination=[p.lastSeen.x,p.lastSeen.z];
        if(g.mode==='defend'){
          // Each responding officer has a different approach angle, avoiding
          // the two officers stacking on the same suspected intruder position.
          const slot=formationPosition(p.lastSeen,attacker.rotation.y,p.approachIndex??0,g.trace>=100?1.35:2.35);
          if(bpWalkable(slot.x,slot.z))destination=[slot.x,slot.z];
        }
        p.path=bpGuardRoute(p.agent.position,destination);
        p.index=0;p.repathAt=g.elapsed+(lowQuality?1.3:.75);
      }
      if(g.mode==='attack'&&bpDistance(p.agent,bp.player)<1.72&&
          bpGuardCanSee(p.agent,bp.player,2.2)){
        endGame(false,'CAUGHT BY SECURITY','Security caught you during the server-room search.');
        return;
      }
      if(g.mode==='defend'&&g.trace>=100&&
          bpDistance(p.agent,attacker.position)<2.15&&
          bpGuardCanSee(p.agent,attacker.position,2.5)){
        p.state='detaining';p.wait=1.65;
        g.suspectHeld=true;g.suspectHoldGuard=p.agent;
        bpShowIncident('SECURITY / SUSPECT IN CUSTODY');
        sfx.metal();return;
      }
    }else{
      p.state='searching';p.lastSeen=null;p.index=0;
      p.path=bpGuardRoute(p.agent.position,bpRandomSearchTarget(g));
    }
  }
  if(p.state==='searching'&&p.index>=p.path.length){
    // Pick a new location instead of repeating identical patrol paths.
    p.path=bpGuardRoute(p.agent.position,bpRandomSearchTarget(g));
    p.index=0;
  }
  const destination=p.path[p.index];
  if(!destination){
    if(p.state==='deploying'){p.state='switching';p.wait=2.1;sfx.scan();}
    else if(p.state==='coolingTravel'){p.state='coolingFix';p.wait=2.9;sfx.scan();}
    else if(p.state==='investigating'){p.state='collecting';p.wait=2.7;sfx.scan();}
    else if(p.state==='returning'){p.state='idle';p.agent.position.set(p.home[0],0,p.home[1]);}
    else if(p.state==='searching'){p.path=bpGuardRoute(p.agent.position,bpRandomSearchTarget(g));p.index=0;}
    return;
  }
  const beforeX=p.agent.position.x,beforeZ=p.agent.position.z;
  const arrived=bpWalkGuard(p,destination,dt,p.state!=='returning');
  const moved=Math.hypot(p.agent.position.x-beforeX,p.agent.position.z-beforeZ);
  if(arrived){p.index++;p.stalledFor=0;}
  else if(moved<Math.min(.022,p.speed*dt*.18)){
    p.stalledFor=(p.stalledFor||0)+dt;
    if(p.stalledFor>1.15)bpRecoverGuard(p,g);
  }else p.stalledFor=0;
  const motion=g.elapsed*13+p.agent.id*.25;
  p.agent.position.y=Math.sin(motion)*.027;
  if(p.agent.children[5])p.agent.children[5].rotation.z=-.27+Math.sin(motion)*.21;
  if(p.agent.children[6])p.agent.children[6].rotation.z=.18+Math.sin(motion+2)*.16;
}

function bpHackerThreats(){
  const guards=patrols.filter(p=>p.state!=='idle'&&p.agent.position.x<14)
    .map(p=>({x:p.agent.position.x,z:p.agent.position.z}));
  if(game?.mode==='defend')guards.push({x:bp.player.x,z:bp.player.z});
  return guards;
}
function bpPlanHackerCover(g){
  const pursuers=bpHackerThreats();
  if(!pursuers.length)pursuers.push({x:23,z:0});
  const points=rankedCoverSpots(
    attacker.position,pursuers,rackCoords,bpWalkable,isSightBlocked,
    ()=>bpRandom(g),bpHackerCoverDestination
  );
  for(const point of points.slice(0,10)){
    const route=bpGuardRoute(attacker.position,[point.x,point.z]);
    if(!route.length)continue;
    const final=route[route.length-1];
    if(Math.hypot(final[0]-point.x,final[1]-point.z)>2)continue;
    bpHackerRoute=route;bpHackerRouteIndex=0;
    bpHackerCoverDestination=point;
    bpHackerRepathAt=g.elapsed+4;
    return true;
  }
  return false;
}
function bpFollowHackerRoute(dt,speed){
  const destination=bpHackerRoute[bpHackerRouteIndex];
  if(!destination)return true;
  const reached=bpMoveHackerTowards(V(destination[0],0,destination[1]),dt,speed);
  if(reached)bpHackerRouteIndex++;
  return bpHackerRouteIndex>=bpHackerRoute.length;
}
function bpPlanHackerReturn(){
  const route=bpGuardRoute(attacker.position,[bpWorkPosition.x,bpWorkPosition.z]);
  const last=route[route.length-1];
  // Never teleport to the old workstation when the path is blocked.
  if(!last||Math.hypot(last[0]-bpWorkPosition.x,last[1]-bpWorkPosition.z)>.75)return false;
  bpHackerRoute=route;
  bpHackerRouteIndex=0;
  return true;
}
function bpPlanHackerProxySabotage(g,continueSortie=false){
  if(g.mode!=='defend'||!g.proxies)return false;
  if(!continueSortie){bpHackerSortieCount=0;bpHackerSortieVisited.clear();}
  if(bpHackerSortieCount>=3)return false;
  const preferred=nearestPoweredProxy(proxyObjects,attacker.position);
  const indices=proxyObjects.map((_,i)=>i).sort((a,b)=>
    (a===preferred?-1000:bpDistance(attacker.position,proxyObjects[a].position))-
    (b===preferred?-1000:bpDistance(attacker.position,proxyObjects[b].position)));
  for(const i of indices){
    const proxy=proxyObjects[i];
    if(!proxy.userData.powered||bpHackerSortieVisited.has(i))continue;
    const p=proxy.position;
    const path=bpGuardRoute(attacker.position,[p.x+.8,p.z+.72]);
    if(!path.length)continue;
    const last=path[path.length-1];
    if(Math.hypot(last[0]-p.x,last[1]-p.z)>2)continue;
    bpHackerTargetProxy=i;
    bpHackerRoute=path;bpHackerRouteIndex=0;
    bpHackerSabotageUntil=0;
    if(!continueSortie)g.nextSabotageAt=g.elapsed+41+bpRandom(g)*12;
    bpHackerState='sabotaging';
    bpHackerStateTime=g.elapsed;
    bpShowIncident('SECURITY / SUSPICIOUS ACTIVITY NEAR EDGE CABINET');
    return true;
  }
  if(!continueSortie)g.nextSabotageAt=g.elapsed+12;
  return false;
}
function bpMoveHackerTowards(target,dt,speed=3.15){
  const dx=target.x-attacker.position.x,dz=target.z-attacker.position.z;
  const distance=Math.hypot(dx,dz);
  if(distance<.19)return true;
  const step=Math.min(distance,dt*speed);
  attacker.position.x+=dx/distance*step;
  attacker.position.z+=dz/distance*step;
  const goalYaw=Math.atan2(dx,dz);
  const diff=Math.atan2(Math.sin(goalYaw-attacker.rotation.y),Math.cos(goalYaw-attacker.rotation.y));
  attacker.rotation.y+=diff*Math.min(1,dt*8);
  return false;
}
function bpNpcUpdate(dt){
  if(!game||game.ended)return;
  const g=game;
  if(g.coolingNeedsRepair&&g.coolingEventUntil<=g.elapsed){
    g.coolingNeedsRepair=false;
    bpCoolingIndicator.material=mint;
  }
  const activeAlarm=bpGuardEmergency(g);
  observeSecurityAlarm(g,activeAlarm);
  // Cooling stays in quiet standby until security notices a sustained spike.
  const fanSurge=g.securityDispatchActive &&
    (g.burst>0||g.attackerWave>0||g.traffic>14000||g.health<65);
  g.fanLoad+=(Number(fanSurge)-g.fanLoad)*Math.min(1,dt*(fanSurge?.55:.3));
  // A second attack is a new incident even if the previous crew is still
  // walking back to security. Redirect that returning crew immediately.
  const respondersReturning=g.securityDispatchActive&&patrols
    .filter(p=>p.role!=='forensic').every(p=>p.state==='returning'||p.state==='idle');
  if(shouldDispatchSecurity(g,respondersReturning)){
    bpAssignSecurityDispatch(g);
  }
  bpDispatchForensicGuards(g);
  for(const p of patrols){
    bpMoveGuard(p,dt,g);
    if(g.ended)return;
  }
  if(g.securityDispatchActive&&patrols
     .filter(p=>p.role!=='forensic').every(p=>p.state==='idle')){
    securityOfficersReturned(g);
    g.securityResponseUntil=0;
    g.guardResponseStarted=false;
    bpShowIncident('SECURITY PATROL RETURNED / MONITORING RESUMED');
  }
  // Operators stay inside the actual security office until a threat calls guards out.
  technician.position.set(26+Math.sin(g.elapsed*.13)*.5,0,1.8+Math.sin(g.elapsed*.11)*1.1);
  technician.rotation.y=Math.PI;
  if(g.mode==='attack')return;
  if(g.trace>=100&&!g.caseEvidenceComplete){
    g.caseEvidenceComplete=true;
    flagSecurityIncident(g);
    bpShowIncident('CASE VERIFIED / SECURITY ARREST AUTHORIZED');
  }
  if(g.suspectHeld){attacker.position.y=0;return;}
  const guardsInHall=patrols.some(p=>p.state!=='idle'&&p.agent.position.x<14);
  const nearest=Math.min(...patrols.filter(p=>p.state!=='idle').map(p=>bpDistance(p.agent,attacker.position)),99);
  const visible=patrols.some(p=>(p.state==='searching'||p.state==='chasing')&&bpGuardCanSee(p.agent,attacker.position,13));
  const playerClose=bpDistance(bp.player,attacker.position)<7.2;
  const threatened=playerClose||guardsInHall&&(nearest<11||visible);

  if(bpHackerState==='working'&&!threatened&&g.elapsed>=g.nextSabotageAt&&g.proxies>0){
    bpPlanHackerProxySabotage(g);
  }
  if(bpHackerState==='working'&&threatened){
    bpHackerState='packing';
    bpHackerPackUntil=g.elapsed+.72;
    bpHackerStateTime=g.elapsed;
    bpShowIncident(playerClose?'SUSPECT ALERT / LAPTOP BEING REMOVED':'SECURITY CHECK / WEST AISLE');
    sfx.scan();
  }
  if(bpHackerState==='packing'&&g.elapsed>=bpHackerPackUntil){
    if(bpPlanHackerCover(g)){
      bpHackerState=chooseHackerPhase({
        phase:'working',guardVisible:visible,nearbyGuard:true,
        reachedWaypoint:false,now:g.elapsed,hidingUntil:bpHackerHoldUntil,
      });
    }else{
      bpHackerPackUntil=g.elapsed+1.5;
    }
  }
  if(bpHackerState==='sabotaging'){
    if(threatened){
      bpHackerTargetProxy=-1;bpHackerSabotageUntil=0;
      g.nextSabotageAt=Math.max(g.nextSabotageAt,g.elapsed+14);
      if(bpPlanHackerCover(g)){
        bpHackerState='escaping';bpHackerStateTime=g.elapsed;
      }else if(bpPlanHackerReturn()){
        bpHackerState='returning';
      }else{
        bpHackerState='hiding';bpHackerHoldUntil=g.elapsed+3;
      }
    }else if(bpHackerTargetProxy<0||!proxyObjects[bpHackerTargetProxy]?.userData.powered){
      if(bpPlanHackerReturn())bpHackerState='returning';
      else {bpHackerState='hiding';bpHackerHoldUntil=g.elapsed+3;}
    }else if(bpFollowHackerRoute(dt,3.0)){
      if(!bpHackerSabotageUntil)bpHackerSabotageUntil=g.elapsed+2.4;
      if(g.elapsed>=bpHackerSabotageUntil){
        const disabled=bpHackerTargetProxy;
        if(bpDisableProxy(disabled,'the hooded suspect')){
          bpHackerSortieCount++;
          bpHackerSortieVisited.add(disabled);
        }
        bpHackerTargetProxy=-1;bpHackerSabotageUntil=0;
        // A single Defense sortie can disable up to three distinct cabinets.
        // Each shutdown requires reaching its physical switch in the hall.
        const canContinue=bpHackerSortieCount<3&&!threatened&&
          bpPlanHackerProxySabotage(g,true);
        if(!canContinue){
          if(bpPlanHackerReturn())bpHackerState='returning';
          else {bpHackerState='hiding';bpHackerHoldUntil=g.elapsed+3;}
        }
      }
    }
  }else if(bpHackerState==='escaping'){
    const pursuers=bpHackerThreats();
    const close=pursuers.some(p=>bpDistance(p,attacker.position)<4.2);
    if(close&&g.elapsed>=bpHackerRepathAt)bpPlanHackerCover(g);
    if(bpFollowHackerRoute(dt,4.15)){
      bpHackerState=chooseHackerPhase({
        phase:'escaping',guardVisible:false,nearbyGuard:false,
        reachedWaypoint:true,now:g.elapsed,hidingUntil:0,
      });
      bpHackerHoldUntil=g.elapsed+3+bpRandom(g)*2;
      bpHackerSafeSince=-1;
      bpHackerStateTime=g.elapsed;
    }
  }else if(bpHackerState==='hiding'){
    const pursuers=bpHackerThreats();
    const guardPositions=patrols.filter(p=>p.state!=='idle'&&p.agent.position.x<14)
      .map(p=>({x:p.agent.position.x,z:p.agent.position.z}));
    const discovered=pursuers.some(p=>bpDistance(p,attacker.position)<4.6);
    const clear=hackerAreaIsClear(guardPositions,bp.player,attacker.position,bpWorkPosition);
    if(discovered&&g.elapsed>=bpHackerRepathAt&&bpPlanHackerCover(g)){
      bpHackerState='escaping';
      bpHackerSafeSince=-1;
      bpHackerStateTime=g.elapsed;
    }else{
      // Return once nearby guards move away, even if others are still in the
      // server hall. Require a brief clear period to avoid constant oscillation.
      if(!clear){
        bpHackerSafeSince=-1;
        if(discovered)bpHackerHoldUntil=Math.max(bpHackerHoldUntil,g.elapsed+2);
      }else if(bpHackerSafeSince<0){
        bpHackerSafeSince=g.elapsed;
      }
      if(clear&&bpHackerSafeSince>=0&&
          g.elapsed>=Math.max(bpHackerHoldUntil,bpHackerSafeSince+2.5)&&
          bpPlanHackerReturn()){
        bpHackerState=chooseHackerPhase({
          phase:'hiding',guardVisible:false,nearbyGuard:false,
          reachedWaypoint:false,now:g.elapsed,hidingUntil:bpHackerHoldUntil,
        });
        bpHackerStateTime=g.elapsed;
      }
    }
  }else if(bpHackerState==='returning'){
    const guardPositions=patrols.filter(p=>p.state!=='idle'&&p.agent.position.x<14)
      .map(p=>({x:p.agent.position.x,z:p.agent.position.z}));
    if(threatened||!hackerAreaIsClear(guardPositions,bp.player,attacker.position,bpWorkPosition)){
      if(bpPlanHackerCover(g)){
        bpHackerState=chooseHackerPhase({
          phase:'returning',guardVisible:visible,nearbyGuard:true,
          reachedWaypoint:false,now:g.elapsed,hidingUntil:0,
        });
        bpHackerSafeSince=-1;
        bpHackerStateTime=g.elapsed;
      }
    }else if(bpFollowHackerRoute(dt,2.85)){
      bpHackerState=chooseHackerPhase({
        phase:'returning',guardVisible:false,nearbyGuard:false,
        reachedWaypoint:true,now:g.elapsed,hidingUntil:0,
      });
      bpHackerStateTime=g.elapsed;
    }
  }else if(bpHackerState==='working'){
    attacker.position.x=bpWorkPosition.x;
    attacker.position.z=bpWorkPosition.z;
    attacker.rotation.y=Math.PI;
  }
  bp.npcHiding=bpHackerState==='hiding';
  bp.npcTyping=bpHackerState==='working';
  attacker.scale.y+=((bpHackerState==='hiding'?.72:1)-attacker.scale.y)*Math.min(1,dt*5);
  if(bpHackerState!=='working'&&g.nextAttackerWave<=g.elapsed+.2){
    g.nextAttackerWave=g.elapsed+2.4;
  }
}
function bpInteractionStatus(){
  if(!game || game.ended || bp.terminal){
    $('interaction-hint').classList.remove('visible');return;
  }
  const desk=game.mode==='attack'?bpAttackerDesk:bpDefenseDesk;
  let message='';
  const proxyIndex=bpNearbyProxy(bp.player,2.6);
  if(proxyIndex>=0&&game.mode==='attack'&&proxyObjects[proxyIndex].userData.powered){
    const task=game.proxySabotage;
    message=task?.index===proxyIndex
      ? 'DISCONNECTING PROXY / '+Math.max(0,task.until-game.elapsed).toFixed(1)+'S'
      : '<kbd>E</kbd> DISCONNECT ACTIVE EDGE PROXY';
  }else if(proxyIndex>=0&&game.mode==='defend'&&!proxyObjects[proxyIndex].userData.powered)
    message='<kbd>E</kbd> RESTORE EDGE PROXY';
  else if(game.mode==='defend'&&game.coolingEventUntil>game.elapsed&&bpDistance(bp.player,bpCoolingStation)<2.4)
    message='<kbd>E</kbd> RESET SERVER ROOM COOLING';
  else if(game.mode==='defend'&&bpDistance(bp.player,attacker.position)<2.65)
    message=game.trace>=100?'<kbd>E</kbd> DETAIN SUSPECT':'<kbd>E</kbd> OBSERVE SUSPECT';
  else if(game.mode==='attack'&&bpAttackLaptopCarried)
    message='<kbd>F</kbd> RECONNECT LAPTOP AT SERVER RACK';
  else if(bpDistance(bp.player,desk)<3.9)
    message=game.mode==='attack'
      ? '<kbd>CLICK</kbd> SELECT LAPTOP ACTION · <kbd>F</kbd> PICK UP · <kbd>E</kbd> ZOOM'
      : '<kbd>CLICK</kbd> SELECT SECURITY ACTION · <kbd>E</kbd> ZOOM';
  $('interaction-hint').classList.toggle('visible',Boolean(message));
  if(message)$('interaction-hint').innerHTML=message;
}

const bpIncidentPool=[
  {label:'TRAFFIC SURGE / EDGE LOAD HIGH',kind:'surge'},
  {label:'COOLING ALERT / RACK TEMPERATURE',kind:'cooling'},
  {label:'UPLINK CONGESTION / INVESTIGATE',kind:'uplink'},
  {label:'SECURITY PATROL / AISLE CHECK',kind:'patrol'},
  {label:'POWER DISTRIBUTION / LOAD SPIKE',kind:'power'},
];
let incidentVisibleUntil=0;
function bpShowIncident(message){
  const banner=$('incident-banner');if(!banner)return;
  banner.textContent=message;banner.classList.add('visible');
  incidentVisibleUntil=performance.now()+3900;
}
function bpTriggerCoolingIssue(g){
  if(g.coolingNeedsRepair||g.ended)return;
  g.coolingNeedsRepair=true;
  g.coolingEventUntil=g.elapsed+52;
  g.nextCoolingIncident=g.elapsed+113;
  g.health=Math.max(5,g.health-4);
  bpCoolingIndicator.material=red;
  flagSecurityIncident(g);
  bpShowIncident('COOLING FAILURE / OFFICER DISPATCHED');
  log('Cooling alarm raised at server-room maintenance panel.','warn');
  sfx.alert();
}
function bpWorldEvents(){
  if(!game||game.ended)return;
  const g=game;
  if(!g.nextAmbientEvent)g.nextAmbientEvent=42;
  if(g.elapsed<g.nextAmbientEvent)return;
  g.nextAmbientEvent+=45+Math.floor((g.elapsed/70)%4)*8;
  const event=bpIncidentPool[(g.incidentIndex??0)%bpIncidentPool.length];
  g.incidentIndex=(g.incidentIndex??0)+1;
  bpShowIncident(event.label);
  log(event.label.toLowerCase().replace(' / ',' - '),'warn');
  if(event.kind==='surge'&&g.mode==='defend')g.attackerWave=Math.max(g.attackerWave,15);
  if(event.kind==='cooling')bpTriggerCoolingIssue(g);
  if(event.kind==='power'){g.powerEventUntil=g.elapsed+12;g.health=Math.max(5,g.health-3);}
  if(event.kind==='patrol'&&g.mode==='attack')g.risk=Math.min(100,g.risk+4);
  if(event.kind==='uplink'&&g.mode==='defend')g.limit=Math.max(g.limit,4);
  sfx.alert();
}

const bpOriginalStep=stepGame;
stepGame=function(dt){
  bpMovePlayer(dt);
  bpNpcUpdate(dt);
  if(game?.mode==='attack'&&!game.ended&&game.proxySabotage){
    const task=game.proxySabotage,proxy=proxyObjects[task.index];
    if(!proxy?.userData.powered||bpDistance(bp.player,proxy.position)>2.85){
      game.proxySabotage=null;
      notify('PROXY DISCONNECT CANCELLED');
    }else if(game.elapsed>=task.until){
      bpDisableProxy(task.index,'intruder');
      game.risk=Math.min(100,game.risk+3);
      game.proxySabotage=null;
    }
  }
  if(game&&!game.ended){
    if(game.mode==='attack'&&bpAttackLaptopCarried)bpSetLaptopCarrier(bp.player,bp.yaw,dt);
    else if(game.mode==='defend'&&(bpHackerState==='escaping'||bpHackerState==='hiding'||bpHackerState==='returning'||bpHackerState==='sabotaging'||bpHackerState==='packing'&&game.elapsed>=bpHackerPackUntil-.33))bpSetLaptopCarrier(attacker.position,attacker.rotation.y,dt);
    else if(bpLaptopRig.position.distanceToSquared(bpLaptopDock)>.0001)bpResetLaptop();
  }
  bpWorldEvents();
  bpOriginalStep(dt);
  if(!game || game.ended){bpInteractionStatus();return;}
  if(game.mode==='attack'&&!bp.terminal){
    const seen=patrols.some(p=>(p.state==='searching'||p.state==='chasing')&&bpGuardCanSee(p.agent,bp.player,bp.crouching?5.2:12));
    if(seen){
      game.risk=Math.min(100,game.risk+dt*(bp.crouching?.42:1.9));
      if(!bp.guardAlert){bpShowIncident('SECURITY / UNAUTHORIZED PERSON SEEN');sfx.alert();}
      bp.guardAlert=true;
    } else bp.guardAlert=false;
  }
  bpInteractionStatus();
};
const bpOriginalUpdateUI=updateUI;
updateUI=function(force=false){
  bpOriginalUpdateUI(force);
  if(!game || !bp.active)return;
  const g=game;
  const rpm=Math.round(bpSmoothedRpm);
  $('health').parentElement.querySelector('.sub').textContent='COOLING FANS '+rpm.toLocaleString()+' RPM';
  if(g.mode==='attack'){
    $('mission-step').textContent=bpAttackLaptopCarried?
      'Laptop secured. Evade security, then return to the rack and press F to reconnect.':
      g.securityDispatchActive?
      'Security is searching the hall. Press F near the laptop to unplug it before sprinting.':
      g.proxies===0?'Click the actions on the laptop screen or aim and press 1–4. F unplugs it.':
      g.proxies<3?'Choose actions directly on the laptop. Watch for responding security guards.':
      'More proxies are active. Keep the network under pressure while avoiding arrest.';
  }else{
    if(g.coolingEventUntil>g.elapsed){
      $('mission-step').textContent='Cooling pressure rising. Find the coolant reset panel by the east server racks. Press E to stabilize.';
    } else {
    $('mission-step').textContent=g.trace<22?'Choose protective actions on the office console screen.':
      g.trace<100?'Build the case with verified logs, then search the racks for the moving intruder.':
      'Case verified. Leave the console, find the hooded suspect and press E nearby to detain.';
    }
  }
  // Alert HUD belongs exclusively to live missions, never court, jail or results.
  const liveMission=bp.active&&!g.ended&&!courtroom.visible&&!jail.visible&&
    !$('ending').classList.contains('visible');
  const urgent=liveMission&&(g.health<55||g.coolingEventUntil>g.elapsed||
    (g.mode==='attack'&&g.risk>83));
  $('red-alert').classList.toggle('visible',urgent);
  $('red-alert').textContent=urgent?(g.coolingEventUntil>g.elapsed?'⚠ COOLANT PRESSURE / CHECK EAST RACKS':g.mode==='attack'&&g.risk>83?'⚠ RED ALERT / INTRUDER DETECTED':'⚠ RED ALERT / HIGH SERVER LOAD'):'';
};
const bpOriginalAnimate=animateScene;
animateScene=function(t,dt){
  bpOriginalAnimate(t,dt);
  if($('incident-banner')&&incidentVisibleUntil&&performance.now()>incidentVisibleUntil)$('incident-banner').classList.remove('visible');
  if(game&&game.coolingEventUntil>game.elapsed){
    for(let i=0;i<bpEmergencyLights.length;i++)bpEmergencyLights[i].color.setHex(0xff7e44);
  }else{
    for(const light of bpEmergencyLights)light.color.setHex(0xff2b4e);
  }
  if(game&&!game.ended){
    bpWallSampleTimer+=dt;
    if(bpWallSampleTimer>=1){
      bpWallSampleTimer-=1;
      bpWallHistory.push({traffic:game.traffic,health:game.health,proxies:game.proxies,
        bitsPerSecond:estimatedBitsPerSecond(game.traffic,game.requestFeed?.averageBytesPerRequest??DEFAULT_BYTES_PER_REQUEST)});
      if(bpWallHistory.length>120)bpWallHistory.shift();
    }
  }
  bpWallPaintTimer+=dt;
  if(bpWallPaintTimer>(lowQuality?.75:.25)){bpWallPaintTimer=0;bpWallGraph(t);}
  bpOfficeMonitorTick+=dt;
  if(bpOfficeMonitorTick>(lowQuality?.85:.34)){
    bpOfficeMonitorTick=0;bpPaintOfficeMonitor();
  }
  bpRenderCctv(dt);
  bpMonitorTick+=dt;
  if(bpMonitorTick>(bp.terminal?.09:lowQuality?.46:.24)){
    bpMonitorTick=0;
    if(game&&!game.ended)bpPaintTerminal();
    else{
      bpDrawStandbyScreen(bpDisplayContext,bpDisplayTexture);
      bpDrawStandbyScreen(bpSecurityCtx,bpSecurityTexture);
    }
  }
  const targetRpm=game?850+(game.fanLoad||0)*Math.min(5200,1650+Math.min(1,game.traffic/21000)*2700+(100-game.health)*12):850;
  bpSmoothedRpm+=(targetRpm-bpSmoothedRpm)*Math.min(1,dt*.85);
  // Perceptual fan blur avoids the stroboscopic illusion of stationary blades.
  // Physically inspired fan RPM is retained for the wall readout and motor sound.
  const visibleTurns=(1.2+bpSmoothedRpm/5500*10)*Math.PI*2*dt;
  for(const rotor of bpFanRotors)rotor.rotation.z+=visibleTurns;
  bpFanBlurMaterial.opacity=.035+Math.min(.36,bpSmoothedRpm/5500*.34);
  const fanLedMaterial=bpSmoothedRpm>4250?red:bpSmoothedRpm>2800?orange:mint;
  for(const led of bpFanSpeedLeds)led.material=fanLedMaterial;
  const emergency=game&&!game.ended&&(bpGuardEmergency(game)||(game.mode==='attack'&&game.risk>83));
  for(let i=0;i<bpEmergencyLights.length;i++)
    bpEmergencyLights[i].intensity=emergency?(2+9*Math.max(0,Math.sin(t*7+i*.5))):0;
  bpCoolingIndicator.material=game&&game.coolingEventUntil>game.elapsed?red:mint;
  bpLaptopBeacon.intensity=game&&game.mode==='attack'&&!game.ended?3.2:1.7;
  bpConsoleBeacon.intensity=game&&game.mode==='defend'&&!game.ended?3.8:2.1;
  if(!bp.active || !game)return;
  const model=game.mode==='attack'?attacker:bpPlayerAvatar;
  model.visible=bp.third && !bp.terminal && !game.ended;
  if(game.mode==='defend'){
    attacker.visible=!jail.visible;
    const motion=bp.npcTyping?Math.sin(t*11)*.012:Math.sin(t*7)*.04;
    attacker.position.y=motion;
    const working=bpHackerState==='working';
    const fleeing=bpHackerState==='escaping'||bpHackerState==='returning'||bpHackerState==='sabotaging';
    if(attacker.children[5])attacker.children[5].rotation.x=working?-.23+Math.sin(t*15)*.14:fleeing?Math.sin(t*13)*.4:.16;
    if(attacker.children[6])attacker.children[6].rotation.x=working?-.18+Math.cos(t*17)*.12:fleeing?-Math.sin(t*13)*.4:.16;
  }
};
const bpOriginalEnd=endGame;
endGame=function(win,title,description){
  bpCloseTerminal();
  if(document.pointerLockElement===renderer.domElement)void document.exitPointerLock?.();
  bp.active=false;
  document.body.classList.add('bp-mission-finished');
  $('red-alert').classList.remove('visible');
  $('red-alert').textContent='';
  bpOriginalEnd(win,title,description);
  bpPlayerAvatar.visible=false;
  $('interaction-hint').classList.remove('visible');
  // Covers success, failure, courtroom hearing, sentencing and jail.
  $('red-alert').classList.remove('visible');
};
renderer.domElement.setAttribute('aria-label','First-person 3D data center game. WASD to move, mouse to look. Click laptop actions directly or use number keys 1 through 4 while aiming at the screen. F picks up the laptop, E zooms in, C crouches and V changes camera.');

bpWallGraph(0);
bpPaintOfficeMonitor();
bpApplyQuality();
resize();focus('overview');moveCamera(10);renderer.render(scene,camera);
frame();
$('loading').remove();


/* No real network traffic is issued to any device or address from gameplay. */
