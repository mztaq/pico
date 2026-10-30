/** Reuses the exact vector paths from Pico's existing home-screen curves.
 *  Kept standalone so the public landing does not load the workspace launcher.
 */
const HOME_AMBIENT_CURVES = [
  { d: 'M -170 -160 C 40 26 230 186 210 362 C 186 520 -27 624 104 814 C 222 981 376 1028 500 1108', width: 2.6, opacity: .72 },
  { d: 'M -230 -120 C -10 46 186 200 168 370 C 149 548 -75 659 62 850 C 174 1008 341 1080 476 1163', width: 1.5, opacity: .39 },
  { d: 'M 1260 -185 C 1080 30 1183 190 1375 350 C 1564 506 1459 670 1390 805 C 1334 954 1429 1075 1684 1176', width: 2.6, opacity: .72 },
  { d: 'M 1332 -220 C 1150 22 1246 193 1428 353 C 1599 511 1520 676 1441 819 C 1375 960 1478 1096 1743 1200', width: 1.5, opacity: .40 },
  { d: 'M 1010 -170 C 1080 -75 1162 -28 1190 105 C 1221 217 1286 251 1387 304', width: 1.3, opacity: .28 },
] as const;

export function LandingCurves(){
  return <svg className="lp-ambient-curves" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    {HOME_AMBIENT_CURVES.map((curve,index)=>(
      <path key={index} d={curve.d} strokeWidth={curve.width} opacity={curve.opacity}/>
    ))}
    {[0,2].map(index=>(
      <path key={`flow-${index}`} d={HOME_AMBIENT_CURVES[index].d} pathLength={1000}
        className={index===0?'lp-ambient-curve-flow':'lp-ambient-curve-flow lp-ambient-curve-flow--right'}/>
    ))}
  </svg>;
}
