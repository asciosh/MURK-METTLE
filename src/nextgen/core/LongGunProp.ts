import * as THREE from 'three/webgpu';
import type { PrimaryWeapon } from './EquipmentInventory.ts';

// Original stylized game props, built entirely from runtime geometry. The
// attachment convention is the existing pistol hand calibration; -Z is forward.
export const HAND_POSITION = new THREE.Vector3(-0.010335,0.078846,0.024137);
export const HAND_ROTATION = new THREE.Quaternion(0.628062,0.119403,-0.112871,0.760619).normalize();
export class LongGunProp {
  readonly root = new THREE.Group();
  readonly muzzle = new THREE.Object3D();
  readonly support = new THREE.Object3D();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private disposed = false;
  readonly id: PrimaryWeapon;
  private readonly foregrip:THREE.Mesh;
  private readonly magazine:THREE.Mesh|null;
  private cycle=0;
  private reloadCycle=0;
  constructor(id: PrimaryWeapon) {
    this.id = id;
    this.root.name = 'NEXTGEN '+id;
    const metal = new THREE.MeshStandardMaterial({color:0x40484b,metalness:.55,roughness:.48});
    const matte = new THREE.MeshStandardMaterial({color:id==='rifle'?0x252c26:0x694c32,roughness:.82});
    this.materials.push(metal,matte);
    const box = (x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material) => {
      const geo = new THREE.BoxGeometry(w,h,d);this.geometries.push(geo);
      const mesh = new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);
      mesh.castShadow=true;mesh.receiveShadow=true;this.root.add(mesh);return mesh;
    };
    // Distinct readable silhouettes from the third-person camera.
    box(0,.027,-.045,.064,.073,.24,metal);
    box(0,.012,.15,.069,.093,.17,matte);
    box(0,-.033,.015,.044,.092,.061,matte);
    this.foregrip=box(0,.008,-.205,.077,.069,id==='rifle'?.18:.22,matte);
    this.magazine=id==='rifle'?box(0,-.065,-.095,.049,.11,.075,metal):null;
    const length=id==='rifle'?.36:.43;
    const tube = new THREE.CylinderGeometry(.017,.017,length-.20,8);
    this.geometries.push(tube);const barrel=new THREE.Mesh(tube,metal);
    barrel.rotation.x=Math.PI/2;barrel.position.set(0,.027,-(length+.20)/2);barrel.castShadow=true;this.root.add(barrel);
    box(0,.072,-.045,.036,.018,.066,matte);
    this.muzzle.position.set(0,.027,-length-.006);
    this.support.position.set(0,-.035,-.19);
    this.root.add(this.muzzle,this.support);
    this.root.visible=false;
  }
  animateAction(dt:number,shot:boolean,reload:boolean,action:string|null):void {
    if(this.disposed)return;
    dt=Number.isFinite(dt)?Math.max(0,Math.min(100,dt)):0;
    this.cycle=shot?1:Math.max(0,this.cycle-dt/(this.id==='shotgun'?500:140));
    this.reloadCycle=reload?1:action==='reload'?Math.max(0,this.reloadCycle-dt/(this.id==='shotgun'?2400:2100)):0;
    // Slide the pump back and forward; rifle magazine lowers during reload.
    const pump=this.id==='shotgun'?Math.sin(Math.PI*this.cycle)*.075:0;
    this.foregrip.position.z=-.205+pump;this.support.position.z=-.19+pump;
    if(this.magazine)this.magazine.position.y=-.065-Math.sin(Math.PI*this.reloadCycle)*.12;
  }
  attachHand(hand: THREE.Bone): void {
    if(this.root.parent!==hand)hand.add(this.root);this.root.position.copy(HAND_POSITION);this.root.quaternion.copy(HAND_ROTATION);this.root.visible=true;
  }
  attachBack(spine: THREE.Bone): void {
    if(this.root.parent!==spine)spine.add(this.root);this.root.position.set(-.02,.118417,-.417294);
    this.root.quaternion.set(-.000258,.707735,.653386,.268697).normalize();this.root.visible=true;
  }
  dispose():void {
    if(this.disposed)return;
    this.disposed=true;
    this.root.removeFromParent();this.root.clear();
    for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();
  }
}

// A bounded analytic arm solve keeps the support hand near the long-gun grip.
// The right hand and the original aim/shoot/reload clips remain the pose source.
export function supportLongGun(root: THREE.Object3D, grip: THREE.Object3D, blend: number): void {
  const upper=root.getObjectByName('upperarm_l'), lower=root.getObjectByName('lowerarm_l'), hand=root.getObjectByName('hand_l');
  if (!(upper instanceof THREE.Bone) || !(lower instanceof THREE.Bone) || !(hand instanceof THREE.Bone) || !upper.parent || !lower.parent) return;
  const shoulder=upper.getWorldPosition(new THREE.Vector3());
  const elbow=lower.getWorldPosition(new THREE.Vector3());
  const wrist=hand.getWorldPosition(new THREE.Vector3());
  const target=grip.getWorldPosition(new THREE.Vector3());
  const length1=shoulder.distanceTo(elbow),length2=elbow.distanceTo(wrist);
  if(length1<.001||length2<.001)return;
  const axis=target.clone().sub(shoulder);const d=axis.length();if(d<.001)return;
  axis.normalize();const reach=THREE.MathUtils.clamp(d,Math.abs(length1-length2)+.001,length1+length2-.001);
  const pole=elbow.clone().sub(shoulder);pole.addScaledVector(axis,-pole.dot(axis));
  if(pole.lengthSq()<.000001)return;pole.normalize();
  const along=(length1*length1-length2*length2+reach*reach)/(2*reach);
  const desiredElbow=shoulder.clone().addScaledVector(axis,along).addScaledVector(pole,Math.sqrt(Math.max(0,length1*length1-along*along)));
  const desiredWrist=shoulder.clone().addScaledVector(axis,reach);
  const align=(bone:THREE.Bone,from:THREE.Vector3,to:THREE.Vector3)=>{
    if(from.lengthSq()<1e-8||to.lengthSq()<1e-8||!bone.parent)return;
    const world=bone.getWorldQuaternion(new THREE.Quaternion());
    const desired=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()).multiply(world);
    const local=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(desired);
    bone.quaternion.slerp(local,THREE.MathUtils.clamp(blend,0,1));bone.updateWorldMatrix(true,true);
  };
  align(upper,elbow.clone().sub(shoulder),desiredElbow.sub(shoulder));
  const e=lower.getWorldPosition(new THREE.Vector3());const w=hand.getWorldPosition(new THREE.Vector3());
  align(lower,w.sub(e),desiredWrist.sub(e));
}
