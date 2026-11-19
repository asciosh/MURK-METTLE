// Deterministic original pixel-art test fixture; no third-party art or game rips.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { crc32 } from '../src/client/mods/format.mjs';
import { makeZip } from './cosmetic-zip.mjs';

function chunk(name, bytes) {
  const type = Buffer.from(name), data = Buffer.concat([type, bytes]);
  const size = Buffer.alloc(4), crc = Buffer.alloc(4); size.writeUInt32BE(bytes.length); crc.writeUInt32BE(crc32(data));
  return Buffer.concat([size, data, crc]);
}
function sheet(palette, fins) {
  const cell = 32, width = cell * 4, height = cell * 2, stride = 1 + width * 4;
  const raw = Buffer.alloc(stride * height);
  for (let frame = 0; frame < 8; frame++) {
    const ox = frame % 4 * cell, oy = Math.floor(frame / 4) * cell;
    const dy = frame % 2, attack = frame === 4 || frame === 5, pulse = frame >= 6;
    const put = (x, y, rgb) => { if (x < 0 || x >= cell || y < 0 || y >= cell) return; const i = (oy+y)*stride+1+(ox+x)*4; raw[i]=rgb[0]; raw[i+1]=rgb[1]; raw[i+2]=rgb[2]; raw[i+3]=255; };
    const ellipse = (cx, cy, rx, ry, rgb) => { for (let y=0;y<cell;y++) for (let x=0;x<cell;x++) if (((x-cx)/rx)**2+((y-cy)/ry)**2 <= 1) put(x,y,rgb); };
    const edge = [27,40,36], light = palette.map(v=>Math.min(255,v+40));
    ellipse(16, 21-dy, 11, 9, edge); ellipse(16, 21-dy, 10, 8, palette);
    ellipse(9,28,4,3,edge); ellipse(23,28,4,3,edge);
    ellipse(16+(attack?2:0), 13-dy, 9, 7, edge); ellipse(16+(attack?2:0), 13-dy,8,6,light);
    for (const side of [-1,1]) { ellipse(16+side*6, 6-dy, 3, fins, edge); ellipse(16+side*6, 6-dy, 2,Math.max(2,fins-1),palette); }
    for (const x of [13,19]) { ellipse(x+(attack?2:0),13-dy,2,2,edge); put(x+(attack?2:0),12-dy,[244,252,240]); }
    ellipse(16,22-dy,pulse?5:3,pulse?5:3,pulse?[255,240,136]:[205,247,193]);
  }
  const header=Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height,4); header[8]=8; header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const variants = [ ['lanternkin',[79,157,119],4], ['lanternkin-2',[53,150,171],5], ['lanternkin-3',[116,87,196],7], ['emberling',[213,115,64],4] ];
const animations = { idle:{start:0,count:2,fps:3}, walk:{start:2,count:2,fps:9}, attack:{start:4,count:2,fps:6}, pulse:{start:6,count:2,fps:4} };
const manifest = { formatVersion:2, compatibility:'nextgen-sprite-pack-v2', id:'nextgen-original-sprite-demo', name:'Original Pixel Companions', version:'1.0.0', author:'Murk & Mettle', license:'CC0-1.0', rights:'original', attribution:'Original procedurally drawn pixel art, CC0-1.0. Generator: scripts/build-nextgen-sprite-demo.mjs.', entries:variants.map(([key])=>({ key, sprite:`sprites/${key}.png`,columns:4,rows:2,height:1.1,animations })) };
const files=[['manifest.json',Buffer.from(JSON.stringify(manifest,null,2))],['LICENSE.txt',Buffer.from('Original procedural art dedicated to the public domain under CC0 1.0.\nhttps://creativecommons.org/publicdomain/zero/1.0/\n')],...variants.map(([key,palette,fins])=>[`sprites/${key}.png`,sheet(palette,fins)])];
const zip=makeZip(files);
writeFileSync(new URL('../public/mod-examples/nextgen-sprite-demo.mmcreatures',import.meta.url),zip);
console.log(`Original sprite demo written: ${variants.length} entries, ${zip.length} bytes.`);
