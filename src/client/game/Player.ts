import { batchRigidParts } from './ActorGeometry';
import { solveLeg, footCycle } from '../../../shared/actor-motion.mjs';
import { acquireActorSurfaces, releaseActorSurfaces } from './SurfaceMaterials';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { World } from './World';
import { ActorAnimator, type ModelEntry } from './AnimationController';
import { WeaponPresentation } from './WeaponPresentation';
import { solveArm, type ActorPose } from '../../../shared/actor-pose.mjs';
import type { WeaponId } from '../../../shared/expansion.mjs';

/** Articulated survivor with compatible GLB equipment and procedural weapon-hand posing. */
export class Player {
  readonly root = new THREE.Group();

  private readonly visual = new THREE.Group();
  private readonly animator = new ActorAnimator(this.visual, ['idle', 'walk', 'run', 'attack']);
  private leftArm!: THREE.Group;
  private leftElbow!: THREE.Group;
  private rightElbow!: THREE.Group;
  readonly weaponSocket = new THREE.Group();
  private readonly gun: WeaponPresentation;
  private recoilTime = 0;
  private raisedTime = 0;
  bandaging = false;
  private readonly headRig = new THREE.Group();
  private readonly bandageWrap = new THREE.Mesh(
    new THREE.TorusGeometry(0.064, 0.011, 6, 20),
    new THREE.MeshStandardMaterial({ color: 0xcac9b4, roughness: 1 }),
  );
  private movementAmount = 0;
  private motionForward = 1;
  private motionSide = 0;
  weapon: WeaponId = 'pistol';
  aimPitch = 0;
  reloadProgress = 0;
  reloading = false;
  get weaponRaised(): boolean {
    return this.aiming || this.raisedTime > 0;
  }
  private leftLeg!: THREE.Group;
  private rightLeg!: THREE.Group;
  private leftKnee!: THREE.Group;
  private rightKnee!: THREE.Group;
  private leftFoot!: THREE.Group;
  private rightFoot!: THREE.Group;
  private fallbackModel!: THREE.Group;
  private rightArm!: THREE.Group;
  private walkClock = 0;
  private isMoving = false;
  private movementBlend = 0;
  private sprintBlend = 0;
  private idleClock = 0;
  private attackTime = 0;
  private health = 100;
  private fallenBlend = 0;
  private remoteDeathTime = 0;
  private hitReaction = 0;
  private aimBlend = 0;
  private readonly relaxedHand = new THREE.Vector3(-0.25, 1.02, 0.04);
  aiming = false;
  aimYaw = 0;

  constructor(private readonly scene: THREE.Scene) {
    this.root.name = 'player';
    this.visual.name = 'player-visual';
    this.root.add(this.visual);
    this.createModel();
    this.root.add(this.weaponSocket);
    this.weaponSocket.name = 'weapon-socket';
    this.weaponSocket.position.set(0.25, 1.24, -0.21);
    this.weaponSocket.rotation.x = -0.55;
    this.gun = new WeaponPresentation(this.weaponSocket);
    this.scene.add(this.root);
  }

  private readonly surfaces = acquireActorSurfaces();
  private createModel(): void {
    this.fallbackModel = new THREE.Group();
    this.visual.add(this.fallbackModel);
    const bodyMaterial = this.surfaces.material('fabric', 0x718578, 4);
    const darkMaterial = new THREE.MeshStandardMaterial({
      color: 0x262c28,
      roughness: 0.92,
    });
    const skinMaterial = this.surfaces.material('skin', 0xffe4ca);
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: 0x796e58,
      roughness: 0.72,
    });
    const visorMaterial = new THREE.MeshStandardMaterial({
      color: 0x17231e,
      roughness: 0.3,
      metalness: 0.15,
    });

    const profile = [
      new THREE.Vector2(0.19, -0.32),
      new THREE.Vector2(0.215, -0.28),
      new THREE.Vector2(0.205, -0.04),
      new THREE.Vector2(0.25, 0.17),
      new THREE.Vector2(0.255, 0.25),
      new THREE.Vector2(0.2, 0.3),
      new THREE.Vector2(0.11, 0.34),
    ];
    const torso = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), bodyMaterial);
    torso.scale.set(1.06, 1, 0.7);
    torso.position.y = 1.15;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.095, 0.22, 14), skinMaterial);
    neck.position.y = 1.61;
    neck.castShadow = true;
    this.fallbackModel.add(neck);
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.fallbackModel.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 20, 16), skinMaterial);
    head.position.set(0, 1.86, -0.015);
    head.scale.set(0.84, 1.08, 0.85);
    head.castShadow = true;
    this.fallbackModel.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.075, 0.045), visorMaterial);
    visor.position.set(0, 1.9, -0.185);
    visor.castShadow = true;
    this.fallbackModel.add(visor);

    const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.3), accentMaterial);
    scarf.position.set(0, 1.55, -0.015);
    scarf.castShadow = true;
    this.fallbackModel.add(scarf);

    const backpack = new THREE.Mesh(new RoundedBoxGeometry(0.39, 0.55, 0.24, 2, 0.025), darkMaterial);
    backpack.name = 'fallback-pack';
    backpack.position.set(0, 1.15, 0.24);
    backpack.castShadow = true;
    this.fallbackModel.add(backpack);

    const makeArm = (side: number): [THREE.Group, THREE.Group] => {
      const shoulder = new THREE.Group(),
        elbow = new THREE.Group();
      shoulder.name = side < 0 ? 'left-shoulder' : 'right-shoulder';
      elbow.name = side < 0 ? 'left-elbow' : 'right-elbow';
      shoulder.position.set(side * 0.285, 1.47, 0);
      const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.16, 6, 12), bodyMaterial);
      sleeve.position.y = -0.16;
      sleeve.castShadow = true;
      shoulder.add(sleeve);
      elbow.position.y = -0.32;
      shoulder.add(elbow);
      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.17, 6, 12), bodyMaterial);
      forearm.position.y = -0.15;
      forearm.castShadow = true;
      elbow.add(forearm);
      const glove = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.075), darkMaterial);
      glove.position.y = -0.3;
      glove.castShadow = true;
      elbow.add(glove);
      this.fallbackModel.add(shoulder);
      return [shoulder, elbow];
    };
    [this.leftArm, this.leftElbow] = makeArm(-1);
    [this.rightArm, this.rightElbow] = makeArm(1);

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.025, 8, 24), darkMaterial);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.87;
    belt.scale.y = 0.72;
    this.fallbackModel.add(belt);
    const legMat = this.surfaces.material('fabric', 0x646b60, 3);
    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x1e2723,
      roughness: 0.93,
    });
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 12), legMat);
    pelvis.scale.set(1.04, 0.62, 0.72);
    pelvis.position.y = 0.84;
    pelvis.castShadow = true;
    this.fallbackModel.add(pelvis);
    this.leftLeg = new THREE.Group();
    this.rightLeg = new THREE.Group();
    const legs = [this.leftLeg, this.rightLeg];
    for (const [i, leg] of legs.entries()) {
      leg.position.set(i === 0 ? -0.13 : 0.13, 0.82, 0);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.14, 6, 12), legMat);
      thigh.position.y = -0.17;
      thigh.castShadow = true;
      leg.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.34;
      leg.add(knee);
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.15, 6, 12), legMat);
      shin.position.y = -0.16;
      shin.castShadow = true;
      knee.add(shin);
      const foot = new THREE.Group();
      foot.position.set(0, -0.33, 0);
      knee.add(foot);
      const boot = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.16, 0.3, 2, 0.025), bootMat);
      boot.position.set(0, -0.05, -0.055);
      boot.castShadow = true;
      foot.add(boot);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.31), bootMat);
      sole.position.set(0, -0.12, -0.055);
      foot.add(sole);
      if (i === 0) {
        this.leftKnee = knee;
        this.leftFoot = foot;
      } else {
        this.rightKnee = knee;
        this.rightFoot = foot;
      }
      this.fallbackModel.add(leg);
    }
    this.addExpeditionEquipment();
    for (const part of [...this.fallbackModel.children])
      if (part.position.y >= 1.65 && Math.abs(part.position.z) < 0.25) {
        part.position.y -= 1.63;
        this.headRig.add(part);
      }
    this.headRig.position.y = 1.63;
    this.headRig.name = 'head-look';
    this.fallbackModel.add(this.headRig, this.bandageWrap);
    this.bandageWrap.visible = false;
    batchRigidParts(this.fallbackModel, new Set([this.bandageWrap, backpack]));
  }

  /** Original meshes, built at runtime with no external model/IP dependency. */
  private addExpeditionEquipment(): void {
    const coat = this.surfaces.material('fabric', 0x65786b, 3);
    const trim = new THREE.MeshStandardMaterial({
      color: 0x8c826b,
      roughness: 0.8,
    });
    const rust = new THREE.MeshStandardMaterial({
      color: 0x796958,
      roughness: 0.79,
    });
    const charcoal = new THREE.MeshStandardMaterial({
      color: 0x182c2a,
      roughness: 0.82,
    });
    const glass = new THREE.MeshStandardMaterial({
      color: 0x6b7971,
      emissive: 0x17211b,
      emissiveIntensity: 0.04,
      metalness: 0.15,
      roughness: 0.3,
    });
    const add = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D = this.fallbackModel,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    // Expedition hood and segmented visor: face looks intentional from frontal and rear angles.
    const hood = add(new THREE.SphereGeometry(0.215, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), coat, 0, 1.9, 0.005);
    hood.scale.set(1.0, 1.06, 0.98);
    const mask = add(new THREE.BoxGeometry(0.27, 0.14, 0.08), charcoal, 0, 1.77, -0.18);
    mask.rotation.x = -0.14;
    add(new THREE.BoxGeometry(0.3, 0.06, 0.035), glass, 0, 1.9, -0.212);
    for (const side of [-1, 1]) {
      // Utility pouch, armband and buckles.
      add(new RoundedBoxGeometry(0.14, 0.2, 0.16, 2, 0.02), charcoal, side * 0.235, 0.86, 0.02);
      add(new THREE.BoxGeometry(0.14, 0.04, 0.2), trim, side * 0.235, 0.96, 0.02);
      add(new THREE.BoxGeometry(0.08, 0.06, 0.025), rust, side * 0.13, 1.27, -0.18);
      const kneepad = add(
        new THREE.SphereGeometry(0.095, 16, 12),
        charcoal,
        0,
        -0.01,
        -0.095,
        side < 0 ? this.leftKnee : this.rightKnee,
      );
      kneepad.scale.set(1.05, 0.82, 0.52);
    }
    for (const side of [-1, 1]) {
      const seam = add(new THREE.BoxGeometry(0.013, 0.47, 0.014), trim, side * 0.155, 1.15, 0.365);
      seam.rotation.z = side * 0.03;
      for (let k = 0; k < 6; k++)
        add(new THREE.BoxGeometry(0.024, 0.009, 0.014), trim, side * 0.12, 1.08 + k * 0.035, 0.369);
      add(new THREE.BoxGeometry(0.15, 0.016, 0.04), charcoal, side * 0.115, 1.35, -0.17);
    }
    // Layered field harness, chest pockets and asymmetric rescue marker.
    for (const side of [-1, 1]) {
      const strap = add(new RoundedBoxGeometry(0.052, 0.55, 0.025, 1, 0.008), charcoal, side * 0.16, 1.22, -0.157);
      strap.rotation.z = side * -0.09;
      add(new RoundedBoxGeometry(0.12, 0.15, 0.055, 1, 0.012), coat, side * 0.09, 1.2, -0.183);
      add(new THREE.BoxGeometry(0.12, 0.025, 0.06), trim, side * 0.09, 1.265, -0.19);
      const cuff = add(
        new THREE.CylinderGeometry(0.071, 0.071, 0.07, 10),
        charcoal,
        0,
        -0.24,
        0,
        side < 0 ? this.leftElbow : this.rightElbow,
      );
      cuff.name = 'reinforced-cuff';
    }
    add(new THREE.BoxGeometry(0.016, 0.42, 0.017), rust, 0, 1.19, -0.172);
    const marker = new THREE.MeshStandardMaterial({
      color: 0xd3a66b,
      roughness: 0.84,
    });
    add(new THREE.BoxGeometry(0.12, 0.09, 0.025), marker, -0.07, -0.11, -0.065, this.leftArm);
    // Field radio transmitter: unmistakable back silhouette.
    add(new THREE.CylinderGeometry(0.018, 0.026, 0.5, 6), charcoal, 0.18, 1.6, 0.3);
    add(new THREE.SphereGeometry(0.018, 10, 8), glass, 0.18, 1.85, 0.3);
    add(new THREE.BoxGeometry(0.46, 0.22, 0.11), coat, 0, 1.35, 0.34);
    add(new THREE.BoxGeometry(0.37, 0.055, 0.12), trim, 0, 1.35, 0.405);
  }

  update(direction: THREE.Vector3, deltaSeconds: number, sprinting: boolean, world: World): void {
    this.isMoving = direction.lengthSq() > 0.0001 && this.health > 0;

    if (this.isMoving) {
      this.movementAmount = Math.min(1, direction.length());
      const forward = new THREE.Vector3(-Math.sin(this.root.rotation.y), 0, -Math.cos(this.root.rotation.y));
      const right = new THREE.Vector3(Math.cos(this.root.rotation.y), 0, -Math.sin(this.root.rotation.y));
      this.motionForward = direction.clone().normalize().dot(forward);
      this.motionSide = direction.clone().normalize().dot(right);
      const speed = sprinting ? 8.0 : 4.8;
      this.root.position.addScaledVector(direction, speed * deltaSeconds);
      world.constrainPlayerPosition(this.root.position);

      const targetYaw = this.weaponRaised ? this.aimYaw : Math.atan2(-direction.x, -direction.z);
      const angleDifference =
        THREE.MathUtils.euclideanModulo(targetYaw - this.root.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      this.root.rotation.y += angleDifference * Math.min(1, deltaSeconds * 13);
    }

    if (!this.isMoving) this.movementAmount = 0;
    if (this.weaponRaised) this.root.rotation.y = this.aimYaw;
    this.animate(deltaSeconds, this.isMoving, sprinting);
  }

  private animate(deltaSeconds: number, moving: boolean, sprinting: boolean): void {
    this.isMoving = moving;
    this.fallenBlend = THREE.MathUtils.damp(this.fallenBlend, this.health <= 0 ? 1 : 0, 5, deltaSeconds);
    this.hitReaction = THREE.MathUtils.damp(this.hitReaction, 0, 12, deltaSeconds);
    this.recoilTime = Math.max(0, this.recoilTime - deltaSeconds);
    this.raisedTime = Math.max(0, this.raisedTime - deltaSeconds);
    this.movementBlend = THREE.MathUtils.damp(
      this.movementBlend,
      this.isMoving ? this.movementAmount : 0,
      10,
      deltaSeconds,
    );
    this.sprintBlend = THREE.MathUtils.damp(this.sprintBlend, this.isMoving && sprinting ? 1 : 0, 9, deltaSeconds);
    this.idleClock += deltaSeconds;
    this.aimBlend = THREE.MathUtils.damp(this.aimBlend, this.weaponRaised ? 1 : 0, 16, deltaSeconds);
    this.animator.setState(
      this.health <= 0
        ? 'death'
        : this.attackTime > 0
          ? 'attack'
          : this.isMoving
            ? sprinting
              ? 'run'
              : 'walk'
            : 'idle',
    );
    this.animator.update(deltaSeconds);
    this.walkClock += deltaSeconds * (11 + this.sprintBlend * 5) * (moving ? Math.max(0.45, this.movementAmount) : 0);
    this.attackTime = Math.max(0, this.attackTime - deltaSeconds);
    const bob =
      this.movementBlend * Math.abs(Math.sin(this.walkClock)) * (0.018 + this.sprintBlend * 0.016) +
      Math.sin(this.idleClock * 1.9) * 0.009;
    this.visual.position.y = bob + this.fallenBlend * 0.14;
    this.visual.rotation.z = -this.fallenBlend * 1.47 + this.hitReaction * 0.055;
    this.visual.rotation.x = this.fallenBlend * 0.12 - this.hitReaction * 0.08;

    const attackProgress = this.attackTime > 0 ? 1 - this.attackTime / 0.28 : 0;
    const attackSwing = attackProgress > 0 ? Math.sin(attackProgress * Math.PI) * 1.85 : 0;
    this.fallbackModel.visible = !this.animator.installed;
    const weight = this.movementBlend;
    for (const [i, leg] of [this.leftLeg, this.rightLeg].entries()) {
      const knee = i === 0 ? this.leftKnee : this.rightKnee,
        foot = i === 0 ? this.leftFoot : this.rightFoot;
      const cycle = footCycle(this.walkClock + i * Math.PI, this.sprintBlend);
      leg.position.y = 0.82 - weight * (0.065 + this.sprintBlend * 0.035);
      const desiredY = 0.15 - leg.position.y - bob + cycle.lift * weight;
      const pose = solveLeg(desiredY, cycle.z * weight * (Math.abs(this.motionForward) > 0.2 ? this.motionForward : 1));
      leg.rotation.x = pose.hip * weight;
      knee.rotation.x = pose.knee * weight;
      foot.rotation.x = pose.foot * weight;
      leg.rotation.z = this.motionSide * weight * Math.sin(this.walkClock + i * Math.PI) * 0.15;
    }
    this.fallbackModel.rotation.z = weight * Math.sin(this.walkClock) * 0.014 - this.motionSide * weight * 0.055;
    this.fallbackModel.rotation.x = this.sprintBlend * -0.09 - this.aimBlend * 0.025;
    this.fallbackModel.rotation.y =
      Math.sin((this.attackTime / 0.28) * Math.PI) * 0.16 - (this.recoilTime / 0.12) * 0.025;
    this.headRig.rotation.y = THREE.MathUtils.damp(
      this.headRig.rotation.y,
      Math.sin(this.idleClock * 0.65) * 0.035 * (1 - weight),
      8,
      deltaSeconds,
    );
    this.headRig.rotation.x = THREE.MathUtils.damp(
      this.headRig.rotation.x,
      this.weaponRaised ? -this.aimPitch * 0.12 : Math.sin(this.idleClock * 0.9) * 0.015,
      10,
      deltaSeconds,
    );
    this.bandageWrap.visible = this.bandaging && this.health > 0;
    const raised = this.weaponRaised && !this.reloading;
    const reloadWave = this.reloading ? Math.sin(this.reloadProgress * Math.PI) : 0;
    const rifle = this.weapon === 'rifle';
    const targetPosition = new THREE.Vector3(
      rifle ? (raised ? 0.14 : 0.09) : raised ? 0.21 : 0.25,
      raised ? 1.44 : 1.24,
      rifle ? -0.14 : raised ? -0.37 : -0.21,
    );
    targetPosition.y -= reloadWave * 0.18;
    targetPosition.x += Math.sin(this.walkClock) * weight * (raised ? 0.004 : 0.018);
    if (this.bandaging) targetPosition.y = 1.0;
    targetPosition.y += bob * 0.5;
    this.weaponSocket.position.lerp(targetPosition, 1 - Math.exp(-18 * deltaSeconds));
    const recoil = this.recoilTime / 0.12;
    const pitch = raised ? -this.aimPitch : -0.55 - this.sprintBlend * 0.2;
    this.weaponSocket.rotation.x = THREE.MathUtils.damp(
      this.weaponSocket.rotation.x,
      pitch + recoil * 0.11 - reloadWave * 0.28,
      17,
      deltaSeconds,
    );
    this.weaponSocket.rotation.y = THREE.MathUtils.damp(
      this.weaponSocket.rotation.y,
      reloadWave * -0.35,
      15,
      deltaSeconds,
    );
    this.weaponSocket.rotation.z = THREE.MathUtils.damp(
      this.weaponSocket.rotation.z,
      reloadWave * -0.55,
      15,
      deltaSeconds,
    );
    this.weaponSocket.visible = this.health > 0 && !this.bandaging;
    this.gun.update(deltaSeconds, this.weapon, this.reloading ? this.reloadProgress : 0);
    this.root.updateWorldMatrix(true, true);
    const handTarget = (x: number, y: number, z: number) =>
      this.fallbackModel.worldToLocal(this.weaponSocket.localToWorld(new THREE.Vector3(x, y, z)));
    const rightHand = handTarget(0, -0.1, 0.035);
    const leftHand = this.weapon === 'rifle' ? handTarget(-0.045, -0.04, -0.28) : handTarget(-0.09, -0.1, 0.01);
    if (!this.reloading && !this.bandaging) {
      this.relaxedHand.set(
        -0.25,
        1.02 + Math.sin(this.walkClock) * weight * 0.1,
        0.04 - Math.cos(this.walkClock) * weight * 0.12,
      );
      leftHand.lerp(this.relaxedHand, 1 - this.aimBlend);
    }
    if (this.bandaging) {
      leftHand.set(-0.06, 1.34, -0.25);
      rightHand.set(-0.02 + Math.sin(this.idleClock * 15) * 0.025, 1.2, -0.29);
      this.bandageWrap.position.copy(leftHand);
      this.bandageWrap.rotation.set(Math.PI / 2, this.idleClock * 5, 0);
    }
    if (this.reloading) {
      leftHand.y -= reloadWave * 0.22;
      leftHand.z += reloadWave * 0.1;
    }
    if (this.attackTime > 0) {
      rightHand.z -= attackSwing * 0.1;
      rightHand.y += attackSwing * 0.12;
    }
    this.poseArm(this.rightArm, this.rightElbow, rightHand, 1);
    this.poseArm(this.leftArm, this.leftElbow, leftHand, -1);
  }

  private poseArm(shoulder: THREE.Group, elbow: THREE.Group, target: THREE.Vector3, side: number): void {
    const pose = solveArm(shoulder.position, target, {
      x: side * 0.55,
      y: -0.8,
      z: 0.25,
    });
    const down = new THREE.Vector3(0, -1, 0);
    const upperDirection = new THREE.Vector3(pose.elbow.x, pose.elbow.y, pose.elbow.z)
      .sub(shoulder.position)
      .normalize();
    shoulder.quaternion.setFromUnitVectors(down, upperDirection);
    const lowerDirection = new THREE.Vector3(
      pose.wrist.x - pose.elbow.x,
      pose.wrist.y - pose.elbow.y,
      pose.wrist.z - pose.elbow.z,
    ).normalize();
    const worldLower = new THREE.Quaternion().setFromUnitVectors(down, lowerDirection);
    elbow.quaternion.copy(shoulder.quaternion).invert().multiply(worldLower);
  }

  updateRemote(
    state: {
      x: number;
      z: number;
      yaw: number;
      hp: number;
      reloadProgress?: number;
      survival?: { healEndsAt: number };
    } & Partial<ActorPose>,
    dt: number,
  ): void {
    const moving = Math.hypot(state.x - this.root.position.x, state.z - this.root.position.z) > 0.0005;
    this.root.position.set(state.x, 0, state.z);
    this.root.rotation.y = state.yaw;
    this.remoteDeathTime = state.hp > 0 ? 0 : this.remoteDeathTime + dt;
    this.root.visible = state.hp > 0 || this.remoteDeathTime < 0.9;
    this.health = state.hp;
    this.bandaging = (state.survival?.healEndsAt || 0) > Date.now();
    this.movementAmount = moving ? 1 : 0;
    this.weapon = state.weapon || 'pistol';
    this.aiming = state.aiming === true;
    this.aimPitch = state.pitch || 0;
    this.reloading = (state.reloadProgress ?? 0) > 0;
    this.reloadProgress = state.reloadProgress || 0;
    this.animate(dt, moving, state.sprinting === true);
  }
  triggerShot(weapon: WeaponId = this.weapon): void {
    this.weapon = weapon;
    this.recoilTime = 0.12;
    this.raisedTime = 0.32;
    this.gun.fire();
  }
  setEffectsLights(enabled: boolean): void {
    this.gun.setLightsEnabled(enabled);
  }
  muzzlePosition(): THREE.Vector3 {
    return this.gun.muzzlePosition();
  }

  triggerAttack(): void {
    this.animator.setState('attack', true);
    this.attackTime = 0.28;
  }

  takeDamage(amount: number): number {
    if (this.health <= 0) return 0;
    const applied = Math.min(this.health, Math.max(0, amount));
    this.health = Math.max(0, this.health - applied);
    if (applied > 0) this.hitReaction = 1;
    return applied;
  }

  heal(amount: number): number {
    if (this.health <= 0 || !Number.isFinite(amount) || amount <= 0) return 0;
    const applied = Math.min(100 - this.health, amount);
    this.health += applied;
    return applied;
  }

  getHealth(): number {
    return this.health;
  }

  getPosition(): THREE.Vector3 {
    return this.root.position;
  }

  async installModel(entry: ModelEntry): Promise<void> {
    if (await this.animator.load(entry)) {
      this.fallbackModel.visible = !this.animator.installed;
      if (this.animator.equipment) {
        const pack = this.fallbackModel.getObjectByName('fallback-pack');
        if (pack) pack.visible = false;
      }
    }
  }

  reset(): void {
    this.health = 100;
    this.bandaging = false;
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.visual.position.set(0, 0, 0);
    this.visual.rotation.set(0, 0, 0);
    this.fallenBlend = 0;
    this.hitReaction = 0;
    this.attackTime = 0;
    this.recoilTime = 0;
    this.raisedTime = 0;
    this.reloading = false;
    this.reloadProgress = 0;
  }

  dispose(): void {
    this.gun.dispose();
    releaseActorSurfaces();
    this.animator.dispose();
    this.scene.remove(this.root);
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
  }
}
