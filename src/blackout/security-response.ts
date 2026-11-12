/** Dispatch decisions are independent from guard movement.
 * New traffic spikes and attacker actions queue a fresh security response.
 * A continuously unhealthy server does not cause infinite redispatches.
 */
export interface IncidentDispatchState {
  elapsed:number;
  securityDispatchActive:boolean;
  nextDispatchAllowed:number;
  securityIncidentSerial:number;
  securityDispatchedSerial:number;
  securityAlarmWasHigh:boolean;
  proxyOrders:number;
}

export const SECURITY_OFFICE_REST_SECONDS=10;

export function flagSecurityIncident(state:IncidentDispatchState):void {
  state.securityIncidentSerial=(state.securityIncidentSerial||0)+1;
}

export function observeSecurityAlarm(state:IncidentDispatchState,high:boolean):void {
  if(high&&!state.securityAlarmWasHigh)flagSecurityIncident(state);
  state.securityAlarmWasHigh=high;
}

export function shouldDispatchSecurity(state:IncidentDispatchState):boolean {
  return state.elapsed>8 &&
    !state.securityDispatchActive &&
    state.elapsed>=(state.nextDispatchAllowed||0) &&
    ((state.securityIncidentSerial||0)>(state.securityDispatchedSerial||0) ||
     (state.proxyOrders||0)>0);
}

export function acknowledgeSecurityDispatch(state:IncidentDispatchState):void{
  state.securityDispatchedSerial=state.securityIncidentSerial||0;
}

export function securityOfficersReturned(state:IncidentDispatchState):void{
  state.securityDispatchActive=false;
  state.nextDispatchAllowed=Math.max(state.nextDispatchAllowed||0,
    state.elapsed+SECURITY_OFFICE_REST_SECONDS);
}
