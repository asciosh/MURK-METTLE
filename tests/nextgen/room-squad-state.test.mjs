import test from 'node:test';
import assert from 'node:assert/strict';
import { squadRoster, objectiveDisplay } from '../../src/nextgen/core/RoomSquadState.mjs';
const actor = (id,hp,nextgen={})=>({ id, hp, x: 0, z: 2, nextgen });
test('squad roster uses safe temporary aliases instead of leaking account names',()=>{
  const list=squadRoster(actor('self',100), [actor('remote-1',65)]);
  assert.deepEqual(list.map(m=>m.label),['YOU','ALLY 1']);
  assert.equal(list[1].hp,65);
});
test('downed state counts down, distinguishes eliminated and revive in progress',()=>{
  const roster=squadRoster(actor('me',75,{ revivingTarget:'p', reviveProgress:.4 }), [actor('p',0,{downedMs:11900,reviveBy:'me'}),actor('dead',0,{downedMs:0})]);
  assert.equal(roster[0].reviving,true);assert.equal(roster[0].reviveProgress,.4);
  assert.equal(roster[1].downed,true);assert.equal(roster[1].downedSeconds,12);assert.equal(roster[1].receivingRevive,true);
  assert.equal(roster[2].eliminated,true);assert.equal(roster[2].downed,false);
});
test('HUD values clamp malformed health and progress',()=>{
  const [bad]=squadRoster(actor('x',Infinity,{reviveProgress:200}),[]);
  assert.equal(bad.hp,0);assert.equal(bad.reviveProgress,1);
});
test('mission stages require server-ready state',()=>{
  assert.equal(objectiveDisplay(null,3,2).ready,false);
  assert.equal(objectiveDisplay({kills:3,salvage:2,phase:'active',ready:false},3,2).ready,false);
  assert.equal(objectiveDisplay({kills:3,salvage:2,phase:'active',ready:true},3,2).ready,true);
  assert.equal(objectiveDisplay({kills:3,salvage:2,phase:'extracting',ready:true},3,2).ready,false);
});
