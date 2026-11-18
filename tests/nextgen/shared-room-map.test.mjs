import test from 'node:test';import assert from 'node:assert/strict';
import {TerrainGenerator} from '../../src/nextgen/core/TerrainGenerator.ts';
import {NEXTGEN_MAP,roomHeight,terrainDistance,terrainConstrain,NEXTGEN_TERRAIN_SEED} from '../../shared/nextgen-terrain.mjs';
import {constrainPosition,BUILDINGS} from '../../shared/expansion.mjs';
import {spawnHorde,bulletTarget} from '../../shared/survival.mjs';
import {roomToScene,roomMove} from '../../src/nextgen/core/RoomIntent.ts';
test('shared room height is exactly the solo heightfield at every sampled coordinate',()=>{
  const terrain=new TerrainGenerator(NEXTGEN_TERRAIN_SEED);
  for(let x=-99;x<100;x+=3.3)for(let z=-99;z<100;z+=6.7){assert.equal(roomHeight(x,z),terrain.heightAt(x+100,z+100));assert.deepEqual(roomToScene(x,z,true),[x+100,terrain.heightAt(x+100,z+100),z+100]);}
});
test('room map has no invisible legacy buildings; old map remains unchanged',()=>{
  const {x,z}=BUILDINGS[0];assert.deepEqual(terrainConstrain({x,z}),{x,z});assert.notDeepEqual(constrainPosition({x,z}),{x,z});assert.ok(roomMove({x,z},1,0,0,false,50,true).z<z);
  assert.deepEqual(terrainConstrain({x:999,z:-999}),{x:99.6,z:-99.6});
});
test('terrain stops downward fire at its exact shared height and blocks underground hits',()=>{
  const y=roomHeight(0,0),origin={x:0,y:y+2,z:0},d={x:0,y:-1,z:0};assert.ok(Math.abs(terrainDistance(origin,d,10)-2)<0.002);
  assert.equal(bulletTarget([{x:0,z:0,hp:20}],{x:0,y:y-1,z:0},{x:0,y:1,z:0},10,NEXTGEN_MAP),null);
});
test('nextgen horde spawns on shared map and legacy simulation stays available',()=>{
  const players=[{id:'p',hp:100,x:0,z:0,yaw:0}];const enemies=spawnHorde(players,1,'nextgen',NEXTGEN_MAP);assert.ok(enemies.length>0);for(const e of enemies){assert.ok(Number.isFinite(roomHeight(e.x,e.z)));assert.deepEqual(terrainConstrain({x:e.x,z:e.z}),{x:e.x,z:e.z});}
});
