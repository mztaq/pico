import { useEffect, useRef, useState } from 'react';
import type { QueryResult } from './engine';
import { formatCell, type FieldDisplay } from './formats';
const ROW_HEIGHT=34,OVERSCAN=10;
export function SqlDatasheet({result,fields=[]}:{result:QueryResult;fields?:FieldDisplay[]}){
  const host=useRef<HTMLDivElement>(null);
  const [scroll,setScroll]=useState(0);
  const [height,setHeight]=useState(600);
  useEffect(()=>{
    const element=host.current;if(!element)return;
    element.scrollTop=0;setScroll(0);
    const update=()=>setHeight(element.clientHeight);
    update();const observer=new ResizeObserver(update);observer.observe(element);
    return()=>observer.disconnect();
  },[result]);
  const first=Math.max(0,Math.min(result.rows.length,Math.floor(scroll/ROW_HEIGHT)-OVERSCAN));
  const end=Math.min(result.rows.length,first+Math.ceil(height/ROW_HEIGHT)+OVERSCAN*2+2);
  const columns=result.columns;
  const display=columns.map(name=>fields.find(field=>field.name===name)?.format??'general');
  return <div ref={host} className="sql-result-scroll sql-continuous-sheet" onScroll={event=>setScroll(event.currentTarget.scrollTop)}>
    <table aria-rowcount={result.rows.length+1} style={{minWidth:Math.max(1,columns.length)*120}}>
      <colgroup>{columns.map((_,i)=><col key={i}/>)}</colgroup>
      <thead><tr>{columns.map((column,i)=><th scope="col" key={i} title={column}>{column}</th>)}</tr></thead>
      <tbody>
        {first>0&&<tr aria-hidden="true" className="sql-virtual-spacer"><td colSpan={columns.length} style={{height:first*ROW_HEIGHT}}/></tr>}
        {result.rows.slice(first,end).map((row,index)=><tr key={first+index} aria-rowindex={first+index+2}>{row.map((cell,j)=>{const formatted=formatCell(cell,display[j]);return <td key={j} title={formatted}>{cell===null?<i>NULL</i>:formatted}</td>;})}</tr>)}
        {end<result.rows.length&&<tr aria-hidden="true" className="sql-virtual-spacer"><td colSpan={columns.length} style={{height:(result.rows.length-end)*ROW_HEIGHT}}/></tr>}
      </tbody>
    </table>
    {!result.rows.length&&<div className="sql-object-empty">No records</div>}
  </div>;
}
