import {useEffect,useRef} from 'react';
/** Native browser leave warning for modified work. Browsers control its wording. */
export function useExitWarning(content:string){
 const initial=useRef(content);
 const current=useRef(content);
 const exported=useRef(content);
 current.current=content;
 useEffect(()=>{
   const handler=(event:BeforeUnloadEvent)=>{
     if(current.current===initial.current||current.current===exported.current)return;
     event.preventDefault();
     event.returnValue='';
   };
   window.addEventListener('beforeunload',handler);
   return()=>window.removeEventListener('beforeunload',handler);
 },[]);
 return ()=>{exported.current=current.current;};
}
