import * as THREE from 'three';
import { EXTRACTION_X, EXTRACTION_Z } from './Expedition';
import { WORLD_BOUNDARY, BUILDINGS, SUPPLIES, CREATURES } from '../../../shared/expansion.mjs';

export class Minimap {
  private readonly context=document.querySelector<HTMLCanvasElement>('#field-minimap')?.getContext('2d')??null;
  update(player:THREE.Vector3,zombie:THREE.Vector3|null,facing:number):void {
    const ctx=this.context;if(!ctx)return;
    const w=220,scale=200/(WORLD_BOUNDARY*2),point=(x:number,z:number):[number,number]=>[110+x*scale,110+z*scale];
    ctx.fillStyle='#1e2925';ctx.fillRect(0,0,w,w);
    ctx.fillStyle='#3d493c';ctx.fillRect(10,10,200,200);
    ctx.fillStyle='#555649';ctx.fillRect(...point(-4.5,-90),9*scale,180*scale);ctx.fillRect(...point(-55,-2.7),120*scale,5.4*scale);
    ctx.fillStyle='#355251';ctx.beginPath();ctx.ellipse(...point(-48,-31),12*scale,12*scale,0,0,Math.PI*2);ctx.fill();
    for(const b of BUILDINGS){ctx.fillStyle='#8e8c78';ctx.fillRect(...point(b.x-b.w/2,b.z-b.d/2),b.w*scale,b.d*scale);}
    const dot=(x:number,z:number,color:string,r:number)=>{ctx.beginPath();ctx.arc(...point(x,z),r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();};
    for(const c of Object.values(CREATURES))dot(c.x,c.z,'#b9c98e',2.5);
    for(const p of SUPPLIES){const [x,y]=point(p.x,p.z);ctx.strokeStyle='#d3b785';ctx.strokeRect(x-2,y-2,4,4);}
    dot(EXTRACTION_X,EXTRACTION_Z,'#85d4ca',4);
    if(zombie)dot(zombie.x,zombie.z,'#d88d76',3);
    ctx.fillStyle='#b1b4a2';ctx.font='8px monospace';ctx.fillText('HAVEN',114,35);ctx.fillText('WETLAND',20,64);ctx.fillText('RELAY',164,151);
    const [x,y]=point(player.x,player.z);ctx.save();ctx.translate(x,y);ctx.rotate(-facing);ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,5);ctx.lineTo(0,3);ctx.lineTo(-4,5);ctx.closePath();ctx.fillStyle='#f1e4bd';ctx.fill();ctx.restore();
    ctx.strokeStyle='#8d9980';ctx.strokeRect(10,10,200,200);
  }
}
