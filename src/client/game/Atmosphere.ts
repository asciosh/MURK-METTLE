import * as THREE from 'three';

/** Layered cloud cover and a restrained sun halo, in linear light for the scene and PMREM. */
export function createAtmosphere(): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      cloudTime:{value:0},cloudLayers:{value:5},
      sunDirection: { value: new THREE.Vector3(-25, 35, 18).normalize() },
      zenith: { value: new THREE.Color(0x587385) },
      horizon: { value: new THREE.Color(0xb8b5a6) },
    },
    vertexShader: `varying vec3 vSkyDirection;void main(){vSkyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec3 vSkyDirection;uniform vec3 sunDirection;uniform vec3 zenith;uniform vec3 horizon;uniform float cloudTime;uniform float cloudLayers;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){if(float(i)>=cloudLayers)break;v+=noise(p)*a;p=p*2.03+17.1;a*=.5;}return v;}
  void main(){vec3 d=normalize(vSkyDirection);float elevation=max(0.,d.y);vec3 sky=mix(horizon,zenith,pow(elevation,.42));
  vec2 p=d.xz/(elevation+.25)*2.0;float cloud=fbm(p+vec2(12.4,3.7)+vec2(cloudTime*.007,cloudTime*.003));float coverage=smoothstep(.37,.68,cloud)*smoothstep(0.,.25,elevation);
  vec3 cloudColor=mix(vec3(.31,.34,.35),vec3(.73,.71,.65),smoothstep(.42,.8,cloud));
  sky=mix(sky,cloudColor,coverage*.87);float sun=max(0.,dot(d,sunDirection));sky+=vec3(1.,.77,.48)*pow(sun,38.)*.22*(1.-coverage*.6);
  sky+=vec3(2.8,2.35,1.7)*smoothstep(.99965,.9999,sun)*(1.-coverage*.94);
  gl_FragColor=vec4(sky,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 20), material);
  sky.name = 'clouded-afternoon-sky';
  sky.frustumCulled = false;
  return sky;
}
