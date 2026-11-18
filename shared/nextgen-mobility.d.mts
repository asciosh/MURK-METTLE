export const NEXTGEN_MOBILITY: Readonly<{dodgeCost:number;dodgeDuration:number;dodgeCooldown:number;dodgeSpeed:number;jumpDuration:number;jumpCooldown:number;jumpHeight:number}>;
export interface NextgenMobilityState {dodgeStarted:number;dodgeUntil:number;dodgeCooldownUntil:number;dodgeLastStep:number;dx:number;dz:number;jumpStarted:number;jumpUntil:number;jumpCooldownUntil:number}
export function newNextgenMobility(): NextgenMobilityState;
export function beginNextgenDodge(m:NextgenMobilityState,player:unknown,dx:number,dz:number,now:number):boolean;
export function beginNextgenJump(m:NextgenMobilityState,player:unknown,now:number):boolean;
export function nextgenJumpHeight(m:NextgenMobilityState|undefined,now:number):number;
export function advanceNextgenDodge(m:NextgenMobilityState,player:{hp:number;x:number;z:number},now:number,constrain:(pos:{x:number;z:number})=>{x:number;z:number}):boolean;
export function nextgenMobilitySnapshot(m:NextgenMobilityState|undefined,now:number):{dodging:boolean;airborne:boolean;jumpHeight:number};
