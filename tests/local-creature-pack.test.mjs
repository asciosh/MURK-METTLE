import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, copyFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { buildLocalCreaturePack } from '../scripts/build-local-creature-pack.mjs';
import { validateSpritePack, resolveSpriteEntry } from '../src/nextgen/modding/sprite-pack.mjs';
import { validatePackage } from '../src/client/mods/archive.mjs';
const buffer=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const meta={id:'workshop-test',name:'Workshop original test',version:'1.0.0',author:'MURK & METTLE',license:'CC0-1.0',rights:'original',attribution:'Original assets from project demo, test only.'};
async function folder(t) {
  const dir=await mkdtemp(join(process.cwd(),'pack-test-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  await copyFile(new URL('../examples/creature-mods/copperbloom/LICENSE.txt',import.meta.url),join(dir,'LICENSE.txt'));
  return dir;
}
test('workshop maps supplied PNG to distinct evolution forms and produces a valid browser pack',async t=>{
  const dir=await folder(t),demo=await validateSpritePack(buffer(await readFile(new URL('../public/mod-examples/nextgen-sprite-demo.mmcreatures',import.meta.url))));
  await writeFile(join(dir,'one.png'),demo.files.get('sprites/lanternkin.png'));
  await writeFile(join(dir,'pack.json'),JSON.stringify({...meta,type:'sprite',entries:[{key:'lanternkin',file:'one.png'},{key:'lanternkin-2',file:'one.png',columns:4,rows:2,animations:{idle:{start:0,count:2,fps:3}}}]}));
  const result=await buildLocalCreaturePack(dir);assert.equal(result.extension,'.mmcreatures');assert.equal(result.stats.appearances,2);
  const verified=await validateSpritePack(buffer(result.zip));assert.equal(resolveSpriteEntry(verified.manifest,'lanternkin',120).key,'lanternkin-2');
});
test('workshop builds validated GLB cosmetic without modifying source GLB',async t=>{
  const dir=await folder(t),source=new URL('../examples/creature-mods/copperbloom/',import.meta.url);
  await copyFile(new URL('model.glb',source),join(dir,'model.glb'));await copyFile(new URL('icon.png',source),join(dir,'icon.png'));
  const original=await readFile(join(dir,'model.glb'));
  await writeFile(join(dir,'pack.json'),JSON.stringify({...meta,type:'glb',species:'lanternkin',model:'model.glb',icon:'icon.png',animations:{idle:'Breathe',walk:'Rustle',pulse:'Unfurl'}}));
  const result=await buildLocalCreaturePack(dir);assert.equal(result.extension,'.mmcosmetic');assert.equal((await validatePackage(buffer(result.zip))).manifest.species,'lanternkin');
  assert.deepEqual(await readFile(join(dir,'model.glb')),original);
  await writeFile(join(dir,'pack.json'),JSON.stringify({...meta,type:'glb',species:'lanternkin',form:3,model:'model.glb'}));
  const staged=await buildLocalCreaturePack(dir);assert.equal((await validatePackage(buffer(staged.zip))).manifest.form,3);
});
test('workshop rejects traversal, unverified rights, gameplay fields, invalid image and missing license',async t=>{
  const dir=await folder(t),config={...meta,type:'sprite',entries:[{key:'lanternkin',file:'art.png'}]};
  await writeFile(join(dir,'art.png'),Buffer.from('not a png'));
  const verify=async (data,regex)=>{await writeFile(join(dir,'pack.json'),JSON.stringify(data));await assert.rejects(()=>buildLocalCreaturePack(dir),regex);};
  await verify({...config,entries:[{key:'lanternkin',file:'../art.png'}]},/path/i);
  await verify({...config,rights:'unknown'},/rights/i);
  await verify({...config,entries:[{key:'lanternkin',file:'art.png',damage:1000}]},/field/i);
  await verify(config,/PNG/i);
  await rm(join(dir,'LICENSE.txt'));await verify(config,/ENOENT/);
});
