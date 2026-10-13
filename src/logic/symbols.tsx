import type { ComponentKind, Signal } from './model';

/**
 * Original ANSI-style digital logic symbols in a fixed 122-unit coordinate system.
 * Terminals end at x=0 and x=122, matching model.portPosition, while
 * the body scales vertically with the component's actual pin count.
 */
export function CircuitSymbol({kind,height,signal='Z',hex='X'}:{
  kind:ComponentKind;height:number;signal?:Signal;hex?:string;
}) {
  const mid=height/2, top=17, bottom=height-17;
  const inverse=['not','nand','nor','xnor'].includes(kind);
  const isTriangle=kind==='not'||kind==='buffer';
  const isAnd=kind==='and'||kind==='nand';
  const isOr=['or','nor','xor','xnor'].includes(kind);
  const xor=kind==='xor'||kind==='xnor';
  let outline='';
  if(isTriangle) outline=`M 30 ${top} L 93 ${mid} L 30 ${bottom} Z`;
  else if(isAnd)outline=`M 28 ${top} H 61 A ${mid-top} ${mid-top} 0 0 1 61 ${bottom} H 28 Z`;
  else if(isOr)outline=`M 27 ${top} Q 65 ${top} 96 ${mid} Q 65 ${bottom} 27 ${bottom} Q 47 ${mid} 27 ${top} Z`;
  else if(kind==='tri')outline=`M 30 ${top} L 96 ${mid} L 30 ${bottom} Z`;
  else outline=`M 27 ${top} H 97 V ${bottom} H 27 Z`;
  const gate=['buffer','not','and','nand','or','nor','xor','xnor','tri'].includes(kind);
  if(gate)return <g className="logic-symbol" aria-hidden="true">
    <path className="logic-symbol-outline" d={outline}/>
    {xor&&<path className="logic-symbol-outline" d={`M 17 ${top} Q 37 ${mid} 17 ${bottom}`}/>}
    {inverse&&<circle className="logic-symbol-outline" cx={102} cy={mid} r={6}/>}
    {kind==='tri'&&<text className="logic-symbol-letter" x="63" y={mid+5} textAnchor="middle">EN</text>}
  </g>;
  if(kind==='lamp')return <g className="logic-symbol logic-bulb" aria-hidden="true">
 <path className="logic-bulb-outline" d={`M 61 ${mid-28} C 44 ${mid-28} 39 ${mid-15} 44 ${mid-2} C 47 ${mid+5} 52 ${mid+8} 52 ${mid+16} H 70 C 70 ${mid+8} 75 ${mid+5} 78 ${mid-2} C 83 ${mid-15} 78 ${mid-28} 61 ${mid-28} Z`}/>
 <path className="logic-bulb-filament" d={`M 52 ${mid-8} L 56 ${mid-1} L 60 ${mid-8} L 64 ${mid-1} L 68 ${mid-8} M 56 ${mid-1} L 58 ${mid+13} M 64 ${mid-1} L 64 ${mid+13}`}/>
 <path className="logic-bulb-base" d={`M 52 ${mid+16} H 70 V ${mid+22} H 52 Z M 54 ${mid+24} H 68 V ${mid+27} H 54 Z`}/>
 {signal===1&&<path className="logic-bulb-light" d={`M 61 ${mid-28} C 44 ${mid-28} 39 ${mid-15} 44 ${mid-2} C 47 ${mid+5} 52 ${mid+8} 52 ${mid+16} H 70 C 70 ${mid+8} 75 ${mid+5} 78 ${mid-2} C 83 ${mid-15} 78 ${mid-28} 61 ${mid-28} Z`}/>}
 </g>;
  if(kind==='switch'||kind==='button')return <g className="logic-symbol" aria-hidden="true">
    <path className="logic-symbol-outline" d={`M 27 ${mid} H 43 M 80 ${mid} H 100`}/>
    <circle className="logic-symbol-outline" cx={43} cy={mid} r="3"/>
    <circle className="logic-symbol-outline" cx={80} cy={mid} r="3"/>
    <path className="logic-switch-arm" d={`M 43 ${mid} L 78 ${signal===1?mid:mid-19}`}/>
    <text className="logic-signal-caption" x="61" y={height-3} textAnchor="middle">{String(signal)}</text>
  </g>;
  if(kind==='high'||kind==='low'||kind==='pullup'||kind==='pulldown')return <g className="logic-symbol" aria-hidden="true">
    <rect className="logic-symbol-outline" x="34" y={mid-21} width="55" height="42" rx="4"/>
    <text className="logic-symbol-letter" x="61" y={mid+6} textAnchor="middle">{kind==='high'||kind==='pullup'?'1':'0'}</text>
  </g>;
  if(kind==='clock')return <g className="logic-symbol" aria-hidden="true">
    <rect className="logic-symbol-outline" x="30" y={mid-24} width="65" height="48" rx="5"/>
    <path className="logic-symbol-detail" d={`M 39 ${mid+12} H 48 V ${mid-11} H 62 V ${mid+12} H 76 V ${mid-11} H 86`}/>
  </g>;
  if(kind==='hex')return <g className="logic-symbol" aria-hidden="true">
    <rect className="logic-symbol-outline" x="33" y={mid-28} width="58" height="56" rx="5"/>
    <text className="logic-hex" x="62" y={mid+13} textAnchor="middle">{hex}</text>
  </g>;
  if(kind==='label')return <g className="logic-symbol" aria-hidden="true">
    <text className="logic-symbol-letter" x="61" y={mid+7} textAnchor="middle">Text</text>
  </g>;
  const titles:Partial<Record<ComponentKind,string>>={sr:'SR',dff:'D',jkff:'JK',tff:'T'};
  return <g className="logic-symbol" aria-hidden="true">
    <rect className="logic-symbol-outline" x="28" y="17" width="67" height={height-34} rx="3"/>
    <text className="logic-symbol-letter" x="62" y={mid+6} textAnchor="middle">{titles[kind]??kind.toUpperCase()}</text>
    <path className="logic-symbol-detail" d={`M 28 ${height-32} l 9 -6 l -9 -6`}/>
  </g>;
}

export function PaletteSymbol({kind}:{kind:ComponentKind}) {
  return <svg className="logic-palette-symbol" viewBox="0 0 122 80" aria-hidden="true">
    <CircuitSymbol kind={kind} height={80} signal={kind==='lamp'?1:0} hex="A"/>
  </svg>;
}
