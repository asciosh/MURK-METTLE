import * as THREE from 'three/webgpu';
import { BUILDINGS, TREES, OBSTACLES } from '../../../shared/expansion.mjs';
import { ROOM_OFFSET } from './RoomIntent';

/** Nextgen procedural field art over the existing authoritative, level room map.
 * Every solid footprint remains exactly the shared server obstacle; foliage is overhead. */
export class RoomLandscape {
  readonly root = new THREE.Group();
  private readonly geometry = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.MeshStandardMaterial>();
  private readonly batches: THREE.InstancedMesh[] = [];
  constructor() {
    this.root.name = 'NEXTGENRoomLandscape';
    const material = (color: number, vertexColors = false) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.93, vertexColors }); this.materials.add(m); return m;
    };
    const track = <T extends THREE.BufferGeometry>(g: T) => { this.geometry.add(g); return g; };
    const plane = track(new THREE.PlaneGeometry(200, 200, 128, 128)); plane.rotateX(-Math.PI/2);
    const pos = plane.getAttribute('position'), colors = new Float32Array(pos.count*3);
    const grass = new THREE.Color(0x536b39), soil = new THREE.Color(0x6d5742), pale = new THREE.Color(0x88816b), c = new THREE.Color();
    for (let i=0; i<pos.count; i++) {
      const x=pos.getX(i), z=pos.getZ(i);
      const noise=0.5+0.25*Math.sin(x*0.21+Math.sin(z*0.08)*3)+0.18*Math.cos(z*0.31+x*0.13);
      const path=Math.min(Math.abs(x), Math.abs(z)*1.8);
      c.copy(grass).lerp(soil,Math.min(0.8,Math.max(0,noise*0.65)));
      if(path<4.5) c.lerp(pale, Math.max(0, 1-path/4.5)*0.82);
      c.toArray(colors,i*3);
    }
    plane.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const ground=new THREE.Mesh(plane,material(0xffffff,true)); ground.position.set(ROOM_OFFSET,0,ROOM_OFFSET); ground.receiveShadow=true; this.root.add(ground);
    const dummy=new THREE.Object3D();
    const batch=(g:THREE.BufferGeometry,m:THREE.MeshStandardMaterial,count:number,shadow=true)=>{
      const mesh=new THREE.InstancedMesh(g,m,count); mesh.castShadow=shadow; mesh.receiveShadow=true; this.root.add(mesh); this.batches.push(mesh); return mesh;
    };
    const box=track(new THREE.BoxGeometry(1,1,1));
    const trunks=batch(box,material(0x604b36),TREES.length);
    const crowns=batch(track(new THREE.ConeGeometry(1,1,7)),material(0x385b34),TREES.length*2);
    TREES.forEach((t,i)=>{
      const h=8*t.size, w=0.55*t.size;
      dummy.position.set(t.x+ROOM_OFFSET,h/2,t.z+ROOM_OFFSET); dummy.rotation.set(0,0,0); dummy.scale.set(w,h,w); dummy.updateMatrix(); trunks.setMatrixAt(i,dummy.matrix);
      for(let j=0;j<2;j++) {
        const height=h*(j===0?0.46:0.32); const radius=t.size*(j===0?1.55:1.03);
        dummy.position.set(t.x+ROOM_OFFSET,h*(j===0?0.63:0.83),t.z+ROOM_OFFSET); dummy.rotation.y=i*0.618; dummy.scale.set(radius,height,radius); dummy.updateMatrix(); crowns.setMatrixAt(i*2+j,dummy.matrix);
        const shade=0.76+(i%9)*0.027; crowns.setColorAt(i*2+j,new THREE.Color(shade,shade,shade));
      }
    });
    // Building walls are the original exact collision boxes; the roof trim stays inside them.
    const walls=batch(box,material(0x716e5b),BUILDINGS.length);
    const roofs=batch(box,material(0x434740),BUILDINGS.length);
    BUILDINGS.forEach((o,i)=>{
      dummy.rotation.set(0,0,0); dummy.position.set(o.x+ROOM_OFFSET,o.h/2,o.z+ROOM_OFFSET); dummy.scale.set(o.w,o.h,o.d); dummy.updateMatrix(); walls.setMatrixAt(i,dummy.matrix);
      dummy.position.y=o.h-0.14; dummy.scale.set(o.w+0.005,0.28,o.d+0.005); dummy.updateMatrix(); roofs.setMatrixAt(i,dummy.matrix);
    });
    // Low, non-solid grass clusters only away from paths, caches, buildings and tree trunks.
    const grassGeometry=track(new THREE.ConeGeometry(0.085,0.2,3));
    const blades: {x:number;z:number;y:number;scale:number;angle:number}[]=[];
    let seed=41373; const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<2800;i++){
      const x=random()*178-89,z=random()*178-89;
      if(Math.abs(x)<5||Math.abs(z)<3||OBSTACLES.some(o=>Math.abs(x-o.x)<o.w/2+0.4&&Math.abs(z-o.z)<o.d/2+0.4))continue;
      const scale=0.5+random()*0.65; blades.push({x,z,y:0.1*scale,scale,angle:random()*Math.PI*2});
    }
    const tufts=batch(grassGeometry,material(0x728746),blades.length,false);
    blades.forEach((b,i)=>{dummy.position.set(b.x+ROOM_OFFSET,b.y,b.z+ROOM_OFFSET);dummy.rotation.set(0,b.angle,0);dummy.scale.setScalar(b.scale);dummy.updateMatrix();tufts.setMatrixAt(i,dummy.matrix);});
    for(const m of this.batches){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.computeBoundingSphere();}
  }
  info(){return { style:'nextgen-room-landscape',solidObstacles:OBSTACLES.length,trees:TREES.length,buildings:BUILDINGS.length,groundHeight:0 };}
  dispose(){this.root.removeFromParent();for(const m of this.batches)m.dispose();for(const g of this.geometry)g.dispose();for(const m of this.materials)m.dispose();}
}
