// Offline authoring: retain validated model bytes and license, add an exact form target.
import { readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validatePackage } from '../src/client/mods/archive.mjs';
import { LIMITS } from '../src/client/mods/format.mjs';
import { makeZip } from './cosmetic-zip.mjs';

const bytes = b => b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const repo = fileURLToPath(new URL('../',import.meta.url));
export async function retargetLocal3dPack(input,form) {
  if (![1,2,3].includes(form)) throw Error('Specify evolution form 1, 2 or 3');
  const original = await validatePackage(bytes(input));
  // IDs change so an existing installed species-wide pack is never overwritten.
  const manifest = {...original.manifest, id:original.manifest.id.slice(0,61)+`-f${form}`, form};
  const zip = makeZip([['manifest.json',Buffer.from(JSON.stringify(manifest))],
    ...[...original.files].filter(([name])=>name!=='manifest.json').map(([name,data])=>[name,Buffer.from(data)])]);
  const verified = await validatePackage(bytes(zip));
  return {zip,manifest:verified.manifest,stats:verified.stats};
}
async function main() {
  const args=process.argv.slice(2),check=args.includes('--check');
  const [input,output,form,...extra]=args.filter(a=>a!=='--check');
  if(!input||!output||!form||extra.length||!['1','2','3'].includes(form))throw Error('Usage: node scripts/retarget-local-3d-pack.mjs <input.mmcosmetic> <output.mmcosmetic> <1|2|3> [--check]');
  const src=await realpath(input),dest=resolve(output),parent=await realpath(dirname(dest));
  const rel=relative(await realpath(repo),parent);
  if(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+(process.platform==='win32'?'\\':'/')))throw Error('Keep output outside the repository.');
  if(extname(dest).toLowerCase()!=='.mmcosmetic')throw Error('Output must end in .mmcosmetic');
  const st=await stat(src);if(!st.isFile()||st.size>LIMITS.archive)throw Error('Invalid or oversized input pack');
  const result=await retargetLocal3dPack(await readFile(src),Number(form));
  console.log('Importer validation passed:',result.manifest.id,'form',result.manifest.form,JSON.stringify(result.stats));
  if(!check){await writeFile(dest,result.zip,{flag:'wx'});console.log('Created '+dest);}else console.log('Check only; no file written.');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(e=>{console.error(e.message);process.exitCode=1;});
