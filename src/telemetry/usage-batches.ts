export interface UsageEntry { workspace: string; seconds: number }
export interface UsageBatch { batchId: string; entries: UsageEntry[] }

export function attributeSeconds(totals: Map<string,number>, workspace:string, seconds:number): void {
  if(seconds <= 0 || !Number.isFinite(seconds)) return;
  totals.set(workspace,(totals.get(workspace) ?? 0)+seconds);
}

export function buildUsageBatch(totals: ReadonlyMap<string,number>, batchId:string): UsageBatch | null {
  const entries: UsageEntry[]=[];
  let remaining=60;
  for(const [workspace, value] of totals) {
    const seconds=Math.min(remaining,Math.floor(value));
    if(seconds>0) { entries.push({workspace,seconds}); remaining-=seconds; }
    if(remaining===0) break;
  }
  return entries.length ? {batchId,entries} : null;
}

export function acknowledgeUsageBatch(totals:Map<string,number>, batch:UsageBatch):void {
  for(const entry of batch.entries) {
    const remaining=(totals.get(entry.workspace) ?? 0)-entry.seconds;
    if(remaining>0) totals.set(entry.workspace,remaining);
    else totals.delete(entry.workspace);
  }
}
