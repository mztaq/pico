import type {Machine} from './engine';
export type CpuFrameCue='cpuRegister'|'cpuTransfer'|'cpuTransferWrite';
/** One short cue per executed micro-operation, never on idle, restart or reset. */
export function cpuFrameCue(previous:Machine,next:Machine):CpuFrameCue|null {
 if(next.cycles<=previous.cycles||next.frame.phase==='ready'||next.frame.phase==='error')return null;
 const changed=(['pc','mar','mdr','cir','acc','alu'] as const).some(key=>previous[key]!==next[key]);
 const moved=Boolean(next.frame.transfer);
 return moved?(changed?'cpuTransferWrite':'cpuTransfer'):changed?'cpuRegister':null;
}
