import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SURVIVOR_SKINS, INFECTED_SKINS, selectSurvivorSkin, selectInfectedSkin,
  infectedSkinForSpawn, characterSkinFile } from '../../src/nextgen/core/CharacterSkins.ts';
test('Character skin choices are closed and stable', () => {
  assert.equal(selectSurvivorSkin(null), 'classic');
  assert.equal(selectSurvivorSkin('../../bad'), 'classic');
  assert.equal(selectInfectedSkin('mixed'), 'mixed');
  assert.equal(selectInfectedSkin('bad'), 'classic');
  assert.equal(characterSkinFile('survivor','classic'),'survivor.glb');
  for (const s of SURVIVOR_SKINS) assert.equal(selectSurvivorSkin(s),s);
  for (const s of INFECTED_SKINS) assert.equal(selectInfectedSkin(s),s);
});
test('Mixed hordes deterministically rotate four cosmetic variations', () => {
  assert.deepEqual(INFECTED_SKINS.map((_,i)=>infectedSkinForSpawn('mixed',1,i)), [...INFECTED_SKINS]);
  assert.equal(infectedSkinForSpawn('mixed',2,0),'ashen');
  assert.equal(infectedSkinForSpawn('feral',9,4),'feral');
});
test('Eight character variations preserve the rig and animation contract', () => {
  const base = new URL('../../public/models/nextgen/variants/',import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json',base),'utf8'));
  for (const [kind,entries] of Object.entries(manifest)) {
    assert.equal(entries.length,4);
    for(const e of entries){
      const b=readFileSync(new URL(e.file,base));
      assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);
      const gltf=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
      assert.equal(gltf.skins.length,1);
      assert.equal(gltf.skins[0].joints.length,53);
      assert.deepEqual(gltf.animations.map(a=>a.name),e.clips);
      assert.equal(e.clips.length,kind==='survivor'?17:6);
      assert.ok(e.triangles<(kind==='survivor'?43000:35000));
      if(kind==='survivor')assert.ok(gltf.nodes.some(n=>n.name==='SurvivalBackpack'));
    }
  }
});
