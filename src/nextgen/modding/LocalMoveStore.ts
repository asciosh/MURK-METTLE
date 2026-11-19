import { validateMovePack, type LocalMovePack, type LocalMoveProfile } from '../../../shared/local-creature-moves.mjs';
const KEY='mm-nextgen-local-moves-v1';
const LIMIT=64*1024;
export function readLocalMovePack():LocalMovePack|null {
  try{const raw=localStorage.getItem(KEY);return raw&&raw.length<=LIMIT?validateMovePack(JSON.parse(raw)):null;}catch{return null;}
}
export async function importLocalMovePack(file:File):Promise<LocalMovePack>{
  if(file.size>LIMIT)throw Error('Move pack exceeds 64 KB');
  const pack=validateMovePack(JSON.parse(await file.text()));
  saveLocalMovePack(pack);return pack;
}
export function saveLocalMovePack(pack:LocalMovePack):void {
  const checked=validateMovePack(pack),raw=JSON.stringify(checked);
  if(raw.length>LIMIT)throw Error('Move pack exceeds 64 KB');localStorage.setItem(KEY,raw);
}
export function clearLocalMovePack():void {localStorage.removeItem(KEY);}
export function selectLocalMoveProfile(pack:LocalMovePack|null,appearanceId:string|undefined):LocalMoveProfile|null {
  return pack?.profiles.find(p=>p.appearanceId===appearanceId)??null;
}
