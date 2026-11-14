import * as THREE from 'three';
import { EXTRACTION_X, EXTRACTION_Z } from './Expedition';

/** Small fixed north-up tactical map. Uses canvas rather than an extra WebGL scene. */
export class Minimap {
  private readonly canvas: HTMLCanvasElement | null;
  private readonly context: CanvasRenderingContext2D | null;
  constructor() {
    this.canvas = document.querySelector<HTMLCanvasElement>('#field-minimap');
    this.context = this.canvas?.getContext('2d') ?? null;
  }
  update(player: THREE.Vector3, zombie: THREE.Vector3 | null, facing: number): void {
    const ctx = this.context;
    if (!ctx) return;
    const w = 220;
    const scale = w / 52;
    const point = (x: number, z: number): [number, number] => [w / 2 + x * scale, w / 2 + z * scale];
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = '#1b3027'; ctx.fillRect(0, 0, w, w);
    // Navigable clearing, forest boundary and main track.
    ctx.strokeStyle = '#5e8d71'; ctx.lineWidth = 1.4;
    ctx.strokeRect(...point(-22.7, -22.7), 45.4 * scale, 45.4 * scale);
    ctx.fillStyle = '#4a5340'; ctx.fillRect(...point(-3.25, -23), 6.5 * scale, 46 * scale);
    const dot = (x: number, z: number, color: string, radius: number) => {
      const [px, py] = point(x, z);
      ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    };
    // Landmarks match World.ts.
    dot(13, -8, '#85b4a7', 5); dot(-11, 8, '#f0ac70', 5);
    dot(EXTRACTION_X, EXTRACTION_Z, '#65f2df', 5);
    ctx.strokeStyle = '#65f2df'; ctx.lineWidth = 1.5;
    const [ex, ey] = point(EXTRACTION_X, EXTRACTION_Z);
    ctx.strokeRect(ex - 7, ey - 7, 14, 14);
    if (zombie) dot(zombie.x, zombie.z, '#fa8b70', 4.5);
    const [px, py] = point(player.x, player.z);
    ctx.save(); ctx.translate(px, py); ctx.rotate(-facing);
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 4); ctx.lineTo(-6, 7); ctx.closePath();
    ctx.fillStyle = '#f0f7b6'; ctx.fill(); ctx.restore();
  }
}
