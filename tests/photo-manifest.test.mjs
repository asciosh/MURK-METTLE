import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile(new URL('../src/client/game/photo-surfaces.json',import.meta.url),'utf8'));
test('optional photo materials retain bounded dimensions, download budget and pinned source provenance',()=>{
 let total=0;
 assert.equal(Object.keys(manifest).length,4);
 for(const asset of Object.values(manifest)){
  assert.equal(asset.license,'CC0-1.0');assert.equal(new URL(asset.source).origin,'https://polyhaven.com');assert.equal(asset.maps.length,3);
  for(const map of asset.maps){assert.equal(new URL(map.url).origin,'https://dl.polyhaven.org');assert.match(map.integrity,/^sha256-[A-Za-z0-9+/]{43}=$/);assert.ok(map.width<=1024&&map.height<=1024);assert.ok(map.bytes>0&&map.bytes<=3_000_000);total+=map.bytes;}
 }
 assert.ok(total<=12_000_000,'online photo mode must remain under the documented 12 MB budget');
});
