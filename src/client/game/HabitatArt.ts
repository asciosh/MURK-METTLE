import * as THREE from 'three';
import { CREATURES, type SpeciesId } from '../../../shared/expansion.mjs';
import { SurfaceMaterials } from './SurfaceMaterials';

/** Original habitat dressing. Named anchors reserve art attachment points, not gameplay triggers. */
export const HABITAT_ART = Object.freeze({
  lanternkin: { color: 0x98c6aa, ground: 0x78916b, motif: 'seed-lantern nursery' },
  emberling: { color: 0xc18b56, ground: 0x4e4136, motif: 'abandoned ash hearth' },
  mossback: { color: 0x91a568, ground: 0x587257, motif: 'old moss survey grove' },
  stormrook: { color: 0xa8bdca, ground: 0x777e79, motif: 'storm-scarred roost' },
  reedwisp: { color: 0x91c8bf, ground: 0x507b74, motif: 'reedwater bloom' },
});
export function addHabitatArt(
  scene: THREE.Scene,
  surfaces: SurfaceMaterials,
  leaf: THREE.Texture,
): THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> {
  const entries = Object.entries(HABITAT_ART) as [SpeciesId, (typeof HABITAT_ART)[SpeciesId]][];
  const fronds = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshStandardMaterial({ map: leaf, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 }),
    entries.length * 16,
  );
  const seeds = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.075, 0),
    new THREE.MeshBasicMaterial(),
    entries.length * 8,
  );
  const patchMaterial = surfaces.material('forest', 0xffffff, 1);
  patchMaterial.transparent = true; patchMaterial.opacity = .48; patchMaterial.depthWrite = false;
  patchMaterial.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 habitatUv;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhabitatUv=uv;');
    shader.fragmentShader = 'varying vec2 habitatUv;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>',`float edge=length((habitatUv-.5)*2.);float breakup=sin(habitatUv.x*31.)*sin(habitatUv.y*27.)*.14;diffuseColor.a*=1.-smoothstep(.38,1.,edge+breakup);if(diffuseColor.a<.02)discard;\n#include <alphatest_fragment>`);
  };
  patchMaterial.customProgramCacheKey = () => 'soft-habitat-ground-v1';
  const patches = new THREE.InstancedMesh(new THREE.PlaneGeometry(8,8),patchMaterial,entries.length);
  patches.geometry.rotateX(-Math.PI / 2);
  const transform = new THREE.Object3D(),
    color = new THREE.Color();
  for (const [h, [species, art]] of entries.entries()) {
    const home = CREATURES[species];
    const anchor = new THREE.Group();
    anchor.name = `habitat-anchor-${species}`;
    anchor.position.set(home.x, 0, home.z);
    anchor.userData = { species, visualOnly: true, motif: art.motif };
    scene.add(anchor);
    transform.position.set(home.x, -0.012, home.z);
    transform.rotation.set(0, h * 0.7, 0);
    transform.scale.set(1, 1, 1);
    transform.updateMatrix();
    patches.setMatrixAt(h, transform.matrix);
    patches.setColorAt(h, color.setHex(art.ground));
    for (let i = 0; i < 16; i++) {
      const a = (i % 3) * 2.1 + Math.sin(i * 3.1) * .22,
        r = 3.2 + (Math.floor(i / 3) % 5) * .32;
      transform.position.set(home.x + Math.cos(a) * r, 0.25, home.z + Math.sin(a) * r);
      transform.rotation.set(species === 'emberling' ? 0.8 : 0.12, a, h === 3 ? 0.35 : 0);
      transform.scale.set(
        species === 'mossback' ? 1.6 : 1,
        species === 'emberling' ? 0.45 : species === 'reedwisp' ? 1.35 : 1,
        1,
      );
      transform.updateMatrix();
      fronds.setMatrixAt(h * 16 + i, transform.matrix);
      fronds.setColorAt(h * 16 + i, color.setHex(art.ground).lerp(new THREE.Color(0xffffff), species === 'emberling' ? 0 : .65).multiplyScalar(species === 'emberling' ? .65 : 1));
    }
    for (let i = 0; i < 8; i++) {
      const a = (i % 3) * 2.1 + Math.cos(i) * .17,
        r = 3.2 + Math.floor(i / 3) * .3;
      transform.position.set(home.x + Math.cos(a) * r, species === 'reedwisp' ? .18 : species === 'emberling' || species === 'mossback' ? .04 : .16, home.z + Math.sin(a) * r);
      transform.rotation.set(0, a, species === 'stormrook' ? 0.55 : 0);
      transform.scale.set(species === 'stormrook' ? .35 : species === 'mossback' ? 1.8 : 1, species === 'lanternkin' ? 2 : species === 'stormrook' ? 2.8 : species === 'mossback' || species === 'emberling' ? .35 : 1,1);
      transform.updateMatrix();
      seeds.setMatrixAt(h * 8 + i, transform.matrix);
      seeds.setColorAt(h * 8 + i, color.setHex(art.color).multiplyScalar(0.8));
    }
  }
  fronds.name = 'habitat-fronds';
  seeds.name = 'habitat-seed-and-feather-details';
  patches.name = 'flat-habitat-material-patches';
  for (const mesh of [fronds, seeds, patches]) {
    mesh.computeBoundingSphere();
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  return fronds;
}
