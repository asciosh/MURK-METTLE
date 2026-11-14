import * as THREE from 'three';
import { SurfaceMaterials } from './SurfaceMaterials';

/** World-space PBR blending avoids a single flat, repeated ground swatch. No gameplay displacement. */
export function terrainMaterial(surfaces: SurfaceMaterials): THREE.MeshStandardMaterial {
  const material = surfaces.material('earth', 0xffffff, 88.2);
  const forest = surfaces.get('forest'),
    asphalt = surfaces.get('asphalt');
  material.onBeforeCompile = (shader) => {
    shader.uniforms.fieldForest = { value: forest.map };
    shader.uniforms.fieldForestNormal = { value: forest.normalMap };
    shader.uniforms.fieldForestRough = { value: forest.roughnessMap };
    shader.uniforms.fieldRoadNormal = { value: asphalt.normalMap };
    shader.uniforms.fieldRoadRough = { value: asphalt.roughnessMap };
    shader.uniforms.fieldRoad = { value: asphalt.map };
    shader.vertexShader = 'varying vec3 vFieldPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\nvFieldPosition=(modelMatrix*vec4(transformed,1.)).xyz;',
    );
    shader.fragmentShader =
      `varying vec3 vFieldPosition;uniform sampler2D fieldForest;uniform sampler2D fieldRoad;
    uniform sampler2D fieldForestNormal;uniform sampler2D fieldForestRough;uniform sampler2D fieldRoadNormal;uniform sampler2D fieldRoadRough;
    float fieldHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float fieldNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(fieldHash(i),fieldHash(i+vec2(1,0)),f.x),mix(fieldHash(i+vec2(0,1)),fieldHash(i+vec2(1,1)),f.x),f.y);}
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
    vec2 groundUV=vFieldPosition.xz*.42;float macro=fieldNoise(vFieldPosition.xz*.085);float detail=fieldNoise(vFieldPosition.xz*.55);
    float northRoad=1.-smoothstep(3.2,5.2,abs(vFieldPosition.x)+(macro-.5)*1.8);
    float crossRoad=(1.-smoothstep(1.8,3.4,abs(vFieldPosition.z)+(macro-.5)))*step(-55.,vFieldPosition.x)*step(vFieldPosition.x,65.);
    float path=max(northRoad,crossRoad);
    vec3 soil=texture2D(map,groundUV).rgb;
    vec3 leaves=texture2D(fieldForest,groundUV*1.7+vec2(.21)).rgb;
    float soilWeight=smoothstep(.28,.72,macro+path*.65);
    vec3 dirt=mix(leaves,soil,soilWeight);
    float town=step(-78.,vFieldPosition.z)*step(vFieldPosition.z,-30.)*(1.-smoothstep(3.1,4.2,abs(vFieldPosition.x)));
    dirt=mix(dirt,texture2D(fieldRoad,groundUV*1.25).rgb,town);
    dirt*=mix(.70,1.13,macro)*mix(.92,1.05,detail);
    diffuseColor.rgb*=dirt;
    vec4 fieldNormal=mix(texture2D(fieldForestNormal,groundUV*1.7+vec2(.21)),texture2D(normalMap,groundUV),soilWeight);
    fieldNormal=mix(fieldNormal,texture2D(fieldRoadNormal,groundUV*1.25),town);fieldNormal.g=1.-fieldNormal.g;
    float fieldRough=mix(texture2D(fieldForestRough,groundUV*1.7+vec2(.21)).g,texture2D(roughnessMap,groundUV).g,soilWeight);
    fieldRough=mix(fieldRough,texture2D(fieldRoadRough,groundUV*1.25).g,town);

    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      'float roughnessFactor=roughness*fieldRough;',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      THREE.ShaderChunk.normal_fragment_maps.replaceAll('texture2D( normalMap, vNormalMapUv )', 'fieldNormal'),
    );
  };
  material.customProgramCacheKey = () => 'field-pbr-terrain-v025';
  return material;
}
