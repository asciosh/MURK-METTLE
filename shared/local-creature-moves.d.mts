export type MoveEffect='impact'|'lash'|'projectile'|'sleep'|'drain'|'beam';
export type MovePose='attack'|'pulse'|'cast'|'charge'|'heal';
export interface LocalMove {id:string;name:string;type:string;effect:MoveEffect;pose:MovePose;damage:number;range:number;targets:number;cooldownMs:number;windupMs:number;statusMs:number;healPercent:number;}
export interface LocalMoveProfile {appearanceId:string;name:string;moves:LocalMove[];equipped:string[];}
export interface LocalMovePack {format:'mm-local-moves-v1';profiles:LocalMoveProfile[];}
export type MoveHud={id:string;name:string;type:string;remaining:number;casting:boolean};
export const MOVE_EFFECTS:readonly MoveEffect[];
export const MOVE_POSES:readonly MovePose[];
export function validateMovePack(raw:unknown):LocalMovePack;
export class MoveDeck {constructor(profile:LocalMoveProfile);readonly profile:LocalMoveProfile;readonly slots:LocalMove[];readonly pending:{move:LocalMove;remaining:number}|null;readonly recovery:number;begin(slot:number):LocalMove|null;tick(delta:number):LocalMove|null;cancel():void;hud():MoveHud[];}
