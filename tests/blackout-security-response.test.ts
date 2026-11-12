import {describe,expect,it} from 'vitest';
import {
  flagSecurityIncident,observeSecurityAlarm,shouldDispatchSecurity,
  acknowledgeSecurityDispatch,securityOfficersReturned,SECURITY_OFFICE_REST_SECONDS,
  type IncidentDispatchState,
} from '../src/blackout/security-response';

function state():IncidentDispatchState {
  return {
    elapsed:10,securityDispatchActive:false,nextDispatchAllowed:0,
    securityIncidentSerial:0,securityDispatchedSerial:0,
    securityAlarmWasHigh:false,proxyOrders:0,
  };
}

describe('repeat security dispatch after attacker reconnects laptop',()=>{
  it('responds to a new surge after the first search and office rest',()=>{
    const g=state();
    flagSecurityIncident(g);
    expect(shouldDispatchSecurity(g)).toBe(true);
    acknowledgeSecurityDispatch(g);
    g.securityDispatchActive=true;
    g.elapsed=28;
    securityOfficersReturned(g);
    expect(g.nextDispatchAllowed).toBe(28+SECURITY_OFFICE_REST_SECONDS);
    expect(shouldDispatchSecurity(g)).toBe(false);

    // Hacker re-plugs the laptop and launches another traffic surge.
    g.elapsed=30;
    flagSecurityIncident(g);
    expect(shouldDispatchSecurity(g)).toBe(false);
    g.elapsed=38;
    expect(shouldDispatchSecurity(g)).toBe(true);
    acknowledgeSecurityDispatch(g);
    g.securityDispatchActive=true;
    expect(shouldDispatchSecurity(g)).toBe(false);
  });

  it('queues surges occurring while the guards are already searching',()=>{
    const g=state();
    flagSecurityIncident(g);
    acknowledgeSecurityDispatch(g);
    g.securityDispatchActive=true;
    flagSecurityIncident(g);
    flagSecurityIncident(g);
    expect(shouldDispatchSecurity(g)).toBe(false);
    g.elapsed=44;
    securityOfficersReturned(g);
    g.elapsed=44+SECURITY_OFFICE_REST_SECONDS;
    expect(shouldDispatchSecurity(g)).toBe(true);
  });

  it('does not repeatedly dispatch solely because the alarm stays high',()=>{
    const g=state();
    observeSecurityAlarm(g,true);
    acknowledgeSecurityDispatch(g);
    g.securityDispatchActive=true;
    g.elapsed=33;
    securityOfficersReturned(g);
    g.elapsed=90;
    observeSecurityAlarm(g,true);
    expect(shouldDispatchSecurity(g)).toBe(false);
    observeSecurityAlarm(g,false);
    observeSecurityAlarm(g,true);
    expect(shouldDispatchSecurity(g)).toBe(true);
  });

  it('still dispatches for a manual proxy order without a traffic surge',()=>{
    const g=state();
    g.proxyOrders=1;
    expect(shouldDispatchSecurity(g)).toBe(true);
  });
});
