import * as THREE from 'three/webgpu';
import type { CompanionState } from './CompanionController.ts';

/** Original low-poly Lanternkin prototype; no imported assets or external textures. */
export class CompanionAvatar {
  readonly root=new THREE.Group();
  private readonly body=new THREE.Group();
  private readonly legs:THREE.Mesh[]=[];
  private readonly leaves:THREE.Mesh[]=[];
  private readonly geometries=new Set<THREE.BufferGeometry>();
  private readonly materials=new Set<THREE.Material>();
  private readonly glow:THREE.MeshStandardMaterial;
  private readonly ring:THREE.Mesh<THREE.RingGeometry,THREE.MeshBasicMaterial>;
  private time=0;
  private disposed=false;
  constructor(){
    this.root.name='NEXTGEN Lanternkin';this.root.add(this.body);
    const hide=new THREE.MeshStandardMaterial({color:0x527d65,roughness:.86});
    const belly=new THREE.MeshStandardMaterial({color:0xb3c1a1,roughness:.85});
    const leaf=new THREE.MeshStandardMaterial({color:0x3f6d43,roughness:.65});
    const eye=new THREE.MeshStandardMaterial({color:0x142820,roughness:.3});
    this.glow=new THREE.MeshStandardMaterial({color:0xa0f2bd,emissive:0x72e6a7,emissiveIntensity:.8,roughness:.3});
    const sphere=new THREE.SphereGeometry(1,10,7);this.geometries.add(sphere);
    const part=(mat:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{
      this.materials.add(mat);const m=new THREE.Mesh(sphere,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;this.body.add(m);return m;
    };
    part(hide,0,.38,.08,.26,.25,.38);part(belly,0,.29,-.05,.22,.15,.3);
    part(hide,0,.52,-.27,.24,.24,.23);part(belly,0,.43,-.43,.15,.11,.13);
    for(const x of [-.13,.13]){part(eye,x,.56,-.43,.052,.065,.041);part(this.glow,x,.57,-.462,.022,.028,.015);
      const fin=part(leaf,x*1.25,.72,-.24,.07,.21,.09);fin.rotation.z=-x*2;this.leaves.push(fin);}
    for(const z of [-.19,.25])for(const x of [-.17,.17])this.legs.push(part(hide,x,.17,z,.085,.16,.1));
    part(leaf,0,.37,.45,.08,.09,.2);part(this.glow,0,.67,.01,.12,.15,.12);
    const ringGeo=new THREE.RingGeometry(.9,1,40);const ringMaterial=new THREE.MeshBasicMaterial({color:0x86ffc4,transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide});
    this.geometries.add(ringGeo);this.materials.add(ringMaterial);this.ring=new THREE.Mesh(ringGeo,ringMaterial);this.ring.rotation.x=-Math.PI/2;this.ring.position.y=.12;this.ring.visible=false;this.root.add(this.ring);
  }
  update(dt:number,s:CompanionState):void {
    if(this.disposed)return;this.time+=(Number.isFinite(dt)?Math.min(100,Math.max(0,dt)):0)/1000;
    this.root.position.set(...s.position);this.root.rotation.y=Math.atan2(-s.facing[0],-s.facing[2]);
    const walk=s.moving?Math.sin(this.time*15):0;const attack=Math.sin(Math.PI*s.attackPoseMs/320);
    this.body.position.y=(s.moving?.04*Math.abs(walk):.012*Math.sin(this.time*3))+.09*attack;
    this.body.rotation.x=-.35*attack;
    this.legs.forEach((leg,i)=>leg.rotation.x=walk*(i===0||i===3?.55:-.55));
    this.leaves.forEach((leaf,i)=>leaf.rotation.z=(i===0?.3:-.3)+.12*Math.sin(this.time*4));
    this.glow.emissiveIntensity=s.pulsePoseMs>0?3:s.assist?1.3:.7;
    this.ring.visible=s.pulsePoseMs>0;
    if(this.ring.visible){const p=1-s.pulsePoseMs/650;this.ring.scale.setScalar(.4+p*s.pulseRange);this.ring.material.opacity=.65*(1-p);}
  }
  dispose():void {if(this.disposed)return;this.disposed=true;this.root.removeFromParent();this.root.clear();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());}
}
