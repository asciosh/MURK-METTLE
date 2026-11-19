// Author-side packing only. The browser still independently validates every import.
import { readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeZip } from './cosmetic-zip.mjs';
import { object, path as safePath, LIMITS, validateManifest } from '../src/client/mods/format.mjs';
import { validatePackage } from '../src/client/mods/archive.mjs';
import { SPRITE_PACK_LIMITS, validateSpriteManifest, validateSpritePack } from '../src/nextgen/modding/sprite-pack.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const within = (root, target) => {const p=relative(root,target);return !isAbsolute(p) && p!=='..' && !p.startsWith('..'+(process.platform==='win32'?'\\':'/'));};
const asBuffer = data => data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
const metaKeys = ['id','name','version','author','license','rights','attribution'];

/** Build from explicit local inputs, never downloads or extracts external archives. */
export async function buildLocalCreaturePack(sourceDir) {
  const root=await realpath(sourceDir);let total=0;
  async function read(name, limit) {
    safePath(name);const target=await realpath(resolve(root,name));
    if(!within(root,target))throw Error('Source file escapes pack folder: '+name);
    const info=await stat(target);if(!info.isFile()||info.size<1||info.size>limit)throw Error('Missing, empty or oversized source file: '+name);
    total+=info.size;if(total>SPRITE_PACK_LIMITS.extracted)throw Error('Source pack exceeds expanded size budget');
    return readFile(target);
  }
  const config=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await read('pack.json',131072)));
  if(!config||!['sprite','glb'].includes(config.type))throw Error('pack.json type must be sprite or glb');
  const sprite=config.type==='sprite';
  object(config,['type',...metaKeys,...(sprite?['entries']:['species','form','model','icon','animations','effects'])],'pack source');
  const common=Object.fromEntries(metaKeys.map(key=>[key,config[key]]));
  const license=await read('LICENSE.txt',32768), files=[];
  let manifest;
  if(sprite){
    if(!Array.isArray(config.entries)||config.entries.length<1||config.entries.length>128)throw Error('Provide 1–128 mapped sprite entries');
    manifest={...common,formatVersion:2,compatibility:'nextgen-sprite-pack-v2',entries:config.entries.map((row,i)=>{
      object(row,['key','file','columns','rows','height','animations'],'sprite source');
      if(!safePath(row.file).toLowerCase().endsWith('.png'))throw Error('Sprite source must be PNG');
      return {key:row.key,sprite:`sprites/appearance-${i}.png`,columns:row.columns??1,rows:row.rows??1,height:row.height??1.1,animations:row.animations??{idle:{start:0,count:1,fps:1}}};
    })};
    validateSpriteManifest(manifest);
    for(let i=0;i<config.entries.length;i++)files.push([manifest.entries[i].sprite,await read(config.entries[i].file,LIMITS.image)]);
  }else{
    if(!safePath(config.model).toLowerCase().endsWith('.glb'))throw Error('Use a self-contained GLB, not FBX or OBJ');
    manifest={...common,formatVersion:1,compatibility:'creature-cosmetics-v1',species:config.species,...(config.form!==undefined?{form:config.form}:{}),model:'model.glb',...(config.icon?{icon:'icon.png'}:{}),...(config.animations?{animations:config.animations}:{}),...(config.effects?{effects:config.effects}:{})};
    validateManifest(manifest);
    files.push(['model.glb',await read(config.model,LIMITS.model)]);
    if(config.icon){if(!safePath(config.icon).toLowerCase().endsWith('.png'))throw Error('Icon must be PNG');files.push(['icon.png',await read(config.icon,LIMITS.image)]);}
  }
  const zip=makeZip([['manifest.json',Buffer.from(JSON.stringify(manifest))],['LICENSE.txt',license],...files]);
  const verified=await (sprite?validateSpritePack:validatePackage)(asBuffer(zip));
  const extension=sprite?'.mmcreatures':'.mmcosmetic';
  return {zip,extension,manifest:verified.manifest,stats:sprite?{appearances:verified.manifest.entries.length,pixels:verified.pixels}:verified.stats};
}

async function main() {
  const args=process.argv.slice(2),check=args.includes('--check');
  const [source,output,...extra]=args.filter(arg=>arg!=='--check');
  if(!source||!output||extra.length)throw Error('Usage: node scripts/build-local-creature-pack.mjs <source-folder> <output-file> [--check]');
  const outputPath=resolve(output), parent=await realpath(dirname(outputPath));
  if(within(await realpath(repository),parent))throw Error('Keep generated packs outside the repository (e.g. AssetWorkshop/CreaturePacks).');
  const result=await buildLocalCreaturePack(source);
  if(extname(outputPath).toLowerCase()!==result.extension)throw Error('Output extension must be '+result.extension);
  console.log('Importer validation passed:',JSON.stringify(result.stats));
  if(!check){await writeFile(outputPath,result.zip,{flag:'wx'});console.log('Created '+outputPath);}
  else console.log('Check only; no file written.');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(e=>{console.error(e.message);process.exitCode=1;});
