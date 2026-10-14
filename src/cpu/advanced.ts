import {step,type Machine} from './engine';

/** Interrupt concepts are in Cambridge 0478 §4.1. The exact ISR animation is a
 * teaching simplification, not a specified architecture or real memory handler. */
export interface InterruptDemo {
 pending:boolean;
 stage:0|1|2|3|4;
 savedPc:number|null;
 handled:number;
}
export const initialInterrupt=():InterruptDemo=>({pending:false,stage:0,savedPc:null,handled:0});
export function requestInterrupt(current:InterruptDemo):InterruptDemo{
 return current.pending||current.stage>0?current:{...current,pending:true};
}
export function advanceWithInterrupt(machine:Machine,interrupt:InterruptDemo):{machine:Machine;interrupt:InterruptDemo}{
 if(machine.halted||machine.error)return {machine,interrupt};
 const m=machine, i=interrupt;
 const display=(description:string,active:Machine['frame']['active'],stage:InterruptDemo['stage'],updates:Partial<InterruptDemo>={})=>({
  machine:{...m,cycles:m.cycles+1,frame:{phase:'interrupt' as const,description,active}},
  interrupt:{...i,stage,...updates}
 });
 // A pending interrupt is serviced only after an instruction has finished.
 if(i.pending&&i.stage===0&&m.micro===0&&m.instructions>0)
  return display('Interrupt accepted after finishing the current instruction. The CPU temporarily pauses the program.',['CU'],1,{pending:false});
 if(i.stage===1)return display('Save the current program state, including the next PC address, so execution can resume later.',['PC','CU'],2,{savedPc:m.pc});
 if(i.stage===2)return display('The control unit transfers control to an interrupt service routine (ISR). Exact handler details are a teaching model (out of specification).',['CU'],3);
 if(i.stage===3)return display('The interrupt service routine handles the request, such as a keyboard input or device signal.',['CU'],4);
 if(i.stage===4)return {
  machine:{...m,pc:i.savedPc??m.pc,cycles:m.cycles+1,frame:{phase:'interrupt',description:'Restore the saved state and resume the interrupted program at the next instruction.',active:['PC','CU']}},
  interrupt:{pending:false,stage:0,savedPc:null,handled:i.handled+1},
 };
 return {machine:step(m),interrupt:i};
}
