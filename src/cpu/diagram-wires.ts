import type {Register} from './engine';
type Component=Register|'CACHE'|'DECODE'|'CLOCK'|'STATUS'|'INTERRUPT';
type Point=readonly [number,number];
export interface CpuWire {
 id:string; label:string; path:string; from?:Register; to?:Register;
 bidirectional?:boolean; control?:boolean; target?:Component;
}
type Route=readonly Point[];
/** Every segment is horizontal or vertical, with a single source for lines and animation. */
export function orthogonalPath(points:Route):string {
 return points.map(([x,y],i)=>{
  if(i===0)return 'M'+x+' '+y;
  const previous=points[i-1]!;
  if(previous[1]===y)return 'H'+x;
  if(previous[0]===x)return 'V'+y;
  throw new Error('CPU connector must be orthogonal');
 }).join(' ');
}
type InternalRoute={from:Register;to:Register;points:Route;bidirectional?:boolean};
const shared:InternalRoute[]=[
 {from:'PC',to:'MAR',points:[[203,110],[548,110]]},
];
/** Aligned, smaller registers provide space for dedicated wiring channels. */
export const NORMAL_LAYOUT:Partial<Record<Component,{x:number;y:number;w:number;h:number}>>={
 PC:{x:45,y:64,w:158,h:88},
 CACHE:{x:45,y:190,w:160,h:90},
 CIR:{x:300,y:190,w:160,h:90},
 ALU:{x:45,y:333,w:160,h:88},
 ACC:{x:300,y:333,w:160,h:88},
};
export const ADVANCED_LAYOUT:Partial<Record<Component,{x:number;y:number;w:number;h:number}>>={
 CU:{x:548,y:435,w:160,h:95},
};
const normal:InternalRoute[]=[
 ...shared,
 {from:'ALU',to:'ACC',points:[[205,375],[300,375]],bidirectional:true},
 {from:'CIR',to:'ACC',points:[[380,280],[380,333]]},
 {from:'MDR',to:'CIR',points:[[548,280],[490,280],[490,245],[460,245]]},
 {from:'CIR',to:'MAR',points:[[420,190],[420,180],[600,180],[600,166]]},
 {from:'MDR',to:'ACC',points:[[548,340],[460,340]],bidirectional:true},
 {from:'MDR',to:'ALU',points:[[548,315],[125,315],[125,333]]},
 {from:'CIR',to:'PC',points:[[340,190],[340,166],[124,166],[124,152]]},
];
const advanced:InternalRoute[]=[
 ...shared,
 {from:'ALU',to:'ACC',points:[[397,283],[397,265]],bidirectional:true},
 {from:'CIR',to:'ACC',points:[[315,398],[307,398],[307,245],[315,245]]},
 {from:'MDR',to:'CIR',points:[[548,343],[500,343],[500,421],[480,421]]},
 {from:'CIR',to:'MAR',points:[[480,405],[510,405],[510,140],[548,140]]},
 {from:'MDR',to:'ACC',points:[[548,288],[490,288],[490,228],[480,228]],bidirectional:true},
 {from:'MDR',to:'ALU',points:[[548,350],[480,350]]},
 {from:'CIR',to:'PC',points:[[315,415],[303,415],[303,150],[203,150]]},
];
// These follow the actual visible direction lanes in the external bus SVG.
const external:InternalRoute[]=[
 {from:'MAR',to:'RAM',points:[[708,121],[924,121]]},
 {from:'CU',to:'RAM',points:[[708,470],[924,470]]},
 {from:'RAM',to:'MDR',points:[[924,358],[708,358]]},
 {from:'MDR',to:'RAM',points:[[708,328],[924,328]]},
];
function routeFor(routes:InternalRoute[],from:Register,to:Register):string {
 const route=[...routes,...external].find(r=>r.from===from&&r.to===to);
 if(route)return orthogonalPath(route.points);
 const reverse=[...routes,...external].find(r=>r.from===to&&r.to===from&&r.bidirectional);
 return reverse?orthogonalPath([...reverse.points].reverse()):'';
}
export const normalTransferRoute=(from:Register,to:Register)=>routeFor(normal,from,to);
export const cpuTransferRoute=(from:Register,to:Register)=>routeFor(advanced,from,to);
// Each control wire leaves its own port on the Control Unit.
const control=(target:Component,points:Route):CpuWire=>({
 id:'cu-'+target.toLowerCase(),label:'Control Unit coordinates '+target,path:orthogonalPath(points),
 control:true,target,
});
const normalControl:CpuWire[]=[
 control('MAR',[[548,454],[530,454],[530,150],[548,150]]),
 control('MDR',[[628,443],[628,358]]),
 control('ACC',[[548,470],[380,470],[380,421]]),
 control('CIR',[[548,484],[265,484],[265,210],[300,210]]),
 control('ALU',[[548,500],[125,500],[125,421]]),
 control('CACHE',[[548,516],[36,516],[36,230],[45,230]]),
 control('PC',[[548,532],[26,532],[26,100],[45,100]]),
];
const advancedControl:CpuWire[]=[
 control('MAR',[[548,450],[538,450],[538,150],[548,150]]),
 control('MDR',[[548,460],[532,460],[532,310],[548,310]]),
 control('ACC',[[548,470],[524,470],[524,205],[480,205]]),
 control('ALU',[[548,480],[518,480],[518,320],[480,320]]),
 control('CIR',[[548,490],[512,490],[512,440],[480,440]]),
 control('STATUS',[[548,500],[505,500],[505,480],[480,480]]),
 control('INTERRUPT',[[548,510],[480,510]]),
 control('CLOCK',[[642,435],[642,419]]),
 control('PC',[[560,530],[560,536],[26,536],[26,110],[45,110]]),
 control('DECODE',[[575,530],[575,540],[34,540],[34,250],[45,250]]),
 control('CACHE',[[590,530],[590,544],[40,544],[40,490],[45,490]]),
];
const dataWires=(routes:InternalRoute[]):CpuWire[]=>routes.map(r=>({
 id:(r.from+'-'+r.to).toLowerCase(),label:r.from+' to '+r.to,path:orthogonalPath(r.points),from:r.from,to:r.to,bidirectional:r.bidirectional,
}));
export const NORMAL_WIRES:CpuWire[]=[
 ...normalControl,
 ...dataWires(normal),
];
export const ADVANCED_WIRES:CpuWire[]=[
 ...advancedControl,
 ...dataWires(advanced),
 {id:'cir-decode',label:'CIR supplies the instruction for decoding',path:orthogonalPath([[315,400],[292,400]])},
 {id:'cache-decode',label:'Schematic cache connection to the CPU',path:orthogonalPath([[175,423],[175,410]]),bidirectional:true},
 {id:'alu-status',label:'ALU output updates the illustrative status register',path:orthogonalPath([[480,365],[492,365],[492,478],[480,478]])},
 {id:'clock-cu',label:'Clock signal reaches the Control Unit',path:orthogonalPath([[616,419],[616,435]])},
];
