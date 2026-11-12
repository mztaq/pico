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

export const SECURITY_OFFICE_REST_SECONDS=0;

export function flagSecurityIncident(state:IncidentDispatchState):void {
  state.securityIncidentSerial=(state.securityIncidentSerial||0)+1;
}

export function observeSecurityAlarm(state:IncidentDispatchState,high:boolean):void {
  if(high&&!state.securityAlarmWasHigh)flagSecurityIncident(state);
  state.securityAlarmWasHigh=high;
}

export function shouldDispatchSecurity(
  state:IncidentDispatchState,
  respondersReturning=false,
):boolean {
  // A fresh incident can interrupt officers already heading back to base.
  // No office cooldown is needed after a completed patrol.
  const hasNewIncident=(state.securityIncidentSerial||0)>(state.securityDispatchedSerial||0);
  const hasProxyOrder=(state.proxyOrders||0)>0;
  return state.elapsed>8 &&
    (!state.securityDispatchActive || respondersReturning) &&
    state.elapsed>=(state.nextDispatchAllowed||0) &&
    (hasNewIncident||hasProxyOrder);
}

export function acknowledgeSecurityDispatch(state:IncidentDispatchState):void{
  state.securityDispatchedSerial=state.securityIncidentSerial||0;
}

export function securityOfficersReturned(state:IncidentDispatchState):void{
  state.securityDispatchActive=false;
  state.nextDispatchAllowed=state.elapsed;
}
