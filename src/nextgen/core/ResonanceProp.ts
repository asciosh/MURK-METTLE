import * as THREE from 'three/webgpu';
import type { WeaponId } from './EquipmentInventory.ts';

/** Folding energy rails. Original runtime geometry mounted on the weapon. */
export class ResonanceProp {
  readonly root=new THREE.Group();
  private readonly rails:THREE.Mesh[]=[];
  private readonly geometry:THREE.BoxGeometry;
  private readonly coreGeometry:THREE.OctahedronGeometry;
  private readonly material:THREE.MeshStandardMaterial;
  private amount=0;
  private disposed=false;
  constructor(id:WeaponId){
    const length=id==='pistol'?.12:id==='rifle'?.27:.32;
    this.root.name='Resonance form';this.geometry=new THREE.BoxGeometry(.018,.023,length);
    this.coreGeometry=new THREE.OctahedronGeometry(.035);this.material=new THREE.MeshStandardMaterial({color:0x8dfbc8,emissive:0x3bdc99,emissiveIntensity:1.8,metalness:.4,roughness:.33});
    for(const side of [-1,1]){const rail=new THREE.Mesh(this.geometry,this.material);rail.position.set(side*.035,.045,-length/2);this.root.add(rail);this.rails.push(rail);}
    const core=new THREE.Mesh(this.coreGeometry,this.material);core.position.set(0,.08,-length*.4);this.root.add(core);this.root.visible=false;
  }
  update(dt:number,active:boolean,shot:boolean):void {
    if(this.disposed)return;const fraction=Math.min(1,Math.max(0,Number.isFinite(dt)?dt/140:0));
    this.amount+=(Number(active)-this.amount)*fraction;this.root.visible=this.amount>.025;
    this.rails.forEach((rail,i)=>{const side=i===0?-1:1;rail.position.x=side*(.025+.047*this.amount);rail.rotation.z=side*.32*this.amount;rail.scale.setScalar(.3+.7*this.amount);});
    this.material.emissiveIntensity=shot?4:1.8*this.amount;
  }
  dispose():void{if(this.disposed)return;this.disposed=true;this.root.removeFromParent();this.root.clear();this.geometry.dispose();this.coreGeometry.dispose();this.material.dispose();}
}
