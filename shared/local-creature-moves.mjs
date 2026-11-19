// Local solo practice data only. Never accept this profile in an authoritative room.
export const MOVE_EFFECTS = Object.freeze(['impact','lash','projectile','sleep','drain','beam']);
export const MOVE_POSES = Object.freeze(['attack','pulse','cast','charge','heal']);
const TYPES = ['neutral','normal','fire','water','grass','electric','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];
const id = value => typeof value==='string' && /^[-a-z0-9]{1,64}$/.test(value) && !['__proto__','constructor','prototype'].includes(value);
const label = value => typeof value==='string' && value.trim() && value.length<=64 && !/[\u0000-\u001f\u007f]/.test(value);
const int = (v,lo,hi) => Number.isInteger(v)&&v>=lo&&v<=hi;
const shape = (v,keys) => v && typeof v==='object' && !Array.isArray(v) && Object.keys(v).every(k=>keys.includes(k));
const fail = msg => { throw Error(msg); };

export function validateMovePack(raw) {
  if(!shape(raw,['format','profiles'])||raw.format!=='mm-local-moves-v1'||!Array.isArray(raw.profiles)||!raw.profiles.length||raw.profiles.length>8)fail('Expected a local moves pack with 1–8 profiles');
  const seen=new Set();
  const profiles=raw.profiles.map(p=>{
    if(!shape(p,['appearanceId','name','moves','equipped'])||!id(p.appearanceId)||!label(p.name)||seen.has(p.appearanceId)||!Array.isArray(p.moves)||p.moves.length<1||p.moves.length>24)fail('Invalid or duplicate appearance profile');
    seen.add(p.appearanceId);
    const ids=new Set();
    const moves=p.moves.map(m=>{
      if(!shape(m,['id','name','type','effect','pose','damage','range','targets','cooldownMs','windupMs','statusMs','healPercent'])||!id(m.id)||!label(m.name)||ids.has(m.id)||!TYPES.includes(m.type)||!MOVE_EFFECTS.includes(m.effect)||!MOVE_POSES.includes(m.pose)||!int(m.damage,0,75)||!Number.isFinite(m.range)||m.range<1||m.range>12||!int(m.targets,1,4)||!int(m.cooldownMs,800,45000)||!int(m.windupMs,0,2500)||m.cooldownMs<m.windupMs+500||!int(m.statusMs,0,5000)||!int(m.healPercent,0,50))fail('Invalid move data');
      if((m.effect==='sleep')!==(m.statusMs>0)||(m.effect==='drain')!==(m.healPercent>0)||(!m.damage&&m.effect!=='sleep'))fail('Invalid move effect parameters');
      ids.add(m.id);return {...m};
    });
    if(!Array.isArray(p.equipped)||!p.equipped.length||p.equipped.length>4||new Set(p.equipped).size!==p.equipped.length||p.equipped.some(k=>!ids.has(k)))fail('Equip 1–4 distinct moves from this profile');
    return {appearanceId:p.appearanceId,name:p.name,moves,equipped:[...p.equipped]};
  });
  return {format:'mm-local-moves-v1',profiles};
}

/** Simulation-clock cooldowns, one active cast, no damage until windup resolves. */
export class MoveDeck {
  constructor(profile){this.profile=profile;this.cooldowns=new Map();this.pending=null;this.recovery=0;}
  get slots(){return this.profile.equipped.map(id=>this.profile.moves.find(m=>m.id===id));}
  begin(slot){const m=this.slots[slot];if(!m||this.pending||this.recovery||this.cooldowns.get(m.id)>0)return null;
    this.cooldowns.set(m.id,m.cooldownMs);this.pending={move:m,remaining:m.windupMs};return m;}
  tick(delta){const dt=Number.isFinite(delta)?Math.max(0,Math.min(100,delta)):0;
    for(const [id,n] of this.cooldowns)this.cooldowns.set(id,Math.max(0,n-dt));
    this.recovery=Math.max(0,this.recovery-dt);
    if(!this.pending)return null;
    this.pending.remaining=Math.max(0,this.pending.remaining-dt);
    if(this.pending.remaining>0)return null;
    const move=this.pending.move;this.pending=null;this.recovery=350;return move;
  }
  cancel(){this.pending=null;this.recovery=Math.max(this.recovery,350);}
  hud(){return this.slots.map(m=>({id:m.id,name:m.name,type:m.type,remaining:this.cooldowns.get(m.id)??0,casting:this.pending?.move.id===m.id}));}
}
