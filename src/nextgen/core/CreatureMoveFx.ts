import * as THREE from 'three/webgpu';
import type { LocalMove } from '../../../shared/local-creature-moves.mjs';
type Position=readonly [number,number,number];
const COLORS:Record<string,number>={normal:0xffe1b7,neutral:0xffe1b7,grass:0x73ed58,fire:0xff743a,water:0x51bbff,electric:0xffdc55,ice:0x9ceeff,poison:0xba67de,psychic:0xf48cca};
/** Reusable presentation slots; no asset downloads or effect code in pack data. */
export class CreatureMoveFx {
  readonly root=new THREE.Group();
  private readonly geometry=new THREE.IcosahedronGeometry(1,0);
  private readonly slots=Array.from({length:24},()=>{
    const material=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,toneMapped:false});
    const mesh=new THREE.Mesh(this.geometry,material);mesh.visible=false;this.root.add(mesh);
    return {mesh,from:new THREE.Vector3(),to:new THREE.Vector3(),ms:0,duration:1,effect:'impact' as LocalMove['effect'],phase:0};
  });
  private next=0;
  play(move:LocalMove,from:Position,to:Position):void {
    const count=move.effect==='sleep'?7:move.effect==='projectile'?4:1;
    for(let i=0;i<count;i++){
      const s=this.slots[this.next++%this.slots.length];s.effect=move.effect;s.phase=i;
      s.from.set(from[0],from[1]+.55,from[2]);s.to.set(to[0],to[1]+1,to[2]);
      if(move.effect==='drain'){const a=s.from.clone();s.from.copy(s.to);s.to.copy(a);}
      if(move.effect==='sleep'){s.to.x+=Math.cos(i*2.4)*.65;s.to.z+=Math.sin(i*2.4)*.65;s.to.y+=.2*(i%3);}
      s.duration=s.ms=move.effect==='sleep'?850:move.effect==='beam'?400:move.effect==='projectile'?360:300;
      s.mesh.material.color.setHex(move.effect==='sleep'?0xd8b3ee:COLORS[move.type]??0xc1e5f9);s.mesh.material.opacity=.85;s.mesh.visible=true;
      s.mesh.position.copy(s.from);s.mesh.scale.setScalar(.12);
    }
  }
  update(dt:number):void {
    for(const s of this.slots){if(!s.ms)continue;s.ms=Math.max(0,s.ms-Math.max(0,Math.min(100,dt)));const t=1-s.ms/s.duration;
      s.mesh.visible=s.ms>0;s.mesh.material.opacity=.9*(1-t*.8);
      if(s.effect==='beam'||s.effect==='lash'){
        s.mesh.position.copy(s.from).lerp(s.to,.5);s.mesh.lookAt(s.to);s.mesh.scale.set(s.effect==='beam'?.16:.055,s.effect==='beam'?.16:.055,s.from.distanceTo(s.to)*.55);
      }else if(s.effect==='sleep'){
        s.mesh.position.copy(s.to);s.mesh.position.y+=t*.4;s.mesh.scale.setScalar(.13+t*.3);
      }else if(s.effect==='impact'){
        s.mesh.position.copy(s.to);s.mesh.scale.setScalar(.1+t*.45);
      }else{
        s.mesh.position.copy(s.from).lerp(s.to,t);s.mesh.position.y+=Math.sin(t*Math.PI)*.25;
        s.mesh.rotation.set(t*8+s.phase,0,t*5);s.mesh.scale.set(s.effect==='projectile'?.20:.1,.035,.12);
      }
    }
  }
  reset():void {for(const s of this.slots){s.ms=0;s.mesh.visible=false;}}
  dispose():void {this.reset();this.root.removeFromParent();for(const s of this.slots)s.mesh.material.dispose();this.geometry.dispose();this.root.clear();}
}
