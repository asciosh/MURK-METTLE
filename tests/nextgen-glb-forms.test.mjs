import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateManifest,resolveCosmeticId,sameCosmeticSlot} from '../src/client/mods/format.mjs';
import {validatePackage} from '../src/client/mods/archive.mjs';
import {nativeFormXP} from '../shared/nextgen-creature-roster.mjs';
import {retargetLocal3dPack} from '../scripts/retarget-local-3d-pack.mjs';
const original=await readFile(new URL('../public/mod-examples/copperbloom.mmcosmetic',import.meta.url));
const buf=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const legacy=await validatePackage(buf(original));
const row=(id,form,enabled=true,species='lanternkin')=>({id,enabled,manifest:{...legacy.manifest,id,species,...(form===undefined?{}:{form})}});
test('form manifests enforce exact integer stages and forbid untrusted gameplay fields',()=>{
  for(const form of [1,2,3])assert.equal(validateManifest({...legacy.manifest,form}).form,form);
  for(const form of [0,4,1.5,'2',null,{},[]])assert.throws(()=>validateManifest({...legacy.manifest,form}),/form/);
  assert.throws(()=>validateManifest({...legacy.manifest,form:2,damage:99}),/field/);
});
test('three independently enabled slots select exact forms, with legacy fallback and isolation',()=>{
  const rows=[row('all',undefined),row('one',1),row('two',2),row('three',3),row('other',2,true,'emberling')];
  assert.equal(resolveCosmeticId(rows,'lanternkin'), 'all'); // unchanged legacy selection
  for(const [xp,id] of [[0,'one'],[119,'one'],[120,'two'],[399,'two'],[400,'three']])assert.equal(resolveCosmeticId(rows,'lanternkin',xp),id);
  assert.equal(resolveCosmeticId(rows,'emberling',120),'other');
  rows[2].enabled=false;assert.equal(resolveCosmeticId(rows,'lanternkin',120),'all');
  rows[0].enabled=false;assert.equal(resolveCosmeticId(rows,'lanternkin',120),undefined);
  assert.equal(sameCosmeticSlot(rows[1].manifest,rows[2].manifest),false);
  assert.equal(sameCosmeticSlot(rows[2].manifest,row('replacement',2).manifest),true);
  assert.equal(sameCosmeticSlot(rows[2].manifest,rows[4].manifest),false);
});
test('native lifetime XP cannot switch models until the authoritative explicit form changes',()=>{
  const rows=[row('one',1),row('two',2),row('three',3)];
  const native={familyId:'lanternkin',formId:'lanternkin',xp:450};
  assert.equal(resolveCosmeticId(rows,'lanternkin',nativeFormXP(native)),'one');
  assert.equal(resolveCosmeticId(rows,'lanternkin',nativeFormXP({...native,formId:'lanternkin-2'})),'two');
  assert.equal(resolveCosmeticId(rows,'lanternkin',nativeFormXP({...native,formId:'lanternkin-3'})),'three');
});
test('retarget preserves actual original payloads and validates each new form archive',async()=>{
  for(const form of [1,2,3]){
    const result=await retargetLocal3dPack(original,form),mod=await validatePackage(buf(result.zip));
    assert.equal(mod.manifest.form,form);assert.notEqual(mod.manifest.id,legacy.manifest.id);
    for(const [key,data] of legacy.files)if(key!=='manifest.json')assert.deepEqual(mod.files.get(key),data);
    assert.deepEqual(mod.stats,legacy.stats);
  }
  await assert.rejects(()=>retargetLocal3dPack(original,4),/form/);
  await assert.rejects(()=>retargetLocal3dPack(Buffer.from('invalid'),1));
});
