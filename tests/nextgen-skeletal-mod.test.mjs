import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePackage } from '../src/client/mods/archive.mjs';
import { rigPack, asArrayBuffer } from '../scripts/build-rigged-cosmetic-demo.mjs';

const validate = change => validatePackage(asArrayBuffer(rigPack(change)));
const offset = (g,a) => g.bufferViews[g.accessors[a].bufferView].byteOffset;
test('original two-joint rig validates in the actual cosmetic ZIP/GLB pipeline', async () => {
  const validated=await validate();
  assert.equal(validated.manifest.animations.attack,'Strike');
  assert.equal(validated.stats.triangles,16);
  assert.ok(validated.stats.radius>0 && validated.stats.radius<2);
});
test('skeletal validation rejects malformed and excessive rigs', async () => {
  for (const [name,change] of [
    ['duplicate joints',g=>g.skins[0].joints=[1,1]],
    ['multiple skins',g=>g.skins.push(g.skins[0])],
    ['missing skeleton',g=>delete g.skins[0].skeleton],
    ['invalid joint',g=>g.skins[0].joints=[1,99]],
    ['oversized joint list',g=>g.skins[0].joints=Array(33).fill(1)],
    ['invalid inverse bind',g=>g.skins[0].inverseBindMatrices=0],
    ['scaled inverse bind',(g,b)=>b.writeFloatLE(5,offset(g,g.skins[0].inverseBindMatrices))],
    ['excessive inverse translation',(g,b)=>b.writeFloatLE(99,offset(g,g.skins[0].inverseBindMatrices)+48)],
    ['missing weights',g=>delete g.meshes[0].primitives[0].attributes.WEIGHTS_0],
    ['out of range joint',(g,b)=>b.writeUInt8(99,offset(g,g.meshes[0].primitives[0].attributes.JOINTS_0))],
    ['unnormalized weights',(g,b)=>b.writeFloatLE(.1,offset(g,g.meshes[0].primitives[0].attributes.WEIGHTS_0))],
    ['negative weight',(g,b)=>b.writeFloatLE(-1,offset(g,g.meshes[0].primitives[0].attributes.WEIGHTS_0))],
    ['skin on wrong node',g=>g.nodes[1].skin=0],
    ['missing node skin',g=>delete g.nodes[0].skin],
    ['moving skin root',g=>g.nodes[0].translation=[1,0,0]],
    ['scaled bone',g=>g.nodes[2].scale=[2,1,1]],
    ['out of tree joint',g=>{g.nodes[1].children=[];g.scenes[0].nodes.push(2);}],
    ['root motion',g=>g.animations[0].channels[0].target.path='translation'],
    ['mesh rotation track',g=>g.animations[0].channels[0].target.node=0],
    ['untrusted extensions',g=>g.extensionsUsed=['KHR_draco_mesh_compression']],
  ]) await assert.rejects(()=>validate(change),Error,name);
});
