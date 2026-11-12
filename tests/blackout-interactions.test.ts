import { describe, expect, it } from 'vitest';
import { terminalActionBoxes, terminalHitTest } from '../src/blackout/terminal-screen';
import { isSightBlocked, chooseHackerPhase } from '../src/blackout/stealth-logic';

describe('In-world interactive screen', () => {
  it('maps click coordinates onto four distinct action targets', () => {
    const boxes = terminalActionBoxes(1024, 720, 4);
    expect(boxes).toHaveLength(4);
    for(let i=0;i<4;i++){
      const b=boxes[i];
      expect(terminalHitTest(b.x+b.width/2,b.y+b.height/2,1024,720,4)).toBe(i);
    }
    expect(terminalHitTest(0,0,1024,720,4)).toBe(-1);
  });
  it('adjusts hitboxes to school-laptop-sized displays', () => {
    const boxes = terminalActionBoxes(1024, 620, 4);
    expect(boxes[3].y+boxes[3].height).toBeLessThan(620);
  });
});

describe('Guard search and hacker cover', () => {
  const cabinet={minX:-19.24,maxX:-16.71,minZ:6.7,maxZ:9.37};
  it('blocks a search guard sightline through rack cover', () => {
    expect(isSightBlocked({x:-10,z:6},{x:-21,z:9},cabinet)).toBe(true);
    expect(isSightBlocked({x:-10,z:3},{x:-9,z:5},cabinet)).toBe(false);
  });
  it('progresses from laptop to escape to hiding and back when guards leave', () => {
    const common={guardVisible:false,nearbyGuard:false,reachedWaypoint:false,now:20,hidingUntil:30};
    expect(chooseHackerPhase({...common,phase:'working',nearbyGuard:true})).toBe('escaping');
    expect(chooseHackerPhase({...common,phase:'escaping',reachedWaypoint:true})).toBe('hiding');
    expect(chooseHackerPhase({...common,phase:'hiding',now:25})).toBe('hiding');
    expect(chooseHackerPhase({...common,phase:'hiding',now:34})).toBe('returning');
    expect(chooseHackerPhase({...common,phase:'returning',reachedWaypoint:true})).toBe('working');
    expect(chooseHackerPhase({...common,phase:'returning',guardVisible:true})).toBe('escaping');
  });
});
