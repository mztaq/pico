import {describe,expect,it} from 'vitest';
import {
  EVIDENCE_STATIONS,selectGuardEvidence,collectGuardEvidence
} from '../src/blackout/evidence-coordination';

describe('Autonomous security guard evidence collection',()=>{
  it('sends different officers to distinct, physically reachable evidence points',()=>{
    const reserved=new Set<string>();
    const first=selectGuardEvidence(EVIDENCE_STATIONS,{},reserved,
      {x:19,z:-1.8},()=>true);
    expect(first).not.toBeNull();
    reserved.add(first!.id);
    const second=selectGuardEvidence(EVIDENCE_STATIONS,{},reserved,
      {x:27,z:2.9},()=>true);
    expect(second).not.toBeNull();
    expect(second?.id).not.toBe(first?.id);
  });
  it('never collects the same station twice or credits more than 100 percent',()=>{
    const caseFile={trace:0,collectedEvidence:{} as Record<string,boolean>};
    for(const station of EVIDENCE_STATIONS)
      expect(collectGuardEvidence(caseFile,station)).toBe(true);
    expect(caseFile.trace).toBe(100);
    expect(collectGuardEvidence(caseFile,EVIDENCE_STATIONS[0])).toBe(false);
    expect(caseFile.trace).toBe(100);
  });
  it('includes forensic evidence from the new west hall',()=>{
    expect(EVIDENCE_STATIONS.some(p=>p.x<-28)).toBe(true);
    expect(EVIDENCE_STATIONS.reduce((sum,p)=>sum+p.value,0)).toBeGreaterThanOrEqual(100);
  });
  it('ignores blocked and already-verified evidence locations',()=>{
    const collected:Record<string,boolean>={[EVIDENCE_STATIONS[0].id]:true};
    const chosen=selectGuardEvidence(EVIDENCE_STATIONS,collected,new Set(),
      {x:20,z:0},(x,z)=>x>0&&z<0);
    expect(chosen).not.toBeNull();
    expect(chosen?.id).not.toBe(EVIDENCE_STATIONS[0].id);
    expect(chosen?.x).toBeGreaterThan(0);
  });
});
