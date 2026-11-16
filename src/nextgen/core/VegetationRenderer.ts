import * as THREE from 'three/webgpu';

import {
  generateVegetation,
  createVegetationChunks,
  isChunkVisible
} from './VegetationSystem';

import type {
  TerrainSurface,
  VegetationKind,
  VegetationChunk
} from './VegetationSystem';

interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  height: number;
  stretch: [number, number, number];
  horizontal?: boolean;
  shadow: boolean;
}

interface RenderedChunk {
  data: VegetationChunk;
  group: THREE.Group;
  batches: {
    mesh: THREE.InstancedMesh;
    capacity: number;
  }[];
}

export class VegetationRenderer {
  private readonly root = new THREE.Group();

  private readonly chunks: RenderedChunk[] = [];

  private readonly geometries =
    new Set<THREE.BufferGeometry>();

  private readonly materials =
    new Set<THREE.MeshStandardMaterial>();

  private distance = 60;
  private density = 1;

  constructor(
    scene: THREE.Scene,
    terrain: TerrainSurface,
    seed = 12345
  ) {
    this.root.name = 'EnvironmentVegetation';

    const placements = generateVegetation(terrain, seed);
    const chunks = createVegetationChunks(placements);

    const material = (color: number) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.95,
        metalness: 0
      });

    const bark = material(0x68503a);

    const parts: Record<VegetationKind, Part[]> = {
      pine: [
        {
          geometry: new THREE.CylinderGeometry(0.2, 0.32, 3, 7),
          material: bark,
          height: 1.5,
          stretch: [1, 1, 1],
          shadow: true
        },
        {
          geometry: new THREE.ConeGeometry(1.8, 4, 8),
          material: material(0x375f3c),
          height: 3.6,
          stretch: [1, 1, 1],
          shadow: true
        }
      ],

      deciduous: [
        {
          geometry: new THREE.CylinderGeometry(0.3, 0.45, 4, 8),
          material: bark,
          height: 2,
          stretch: [1, 1, 1],
          shadow: true
        },
        {
          geometry: new THREE.IcosahedronGeometry(2.3, 1),
          material: material(0x648343),
          height: 4.5,
          stretch: [1, 1.15, 1],
          shadow: true
        }
      ],

      bush: [
        {
          geometry: new THREE.IcosahedronGeometry(1, 1),
          material: material(0x55763b),
          height: 0.55,
          stretch: [1.2, 0.65, 1],
          shadow: true
        }
      ],

      grass: [
        {
          geometry: new THREE.ConeGeometry(0.16, 0.55, 3),
          material: material(0x768f43),
          height: 0.275,
          stretch: [1, 1, 1],
          shadow: false
        }
      ],

      rock: [
        {
          geometry: new THREE.DodecahedronGeometry(1, 0),
          material: material(0x8a8c83),
          height: 0.4,
          stretch: [1.2, 0.65, 0.9],
          shadow: true
        }
      ],

      log: [
        {
          geometry: new THREE.CylinderGeometry(0.3, 0.4, 3.5, 8),
          material: bark,
          height: 0.32,
          stretch: [1, 1, 1],
          horizontal: true,
          shadow: true
        }
      ]
    };

    for (const definitions of Object.values(parts)) {
      for (const part of definitions) {
        this.geometries.add(part.geometry);
        this.materials.add(part.material);
      }
    }

    const dummy = new THREE.Object3D();

    for (const chunk of chunks) {
      const group = new THREE.Group();

      const rendered: RenderedChunk = {
        data: chunk,
        group,
        batches: []
      };

      for (const kind of Object.keys(parts) as VegetationKind[]) {
        const items = chunk.placements.filter(
          p => p.kind === kind
        );

        if (items.length === 0) continue;

        for (const part of parts[kind]) {
          const mesh = new THREE.InstancedMesh(
            part.geometry,
            part.material,
            items.length
          );

          mesh.castShadow = part.shadow;
          mesh.receiveShadow = true;

          items.forEach((p, index) => {
            dummy.position.set(
              p.x,
              p.y + part.height * p.scale,
              p.z
            );

            dummy.rotation.set(
              0,
              p.rotation,
              part.horizontal ? Math.PI / 2 : 0,
              'YXZ'
            );

            dummy.scale.set(
              part.stretch[0] * p.scale,
              part.stretch[1] * p.scale,
              part.stretch[2] * p.scale
            );

            dummy.updateMatrix();

            mesh.setMatrixAt(index, dummy.matrix);

            const shade =
              0.8 + (p.rotation / (Math.PI * 2)) * 0.2;

            mesh.setColorAt(
              index,
              new THREE.Color(shade, shade, shade)
            );
          });

          mesh.instanceMatrix.needsUpdate = true;

          if (mesh.instanceColor) {
            mesh.instanceColor.needsUpdate = true;
          }

          mesh.computeBoundingSphere();

          group.add(mesh);

          rendered.batches.push({
            mesh,
            capacity: items.length
          });
        }
      }

      this.root.add(group);
      this.chunks.push(rendered);
    }

    scene.add(this.root);
    this.setQuality('balanced');
  }

  setQuality(id: string): void {
    if (id === 'low') {
      this.distance = 35;
      this.density = 0.5;
    } else if (id === 'cinematic') {
      this.distance = 140;
      this.density = 1;
    } else {
      this.distance = 100;
      this.density = 0.8;
    }

    for (const chunk of this.chunks) {
      for (const batch of chunk.batches) {
        batch.mesh.count = Math.ceil(
          batch.capacity * this.density
        );
      }
    }
  }

  update(cameraX: number, cameraZ: number): void {
    for (const chunk of this.chunks) {
      chunk.group.visible = isChunkVisible(
        chunk.data,
        cameraX,
        cameraZ,
        this.distance
      );
    }
  }

  dispose(): void {
    this.root.removeFromParent();

    for (const chunk of this.chunks) {
      for (const batch of chunk.batches) {
        batch.mesh.dispose();
      }
    }

    for (const geometry of this.geometries) {
      geometry.dispose();
    }

    for (const material of this.materials) {
      material.dispose();
    }

    this.root.clear();
    this.chunks.length = 0;
  }
}
