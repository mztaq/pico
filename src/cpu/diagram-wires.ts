import type {Register} from './engine';
type Component=Register|'CACHE'|'DECODE'|'CLOCK'|'STATUS'|'INTERRUPT';
type Point=readonly [number,number];
export interface CpuWire {
 id:string; label:string; path:string; from?:Register; to?:Register;
 bidirectional?:boolean; control?:boolean; trunk?:boolean; target?:Component; junction?:Point;
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
const normal:InternalRoute[]=[
 ...shared,
 {from:'ALU',to:'ACC',points:[[165,299],[165,279]],bidirectional:true},
 {from:'CIR',to:'ACC',points:[[315,235],[285,235]]},
 {from:'MDR',to:'CIR',points:[[548,290],[498,290],[498,250],[480,250]]},
 {from:'CIR',to:'MAR',points:[[480,210],[506,210],[506,140],[548,140]]},
 {from:'MDR',to:'ACC',points:[[548,280],[490,280],[490,183],[270,183],[270,189]],bidirectional:true},
 {from:'MDR',to:'ALU',points:[[548,350],[285,350]]},
 {from:'CIR',to:'PC',points:[[380,197],[380,153],[203,153]]},
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
const control=(target:Component,points:Route):CpuWire=>({
 id:'cu-'+target.toLowerCase(),label:'Control Unit coordinates '+target,path:orthogonalPath(points),
 control:true,target,junction:points[0],
});
const trunk:CpuWire={id:'cu-control-trunk',label:'Shared internal control signals',path:orthogonalPath([[548,520],[530,520],[530,178],[30,178],[30,490]]),control:true,trunk:true};
const commonControl:CpuWire[]=[
 trunk,
 control('PC',[[124,178],[124,170]]),
 control('MAR',[[530,178],[628,178],[628,166]]),
 control('MDR',[[530,310],[548,310]]),
 control('CACHE',[[30,490],[45,490]]),
];
const dataWires=(routes:InternalRoute[]):CpuWire[]=>routes.map(r=>({
 id:(r.from+'-'+r.to).toLowerCase(),label:r.from+' to '+r.to,path:orthogonalPath(r.points),from:r.from,to:r.to,bidirectional:r.bidirectional,
}));
export const NORMAL_WIRES:CpuWire[]=[
 ...commonControl,
 control('ACC',[[30,215],[45,215]]),
 control('ALU',[[30,360],[45,360]]),
 control('CIR',[[530,280],[480,280]]),
 ...dataWires(normal),
];
export const ADVANCED_WIRES:CpuWire[]=[
 ...commonControl,
 control('DECODE',[[30,250],[45,250]]),
 control('ACC',[[530,205],[480,205]]),
 control('ALU',[[530,320],[480,320]]),
 control('CIR',[[530,440],[480,440]]),
 control('CLOCK',[[530,392],[548,392]]),
 control('STATUS',[[530,484],[480,484]]),
 control('INTERRUPT',[[530,520],[480,520]]),
 ...dataWires(advanced),
 {id:'cir-decode',label:'CIR supplies the instruction for decoding',path:orthogonalPath([[315,400],[292,400]])},
 {id:'cache-decode',label:'Schematic cache connection to the CPU',path:orthogonalPath([[175,423],[175,410]]),bidirectional:true},
 {id:'alu-status',label:'ALU output updates the illustrative status register',path:orthogonalPath([[480,365],[492,365],[492,478],[480,478]])},
 {id:'clock-cu',label:'Clock signal reaches the Control Unit',path:orthogonalPath([[616,419],[616,443]])},
];
