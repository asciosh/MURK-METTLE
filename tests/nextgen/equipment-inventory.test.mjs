import test from 'node:test';
import assert from 'node:assert/strict';
import { EquipmentInventory, WEAPONS, SWITCH_MS } from '../../src/nextgen/core/EquipmentInventory.ts';
import { CombatController } from '../../src/nextgen/core/CombatController.ts';
import { findWeaponHits } from '../../src/nextgen/core/ShotQuery.ts';

const idle = {enabled:true,shoot:false,reload:false};
const shoot = {...idle,shoot:true};
const reload = {...idle,reload:true};
function advance(c,ms) { while(ms>0){const dt=Math.min(ms,100);c.step(dt,idle);ms-=dt;} }
function equip(c,id,rounds) {assert.equal(c.collectLoot(id,1,rounds),1);assert.equal(c.selectWeapon(id),true);advance(c,SWITCH_MS);}

test('Only pistol starts owned; one primary slot accepts a valid weapon',()=>{
  const i=new EquipmentInventory();assert.equal(i.active,'pistol');assert.equal(i.primaryWeapon,null);
  assert.equal(i.switchTo('rifle'),false);assert.equal(i.collect('rifle',1,25),0);
  assert.equal(i.collect('rifle',1,7),1);assert.equal(i.collect('shotgun',1),0);assert.equal(i.collect('rifle',1),0);
  assert.equal(i.getState().rifle.loaded,7);
});
test('Reserve capacity is independent per ammunition type',()=>{
  const i=new EquipmentInventory();assert.equal(i.collect('rifle-ammo',120),96);
  assert.equal(i.collect('shotgun-ammo',12),12);assert.equal(i.collect('ammo',50),24);
  assert.equal(i.getState().pistol.reserve,72);assert.equal(i.getState().rifle.reserve,96);assert.equal(i.getState().shotgun.reserve,12);
  assert.equal(i.collect('rifle-ammo',1),0);assert.equal(i.collect('ammo',-2),0);
});
test('Switching blocks fire and preserves both loaded magazines',()=>{
  const c=new CombatController();c.step(16,shoot);advance(c,350);c.collectLoot('rifle',1,7);
  assert.equal(c.selectWeapon('rifle'),true);assert.equal(c.step(16,shoot).shot,false);advance(c,SWITCH_MS);
  assert.equal(c.step(16,shoot).shot,true);assert.equal(c.getState().ammo,6);advance(c,140);
  assert.equal(c.selectWeapon('pistol'),true);advance(c,SWITCH_MS);assert.equal(c.getState().ammo,11);
  assert.equal(c.getState().equipment.rifle.loaded,6);
});
test('Rifle cadence and shotgun reload use their own weapon specifications',()=>{
  const c=new CombatController();equip(c,'rifle',2);assert.equal(c.step(16,shoot).shot,true);
  assert.equal(c.step(100,shoot).shot,false);assert.equal(c.step(40,shoot).shot,true);
  const s=new CombatController();equip(s,'shotgun',1);s.collectLoot('shotgun-ammo',9);
  assert.equal(s.step(16,shoot).shot,true);advance(s,WEAPONS.shotgun.intervalMs);
  assert.equal(s.step(16,reload).reloadStarted,true);advance(s,WEAPONS.shotgun.reloadMs-1);
  assert.equal(s.getState().ammo,0);advance(s,1);assert.equal(s.getState().ammo,5);assert.equal(s.getState().reserve,4);
  assert.equal(s.getState().equipment.pistol.reserve,48);
});
test('Reload interrupted by damage consumes no reserve',()=>{
  const c=new CombatController();equip(c,'rifle',1);c.collectLoot('rifle-ammo',20);
  c.step(16,reload);assert.equal(c.getState().reloading,true);c.takeDamage(12,0);advance(c,3000);
  assert.equal(c.getState().ammo,1);assert.equal(c.getState().reserve,20);
});
test('A failed drop is atomic; successful drop preserves loaded rounds on re-pickup',()=>{
  const c=new CombatController();equip(c,'rifle',8);c.collectLoot('rifle-ammo',14);
  assert.equal(c.dropItem('rifle',1,()=>false),false);assert.equal(c.getState().ammo,8);
  let drop;assert.equal(c.dropItem('rifle',1,(...args)=>{drop=args;return true;}),true);
  assert.deepEqual(drop,['rifle',1,8]);assert.equal(c.weaponId,'pistol');assert.equal(c.getState().equipment.primary,null);
  assert.equal(c.getState().equipment.rifle.reserve,14);assert.equal(c.collectLoot(...drop),1);
  assert.equal(c.getState().equipment.rifle.loaded,8);
});
test('Ammo and bandage drops respect availability and cannot duplicate on failure',()=>{
  const c=new CombatController();assert.equal(c.dropItem('ammo',12,()=>false),false);assert.equal(c.getState().reserve,48);
  assert.equal(c.dropItem('ammo',12,()=>true),true);assert.equal(c.getState().reserve,36);
  assert.equal(c.dropItem('bandage',1,()=>true),true);assert.equal(c.getState().bandages,1);
  assert.equal(c.collectLoot('bandage',10),1);assert.equal(c.getState().bandages,2);
  c.takeDamage(100,0);assert.equal(c.collectLoot('rifle',1),0);assert.equal(c.dropItem('ammo',1,()=>true),false);
});
test('Shotgun pellets group into one damage application per target',()=>{
  const hits=findWeaponHits('shotgun',[0,1,0],[0,0,-1],[0,1,0],[{position:[0,0,-2],health:100}],()=>0);
  assert.deepEqual(hits,[{index:0,damage:72}]);
  const c=new CombatController();equip(c,'shotgun',5);c.step(16,shoot);c.recordShotHits(2);
  assert.equal(c.getState().shotsFired,1);assert.equal(c.getState().shotsHit,1);assert.equal(c.getState().kills,2);
});
test('Scatter distributes damage to nearby targets, and terrain still blocks every pellet',()=>{
  const targets=[{position:[-.45,0,-12],health:100},{position:[.45,0,-12],health:100}];
  const args=[[0,1,0],[0,0,-1],[0,1,0],targets];
  const hits=findWeaponHits('shotgun',...args,()=>0);assert.equal(hits.length,2);
  assert.ok(hits.reduce((sum,x)=>sum+x.damage,0)<=72);
  assert.deepEqual(findWeaponHits('shotgun',...args,(_x,z)=>z<-4&&z>-6?4:0),[]);
});
