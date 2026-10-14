import {boot,step,type Machine} from './engine';
import {advanceWithInterrupt,initialInterrupt,type InterruptDemo} from './advanced';
export type PlaybackMode='normal'|'advanced';
export interface PlaybackFrame {
 machine:Machine;
 interrupt:InterruptDemo;
 restarted:boolean;
}
/** Run repeats the fixed teaching program until the user pauses. Step still stops on HLT. */
export function advanceRunFrame(machine:Machine,interrupt:InterruptDemo,mode:PlaybackMode):PlaybackFrame{
 if(machine.error)return {machine,interrupt,restarted:false};
 if(machine.halted){
  const restarted=boot(machine.initial);
  return {
   machine:{
    ...restarted,
    cycles:machine.cycles,
    instructions:machine.instructions,
    frame:{phase:'ready',active:['PC'],description:'Program completed. Fetching the first instruction again.'},
   },
   interrupt:initialInterrupt(),
   restarted:true,
  };
 }
 const result=mode==='advanced'?advanceWithInterrupt(machine,interrupt):{machine:step(machine),interrupt};
 return {...result,restarted:false};
}
