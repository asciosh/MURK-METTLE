import * as THREE from 'three/webgpu';

type Point = [number, number];

export class PistolProp {
  readonly root = new THREE.Group();
  readonly muzzle = new THREE.Object3D();

  private readonly geometries =
    new Set<THREE.BufferGeometry>();

  private readonly materials =
    new Set<THREE.Material>();

  private disposed = false;

  constructor(hand: THREE.Bone) {
    this.root.name = 'NEXTGEN Pistol';

    // Calibrated against the survivor's Aim pose.
    this.root.position.set(
      -0.010335,
      0.078846,
      0.024137
    );

    this.root.quaternion.set(
      0.628062,
      0.119403,
      -0.112871,
      0.760619
    ).normalize();

    const metal = new THREE.MeshStandardMaterial({
      color: 0x41464b,
      metalness: 0.65,
      roughness: 0.42
    });

    const polymer = new THREE.MeshStandardMaterial({
      color: 0x202327,
      metalness: 0.1,
      roughness: 0.8
    });

    this.materials.add(metal);
    this.materials.add(polymer);

    // Stylized upper slide.
    this.addProfile([
      [-0.050, 0.008],
      [0.120, 0.008],
      [0.120, 0.032],
      [0.109, 0.042],
      [-0.041, 0.042],
      [-0.050, 0.032]
    ], 0.028, metal);

    // Lower frame and handle.
    this.addProfile([
      [-0.050, 0.008],
      [0.105, 0.008],
      [0.105, -0.006],
      [0.017, -0.006],
      [-0.012, -0.084],
      [-0.056, -0.080],
      [-0.036, -0.015]
    ], 0.030, polymer);

    // Rounded grip panel.
    this.addProfile([
      [-0.033, -0.020],
      [0.005, -0.023],
      [-0.015, -0.080],
      [-0.055, -0.076]
    ], 0.032, polymer);

    // Decorative trigger-guard silhouette.
    this.addProfile([
      [0.005, -0.004],
      [0.068, -0.004],
      [0.061, -0.034],
      [0.005, -0.034]
    ], 0.014, polymer, [
      [0.014, -0.011],
      [0.058, -0.011],
      [0.054, -0.026],
      [0.014, -0.026]
    ]);

    // Future muzzle-flash attachment point.
    this.muzzle.name = 'Pistol Muzzle';
    this.muzzle.position.set(0, 0.026, -0.125);

    this.root.add(this.muzzle);

    this.root.visible = false;

    hand.add(this.root);
  }

  private addProfile(
    points: Point[],
    width: number,
    material: THREE.Material,
    hole?: Point[]
  ): void {
    const shape = new THREE.Shape();

    shape.moveTo(...points[0]);

    for (const point of points.slice(1)) {
      shape.lineTo(...point);
    }

    shape.closePath();

    if (hole) {
      const path = new THREE.Path();

      path.moveTo(...hole[0]);

      for (const point of hole.slice(1)) {
        path.lineTo(...point);
      }

      path.closePath();

      shape.holes.push(path);
    }

    const geometry = new THREE.ExtrudeGeometry(
      shape,
      {
        depth: width,
        bevelEnabled: true,
        bevelThickness: 0.0015,
        bevelSize: 0.0015,
        bevelSegments: 2,
        steps: 1
      }
    );

    geometry.translate(0, 0, -width / 2);
    geometry.rotateY(Math.PI / 2);

    this.geometries.add(geometry);

    const mesh = new THREE.Mesh(
      geometry,
      material
    );

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.root.add(mesh);
  }

  update(aimWeight: number): void {
    if (this.disposed) return;

    this.root.visible = aimWeight >= 0.5;
  }

  getMuzzlePosition(
    target = new THREE.Vector3()
  ): THREE.Vector3 {
    return this.muzzle.getWorldPosition(target);
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;

    this.root.removeFromParent();

    this.geometries.forEach(g => g.dispose());
    this.materials.forEach(m => m.dispose());

    this.geometries.clear();
    this.materials.clear();
    this.root.clear();
  }
}