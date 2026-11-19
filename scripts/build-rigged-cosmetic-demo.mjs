// Original two-joint test rig; no third-party geometry, clips or textures.
import { makeZip } from './cosmetic-zip.mjs';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { validatePackage } from '../src/client/mods/archive.mjs';

export const rigManifest = {
  formatVersion: 1, id: 'mm-articulated-demo', name: 'Articulated Demo', version: '1.0.0',
  author: 'MURK & METTLE', license: 'CC0-1.0', rights: 'original',
  attribution: 'Original procedural two-joint demonstration geometry and animation.',
  compatibility: 'creature-cosmetics-v1', species: 'lanternkin', model: 'model.glb',
  animations: { idle: 'Idle', walk: 'Walk', attack: 'Strike', pulse: 'Pulse' },
};
export const asArrayBuffer = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

export function rigGLB(change = () => {}) {
  const gltf = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0, 1] }],
    nodes: [{ name: 'Body', mesh: 0, skin: 0 }, { name: 'RootBone', children: [2] },
      { name: 'TipBone', translation: [0, 0.25, 0] }],
    buffers: [{ byteLength: 0 }], bufferViews: [], accessors: [],
    meshes: [], materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.1, 0.72, 0.46, 1], roughnessFactor: 0.8, metallicFactor: 0 } }],
    skins: [], animations: [] };
  const chunks = [];
  let offset = 0;
  const add = (values, type, componentType = 5126) => {
    const n = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[type];
    const b = Buffer.alloc(values.length * (componentType === 5121 ? 1 : 4));
    values.forEach((v, i) => componentType === 5121 ? b.writeUInt8(v, i) : b.writeFloatLE(v, i * 4));
    const pad = Buffer.alloc((4 - b.length % 4) % 4);
    const bufferView = gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: b.length }) - 1;
    chunks.push(b, pad); offset += b.length + pad.length;
    return gltf.accessors.push({ bufferView, type, componentType, count: values.length / n }) - 1;
  };
  const positions = [], jointIndices = [], weights = [], normals = [];
  // Two octahedra; lower body and articulated upper fin joined at y=.25.
  for (const [y, ry, rx, bone] of [[0, .3, .26, 0], [.37, .31, .19, 1]]) {
    const points = [[rx,y,0],[0,y,rx],[-rx,y,0],[0,y,-rx],[0,y+ry,0],[0,y-ry,0]];
    for (let i=0; i<4; i++) for (const tri of [[4,(i+1)%4,i],[5,i,(i+1)%4]]) {
      const [a,b,c]=tri.map(k=>points[k]);
      const u=b.map((v,j)=>v-a[j]),v=c.map((x,j)=>x-a[j]);
      const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      const len=Math.hypot(...n);
      for (const k of tri) { positions.push(...points[k]); normals.push(...n.map(x=>x/len)); jointIndices.push(bone,0,0,0); weights.push(1,0,0,0); }
    }
  }
  const position = add(positions,'VEC3');
  gltf.accessors[position].min=[-.26,-.3,-.26]; gltf.accessors[position].max=[.26,.68,.26];
  gltf.meshes.push({ primitives: [{ attributes: { POSITION: position, NORMAL: add(normals,'VEC3'), JOINTS_0: add(jointIndices,'VEC4',5121), WEIGHTS_0: add(weights,'VEC4') }, material: 0 }] });
  const identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const inverse = [...identity]; inverse[13] = -.25;
  gltf.skins.push({ skeleton: 1, joints: [1,2], inverseBindMatrices: add([...identity,...inverse],'MAT4') });
  for (const [name, angle, end] of [['Idle',.13,1],['Walk',.55,.5],['Strike',1.1,.45],['Pulse',.85,.65]]) {
    const input = add([0,end/2,end],'SCALAR');
    gltf.accessors[input].min=[0]; gltf.accessors[input].max=[end];
    const output = add([0,0,0,1,0,0,Math.sin(angle/2),Math.cos(angle/2),0,0,0,1],'VEC4');
    gltf.animations.push({ name, samplers: [{ input, output, interpolation:'LINEAR' }], channels: [{ sampler:0, target:{ node:2, path:'rotation' } }] });
  }
  gltf.buffers[0].byteLength=offset;
  const bin=Buffer.concat(chunks);
  change(gltf,bin);
  const raw=Buffer.from(JSON.stringify(gltf));
  const json=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]);
  const h=Buffer.alloc(20), b=Buffer.alloc(8);
  h.writeUInt32LE(0x46546c67); h.writeUInt32LE(2,4); h.writeUInt32LE(28+json.length+bin.length,8);
  h.writeUInt32LE(json.length,12); h.writeUInt32LE(0x4e4f534a,16);
  b.writeUInt32LE(bin.length); b.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([h,json,b,bin]);
}
export function rigPack(change, manifest = rigManifest) {
  return makeZip([['manifest.json',Buffer.from(JSON.stringify(manifest))],
    ['LICENSE.txt',Buffer.from('CC0-1.0: original procedural demo; https://creativecommons.org/publicdomain/zero/1.0/')],
    ['model.glb',rigGLB(change)]]);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output=process.argv[2];
  if (!output?.endsWith('.mmcosmetic')) throw Error('Usage: node scripts/build-rigged-cosmetic-demo.mjs OUTPUT.mmcosmetic');
  const zip=rigPack(); await validatePackage(asArrayBuffer(zip));
  writeFileSync(output,zip,{flag:'wx'}); console.log('Created validated original rig demo: '+output);
}
