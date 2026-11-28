import type {Machine} from './engine';
export type CpuFrameCue='cpuRegister'|'cpuTransfer'|'cpuTransferWrite';
/** Every real micro-operation produces a cue, including decode and control-only steps. */
export function cpuFrameCue(previous:Machine,next:Machine):CpuFrameCue|null {
 if(next===previous||next.frame.phase==='ready'||(next.cycles<=previous.cycles&&next.frame.phase!=='error'))return null;
 const changed=(['pc','mar','mdr','cir','acc','alu'] as const).some(key=>previous[key]!==next[key]);
 const moved=Boolean(next.frame.transfer);
 return moved?(changed?'cpuTransferWrite':'cpuTransfer'):'cpuRegister';
}
