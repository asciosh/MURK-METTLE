import * as THREE from 'three';

/** Original pointed, folded leaf/feather. Root at (0,0,0), tip along +Y.
 * Real curved geometry (96 triangles), no alpha overdraw or downloaded texture.
 */
export function leafGeometry(width: number, length: number, curl = 0.15, serration = 0, rows = 12): THREE.BufferGeometry {
  const position: number[] = [], uv: number[] = [], color: number[] = [], index: number[] = [];
  const columns = 4;
  for (let y = 0; y <= rows; y++) {
    const t = y / rows;
    const silhouette = Math.pow(Math.sin(Math.PI * t), 0.7) * (1 + serration * Math.sin(t * Math.PI * 12));
    for (let x = 0; x <= columns; x++) {
      const side = x / columns * 2 - 1;
      position.push(side * width * 0.5 * silhouette, t * length,
        curl * t * t - width * 0.16 * (1 - Math.abs(side)) * Math.sin(Math.PI * t));
      uv.push(x / columns, t);
      const tone = 0.63 + t * 0.27 + (1 - Math.abs(side)) * 0.1;
      color.push(tone, tone, tone);
      if (y < rows && x < columns) {
        const a = y * (columns + 1) + x, b = a + columns + 1;
        index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** Tapered curved stem, horn or root; authoring coordinates are retained in source. */
export function stemGeometry(points: [number, number, number][], radius: number, segments = 12): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const sides = 6;
  const geometry = new THREE.TubeGeometry(curve, segments, radius, sides, false);
  const positions = geometry.getAttribute('position');
  const center = new THREE.Vector3(), p = new THREE.Vector3();
  for (let ring = 0; ring <= segments; ring++) {
    curve.getPointAt(ring / segments, center);
    for (let j = 0; j <= sides; j++) {
      const i = ring * (sides + 1) + j;
      p.fromBufferAttribute(positions, i).sub(center).multiplyScalar(1 - ring / segments * 0.86).add(center);
      positions.setXYZ(i, p.x, p.y, p.z);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}
