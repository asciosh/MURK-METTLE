import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeZip } from '../scripts/cosmetic-zip.mjs';
import { validateSpritePack, validateSpriteManifest, resolveSpriteEntry, spriteFrame, SPRITE_PACK_LIMITS } from '../src/nextgen/modding/sprite-pack.mjs';
import { validatePackage, readArchive } from '../src/client/mods/archive.mjs';
const raw = readFileSync(new URL('../public/mod-examples/nextgen-sprite-demo.mmcreatures', import.meta.url));
const bytes = b => b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const demo = await validateSpritePack(bytes(raw));
const make = manifest => bytes(makeZip([['manifest.json',Buffer.from(JSON.stringify(manifest))],['LICENSE.txt',Buffer.from('Original CC0 art')],...[...new Set(manifest.entries.map(e=>e.sprite))].map(name=>[name,demo.files.get('sprites/lanternkin.png')])]));

test('original demo validates; exact evolved form wins and absent forms fall back', async () => {
  assert.equal(demo.manifest.entries.length, 4);
  assert.equal(resolveSpriteEntry(demo.manifest,'lanternkin',120).key,'lanternkin-2');
  assert.equal(resolveSpriteEntry(demo.manifest,'lanternkin',400).key,'lanternkin-3');
  assert.equal(resolveSpriteEntry(demo.manifest,'emberling',400).key,'emberling');
  assert.equal(resolveSpriteEntry(demo.manifest,'stormrook',0),undefined);
  await assert.rejects(()=>validatePackage(bytes(raw)),/format|manifest/i);
});
test('a 100-entry pack with unique images fits the separate bounded v2 importer', async () => {
  const manifest={...demo.manifest,entries:Array.from({length:100},(_,i)=>({...demo.manifest.entries[0],key:`creature-${i}`,sprite:`sprites/c${i}.png`}))};
  const archive=make(manifest);
  assert.equal((await validateSpritePack(archive)).manifest.entries.length,100);
  await assert.rejects(()=>readArchive(archive),/file count/);
});
test('v2 denies gameplay, executable or unsafe fields, malformed frame layouts and duplicate keys', async () => {
  const base=demo.manifest, entry=base.entries[0];
  for (const invalid of [{...entry,damage:999},{...entry,sprite:'../sprite.png'},{...entry,height:100},{...entry,animations:{idle:{start:0,count:99,fps:10}}},{...entry,animations:{idle:{start:0,count:1,fps:99}}}]) {
    assert.throws(()=>validateSpriteManifest({...base,entries:[invalid]}));
  }
  assert.throws(()=>validateSpriteManifest({...base,entries:[entry,entry]}));
  assert.throws(()=>validateSpriteManifest({...base,entries:Array.from({length:129},(_,i)=>({...entry,key:`creature-${i}`}))}));
  assert.throws(()=>validateSpriteManifest({...base,license:'unverified'}));
  await assert.rejects(()=>validateSpritePack(make({...base,entries:[{...entry,columns:3,animations:{idle:entry.animations.idle}}]})),/divide/);
  await assert.rejects(()=>validateSpritePack(new ArrayBuffer(SPRITE_PACK_LIMITS.archive+1)),/exceeds/);
  const undeclared=bytes(makeZip([...demo.files,['extra.txt',Buffer.from('not declared')]]));
  await assert.rejects(()=>validateSpritePack(undeclared),/Undeclared/);
});
test('animation uses row-major frame order, looping and one-shot bounded playback',()=>{
  const entry=demo.manifest.entries[0];
  assert.deepEqual(spriteFrame(entry,'idle',0),{column:0,row:0});
  assert.deepEqual(spriteFrame(entry,'walk',0.12),{column:3,row:0});
  assert.deepEqual(spriteFrame(entry,'attack',99,false),{column:1,row:1});
  assert.deepEqual(spriteFrame(entry,'faint',0),{column:0,row:0});
});
