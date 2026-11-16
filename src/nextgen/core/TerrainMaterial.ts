import * as THREE from 'three/webgpu';
import { color, float, mix, positionWorld, smoothstep } from 'three/tsl';

export class TerrainMaterial extends THREE.MeshStandardNodeMaterial {
  constructor() {
    super();

    const height = positionWorld.y;

    const grassBlend = smoothstep(3, 7, height);
    const rockBlend = smoothstep(13, 18, height);

    const soil = color(0x69503a);
    const grass = color(0x526b35);
    const rock = color(0x777b80);

    this.colorNode = mix(
      mix(soil, grass, grassBlend),
      rock,
      rockBlend
    );

    this.roughnessNode = mix(
      mix(float(0.92), float(0.85), grassBlend),
      float(0.75),
      rockBlend
    );

    this.metalness = 0;
  }
}