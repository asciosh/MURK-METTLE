import * as THREE from 'three';

interface CircularObstacle {
  x: number;
  z: number;
  radius: number;
}

/** A small procedural test clearing; all meshes are temporary original primitives. */
export class World {
  private readonly obstacles: CircularObstacle[] = [];

  constructor(private readonly scene: THREE.Scene) {
    this.createGround();
    this.createPath();
    this.createVegetation();
    this.createRuins();
    this.createAtmosphereDetails();
    this.createForestFloor();
    this.createLandmarks();
    this.createCanopyDetails();
  }

  private createGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0x405a43, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.scene.add(ground);

    const clearing = new THREE.Mesh(
      new THREE.CircleGeometry(23.8, 64),
      new THREE.MeshStandardMaterial({ color: 0x52684b, roughness: 1 }),
    );
    clearing.rotation.x = -Math.PI / 2;
    clearing.position.y = 0.012;
    clearing.receiveShadow = true;
    this.scene.add(clearing);
  }

  private createPath(): void {
    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(6.5, 47),
      new THREE.MeshStandardMaterial({ color: 0x78694f, roughness: 1 }),
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.025, -1.8);
    path.receiveShadow = true;
    this.scene.add(path);

    const pathEdgeMaterial = new THREE.MeshStandardMaterial({ color: 0x9a8968, roughness: 1 });
    for (const x of [-3.45, 3.45]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 42), pathEdgeMaterial);
      edge.position.set(x, 0.045, -2);
      this.scene.add(edge);
    }
  }

  private createVegetation(): void {
    const treePositions: Array<[number, number, number]> = [
      [-17, -15, 1.2], [-13, -20, 0.9], [-19, -4, 1.05], [-16, 12, 1.2],
      [-8, 19, 0.9], [2, 21, 1.15], [13, 17, 1.1], [19, 10, 1.2],
      [20, -5, 0.95], [15, -18, 1.2], [8, -21, 0.9], [-21, 5, 0.9],
    ];
    for (const [x, z, scale] of treePositions) this.createTree(x, z, scale);

    const rockPositions: Array<[number, number, number]> = [
      [-11, -13, 0.9], [-7, 15, 0.7], [11, 13, 0.85], [17, -12, 0.75],
      [-20, 1, 0.7], [4, 18, 0.7], [20, 4, 0.8], [-15, 16, 0.7],
    ];
    for (const [x, z, scale] of rockPositions) this.createRock(x, z, scale);

    const mushroomPositions: Array<[number, number, number]> = [
      [-10, -17, 1], [10, -17, 1.15], [-19, 8, 0.9], [17, 15, 1.1],
      [-6, 20, 0.85], [21, -8, 0.95],
    ];
    for (const [x, z, scale] of mushroomPositions) this.createMushroom(x, z, scale);
  }

  private createTree(x: number, z: number, scale: number): void {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.38, 2.4, 7),
      new THREE.MeshStandardMaterial({ color: 0x594c38, roughness: 1 }),
    );
    trunk.position.y = 1.2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0x294d3c, roughness: 1 });
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.65, 3.8, 7), canopyMaterial);
    canopy.position.y = 3.5;
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    tree.add(canopy);

    const lowerCanopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1.18, 1),
      new THREE.MeshStandardMaterial({ color: 0x3d6248, roughness: 1 }));
    lowerCanopy.position.set(0.2, 2.75, 0.1);
    lowerCanopy.castShadow = true;
    tree.add(lowerCanopy);

    this.scene.add(tree);
    this.obstacles.push({ x, z, radius: 0.8 * scale });
  }

  private createRock(x: number, z: number, scale: number): void {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.75 * scale, 0),
      new THREE.MeshStandardMaterial({ color: 0x687269, roughness: 1 }),
    );
    rock.position.set(x, 0.42 * scale, z);
    rock.rotation.set(0.2, x * 0.17, 0.35);
    rock.scale.set(1.25, 0.8, 0.95);
    rock.castShadow = true;
    rock.receiveShadow = true;
    this.scene.add(rock);
    this.obstacles.push({ x, z, radius: 0.62 * scale });
  }

  private createMushroom(x: number, z: number, scale: number): void {
    const mushroom = new THREE.Group();
    mushroom.position.set(x, 0, z);
    mushroom.scale.setScalar(scale);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.19, 0.68, 8),
      new THREE.MeshStandardMaterial({ color: 0xd6c8a8, roughness: 0.9 }),
    );
    stem.position.y = 0.34;
    stem.castShadow = true;
    mushroom.add(stem);

    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: 0xd36f52, roughness: 0.68, emissive: 0x321008, emissiveIntensity: 0.18 }),
    );
    cap.position.y = 0.66;
    cap.castShadow = true;
    mushroom.add(cap);

    this.scene.add(mushroom);
    this.obstacles.push({ x, z, radius: 0.42 * scale });
  }

  private createRuins(): void {
    const ruinMaterial = new THREE.MeshStandardMaterial({ color: 0x777b6d, roughness: 1 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.45, 1.2), ruinMaterial);
    base.position.set(0, 0.22, -23.5);
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);

    for (const x of [-2.1, 2.1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.8, 0.65), ruinMaterial);
      pillar.position.set(x, 2.0, -23.5);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.scene.add(pillar);
    }

    const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.55, 0.8), ruinMaterial);
    lintel.position.set(0, 3.8, -23.5);
    lintel.castShadow = true;
    this.scene.add(lintel);
  }

  private createAtmosphereDetails(): void {
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xb7d88b });
    const points: Array<[number, number, number]> = [
      [-5, 0.55, -8], [6, 0.7, -13], [-8, 0.65, 7], [10, 0.8, 5], [2, 0.65, 14],
    ];
    for (const [x, y, z] of points) {
      const mote = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), glowMaterial);
      mote.position.set(x, y, z);
      this.scene.add(mote);
    }
  }

  /** Seeded decoration makes every visit to the mission area visually consistent. */
  private createForestFloor(): void {
    let seed = 70421;
    const random = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const fernMaterial = new THREE.MeshStandardMaterial({ color: 0x688d58, side: THREE.DoubleSide, roughness: 1 });
    const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x8a9c5c, side: THREE.DoubleSide, roughness: 1 });
    const bladeGeometry = new THREE.ConeGeometry(0.16, 0.75, 3);
    const fern = new THREE.InstancedMesh(bladeGeometry, fernMaterial, 290);
    const grass = new THREE.InstancedMesh(bladeGeometry, grassMaterial, 270);
    const dummy = new THREE.Object3D();
    for (const [mesh, amount] of [[fern, 290], [grass, 270]] as const) {
      for (let i = 0; i < amount; i++) {
        const x = random() * 48 - 24;
        const z = random() * 48 - 24;
        dummy.position.set(x, 0.25, z);
        dummy.rotation.set(0, random() * Math.PI * 2, 0);
        const size = 0.5 + random() * 0.95;
        dummy.scale.set(size, size, size);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
    }
    const wildflowers = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.085, 0),
      new THREE.MeshBasicMaterial({ color: 0xe6be83 }), 95,
    );
    for (let i = 0; i < 95; i++) {
      dummy.position.set(random() * 45 - 22.5, 0.44, random() * 45 - 22.5);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.6 + random() * 0.7);
      dummy.updateMatrix(); wildflowers.setMatrixAt(i, dummy.matrix);
    }
    wildflowers.instanceMatrix.needsUpdate = true;
    this.scene.add(wildflowers);
  }

  /** Landmarks intentionally stay in the existing 46m playable area; mission positions do not change. */
  private createLandmarks(): void {
    const stone = new THREE.MeshStandardMaterial({ color: 0x536b63, roughness: 0.96 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x789487, metalness: 0.55, roughness: 0.5 });
    const amber = new THREE.MeshStandardMaterial({ color: 0xffaa67, emissive: 0xa75b32, emissiveIntensity: 1.35 });
    const cyan = new THREE.MeshStandardMaterial({ color: 0x81eee2, emissive: 0x2d9e9b, emissiveIntensity: 1.25 });
    // A weather station that marks the eastern route, away from zombie spawn and extraction.
    const station = new THREE.Group();
    station.position.set(13, 0, -8);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 0.28, 8), stone);
    pad.position.y = 0.14; station.add(pad);
    for (const x of [-1.05, 1.05]) {
      const support = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.3, 0.16), metal);
      support.position.set(x, 1.72, 0); station.add(support);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.23, 2.1), stone);
    roof.position.y = 3.35; station.add(roof);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.9, 0.12), cyan);
    screen.position.set(0, 2.15, 0.02); station.add(screen);
    this.scene.add(station);
    // A warm field camp to orient the spawn side of the clearing.
    const camp = new THREE.Group(); camp.position.set(-11, 0, 8);
    const tent = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.7, 4), new THREE.MeshStandardMaterial({ color: 0xb28a60, roughness: 1 }));
    tent.rotation.y = Math.PI / 4; tent.position.y = 1.35; camp.add(tent);
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 6), amber);
    fire.position.set(3.1, 0.42, 0); camp.add(fire);
    const glow = new THREE.PointLight(0xffa15c, 4.5, 9, 2);
    glow.position.set(3.1, 1.0, 0); camp.add(glow);
    this.scene.add(camp);
    // Simple orientation monolith near the ruin corridor.
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.6, 0.55), stone);
    marker.position.set(-9, 1.3, -16); marker.rotation.y = 0.3; this.scene.add(marker);
    const rune = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.65, 0.04), cyan);
    rune.position.set(-9, 1.7, -15.7); this.scene.add(rune);
  }

  private createCanopyDetails(): void {
    const soil = new THREE.MeshStandardMaterial({ color: 0x3d5547, roughness: 1 });
    for (const [x, z, r] of [[-15,-11,3], [16,7,3.5], [-14,15,2.4], [17,-18,2.8]] as const) {
      const mound = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 7), soil);
      mound.scale.set(1, 0.12, 0.85); mound.position.set(x, -0.24, z);
      mound.receiveShadow = true; this.scene.add(mound);
    }
  }

  /** Keeps the prototype player within the clearing and outside simple circular props. */
  constrainPlayerPosition(position: THREE.Vector3): void {
    this.constrainActorPosition(position, 0.42);
  }

  /** Shared lightweight collision constraint for local actors such as the player and enemies. */
  constrainActorPosition(position: THREE.Vector3, actorRadius: number): void {
    const boundary = 22.7;
    position.x = THREE.MathUtils.clamp(position.x, -boundary, boundary);
    position.z = THREE.MathUtils.clamp(position.z, -boundary, boundary);

    for (const obstacle of this.obstacles) {
      const dx = position.x - obstacle.x;
      const dz = position.z - obstacle.z;
      const distance = Math.hypot(dx, dz);
      const minimumDistance = obstacle.radius + actorRadius;
      if (distance >= minimumDistance) continue;

      const safeDistance = distance || 0.0001;
      const normalX = distance > 0.0001 ? dx / safeDistance : 1;
      const normalZ = distance > 0.0001 ? dz / safeDistance : 0;
      position.x = obstacle.x + normalX * minimumDistance;
      position.z = obstacle.z + normalZ * minimumDistance;
    }
  }
}
