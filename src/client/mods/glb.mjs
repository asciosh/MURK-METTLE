import { LIMITS, fail, path, validatePNG, object, text } from './format.mjs';
const list = (value, max, label) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) fail(`Invalid ${label} budget`);
  return value;
};
const index = (n, array, label) => {
  if (!Number.isInteger(n) || n < 0 || n >= array.length) fail(`Invalid ${label} index`);
  return array[n];
};
const vector = (a, n, min, max, label) => {
  if (!Array.isArray(a) || a.length !== n || a.some((v) => !Number.isFinite(v) || v < min || v > max))
    fail(`Invalid ${label}`);
  return a;
};
export async function validateGLB(bytes, manifest, files) {
  if (!bytes || bytes.length < 28 || bytes.length > LIMITS.model) fail('Missing or oversized GLB');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    jsonLength = view.getUint32(12, true),
    binAt = 20 + jsonLength;
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.length ||
    jsonLength > 256 * 1024 ||
    jsonLength % 4 ||
    view.getUint32(16, true) !== 0x4e4f534a ||
    binAt + 8 > bytes.length ||
    view.getUint32(binAt + 4, true) !== 0x004e4942 ||
    view.getUint32(binAt, true) !== bytes.length - binAt - 8
  )
    fail('Invalid GLB 2.0 container');
  const gltf = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(20, binAt)));
  let jsonNodes = 0;
  const inspect = (v, depth = 0) => {
    if (++jsonNodes > 24000 || depth > 24) fail('GLB JSON complexity exceeds limits');
    if (v && typeof v === 'object')
      for (const [k, a] of Object.entries(v)) {
        if (
          [
            '__proto__',
            'prototype',
            'constructor',
            'extensions',
            'extensionsUsed',
            'extensionsRequired',
            'extras',
          ].includes(k)
        )
          fail('GLB extensions/extras and reserved keys are unsupported');
        inspect(a, depth + 1);
      }
  };
  inspect(gltf);
  object(
    gltf,
    [
      'asset',
      'scene',
      'scenes',
      'nodes',
      'meshes',
      'materials',
      'accessors',
      'buffers',
      'bufferViews',
      'images',
      'textures',
      'samplers',
      'animations',
      'skins',
    ],
    'GLB root',
  );
  object(gltf.asset, ['version', 'generator', 'copyright', 'minVersion'], 'GLB asset');
  if (gltf.asset.version !== '2.0') fail('GLB version must be 2.0');
  const buffers = list(gltf.buffers, 1, 'buffers'),
    views = list(gltf.bufferViews, 128, 'buffer views'),
    accessors = list(gltf.accessors, 128, 'accessors'),
    nodes = list(gltf.nodes, LIMITS.nodes, 'nodes'),
    meshes = list(gltf.meshes, 24, 'meshes'),
    materials = list(gltf.materials, LIMITS.materials, 'materials'),
    images = list(gltf.images, 4, 'images'),
    textures = list(gltf.textures, 4, 'textures'),
    samplers = list(gltf.samplers, 4, 'samplers'),
    scenes = list(gltf.scenes, 1, 'scenes'),
    animations = list(gltf.animations, LIMITS.clips, 'clips'),
    skins = list(gltf.skins, 1, 'skins');
  if (buffers.length !== 1 || !meshes.length || !nodes.length || scenes.length !== 1)
    fail('GLB needs one scene and one embedded buffer');
  object(buffers[0], ['byteLength'], 'buffer');
  const binSize = bytes.length - binAt - 8;
  if (
    !Number.isInteger(buffers[0].byteLength) ||
    buffers[0].byteLength < binSize - 3 ||
    buffers[0].byteLength > binSize
  )
    fail('Invalid embedded buffer length');
  for (const b of views) {
    object(b, ['buffer', 'byteOffset', 'byteLength', 'byteStride', 'target'], 'buffer view');
    if (b.target !== undefined && ![34962, 34963].includes(b.target)) fail('Invalid buffer target');
    if (
      b.buffer !== 0 ||
      !Number.isInteger(b.byteLength) ||
      b.byteLength < 0 ||
      !Number.isInteger(b.byteOffset ?? 0) ||
      (b.byteOffset ?? 0) < 0 ||
      (b.byteOffset ?? 0) + b.byteLength > buffers[0].byteLength ||
      (b.byteStride !== undefined &&
        (!Number.isInteger(b.byteStride) || b.byteStride < 4 || b.byteStride > 252 || b.byteStride % 4))
    )
      fail('GLB buffer view out of bounds');
  }
  const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 },
    types = {
      5121: [1, 'getUint8'],
      5123: [2, 'getUint16'],
      5125: [4, 'getUint32'],
      5126: [4, 'getFloat32'],
    };
  let valuesTotal = 0;
  const data = accessors.map((a) => {
    object(
      a,
      ['bufferView', 'byteOffset', 'componentType', 'count', 'type', 'min', 'max', 'normalized', 'name'],
      'accessor',
    );
    const t =
        typeof a.componentType === 'number' && Object.hasOwn(types, a.componentType)
          ? types[a.componentType]
          : undefined,
      components = typeof a.type === 'string' && Object.hasOwn(size, a.type) ? size[a.type] : undefined,
      b = index(a.bufferView, views, 'buffer view');
    if (
      !t ||
      !components ||
      !Number.isInteger(a.count) ||
      a.count < 1 ||
      (valuesTotal += a.count * components) > 250000 ||
      !Number.isInteger(a.byteOffset ?? 0) ||
      (a.byteOffset ?? 0) < 0 ||
      (a.byteOffset ?? 0) % t[0] ||
      (a.normalized !== undefined && typeof a.normalized !== 'boolean')
    )
      fail('Invalid accessor budget');
    const stride = b.byteStride ?? components * t[0],
      base = (b.byteOffset ?? 0) + (a.byteOffset ?? 0);
    if (
      stride < components * t[0] ||
      stride % t[0] ||
      (a.byteOffset ?? 0) + (a.count - 1) * stride + components * t[0] > b.byteLength ||
      base % t[0]
    )
      fail('Accessor exceeds its buffer view');
    if (a.min !== undefined) vector(a.min, components, -1e6, 1e6, 'accessor minimum');
    if (a.max !== undefined) vector(a.max, components, -1e6, 1e6, 'accessor maximum');
    const values = [];
    for (let i = 0; i < a.count; i++)
      for (let c = 0; c < components; c++) {
        const value = view[t[1]](binAt + 8 + base + i * stride + c * t[0], true);
        if (!Number.isFinite(value) || Math.abs(value) > 1e6) fail('Non-finite or excessive accessor value');
        values.push(value);
      }
    return values;
  });
  let triangles = 0,
    vertices = 0,
    primitives = 0;
  const meshRadius = [];
  const meshCost = [];
  const meshSkinned = [];
  const skin = skins[0];
  const joints = skin ? list(skin.joints, 32, 'skin joints') : [];
  const jointSet = new Set(joints);
  if (skin) {
    object(skin, ['name', 'joints', 'skeleton', 'inverseBindMatrices'], 'skin');
    if (!joints.length || jointSet.size !== joints.length) fail('Skin needs unique joints');
    for (const id of joints) index(id, nodes, 'joint');
    if (!jointSet.has(skin.skeleton)) fail('Skin needs an explicit skeleton root joint');
    const bind = index(skin.inverseBindMatrices, accessors, 'inverse bind');
    if (bind.type !== 'MAT4' || bind.componentType !== 5126 || bind.normalized || bind.count !== joints.length)
      fail('Invalid inverse bind matrices');
    for (let i = 0; i < joints.length; i++) {
      const m = data[skin.inverseBindMatrices].slice(i * 16, i * 16 + 16);
      const columns = [m.slice(0, 3), m.slice(4, 7), m.slice(8, 11)];
      const dot = (a, b) => a.reduce((sum, x, k) => sum + x * b[k], 0);
      if ([m[3], m[7], m[11], m[15] - 1].some(v => Math.abs(v) > 0.0001) ||
          Math.hypot(...m.slice(12, 15)) > 8 ||
          columns.some((c, j) => columns.some((d, k) => Math.abs(dot(c, d) - Number(j === k)) > 0.0001)))
        fail('Inverse bind matrices must be bounded rigid affine transforms');
      const [a, b, c] = columns;
      if (dot([a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]], c) < 0.999)
        fail('Reflected inverse bind matrix');
    }
  }
  for (const mesh of meshes) {
    const before = { triangles, vertices, primitives };
    object(mesh, ['name', 'primitives'], 'mesh');
    if (mesh.name !== undefined && !/^[-_a-zA-Z0-9]{1,48}$/.test(mesh.name)) fail('Invalid mesh name');
    let radius = 0;
    let skinned;
    for (const p of list(mesh.primitives, LIMITS.primitives, 'primitives')) {
      if (++primitives > LIMITS.primitives) fail('Primitive budget exceeded');
      object(p, ['attributes', 'indices', 'material', 'mode'], 'primitive');
      if ((p.mode ?? 4) !== 4) fail('Only triangle meshes are supported');
      object(
        p.attributes,
        ['POSITION', 'NORMAL', 'TEXCOORD_0', 'TEXCOORD_1', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0'],
        'vertex attributes',
      );
      const pos = index(p.attributes.POSITION, accessors, 'position');
      const hasSkin = p.attributes.JOINTS_0 !== undefined;
      if (hasSkin !== (p.attributes.WEIGHTS_0 !== undefined) || (hasSkin && !skin) ||
          (skinned !== undefined && skinned !== hasSkin)) fail('Inconsistent skin attributes');
      skinned = hasSkin;
      if (hasSkin) {
        const j = index(p.attributes.JOINTS_0, accessors, 'joint attribute');
        const w = index(p.attributes.WEIGHTS_0, accessors, 'weight attribute');
        if (j.type !== 'VEC4' || ![5121, 5123].includes(j.componentType) || j.normalized ||
            w.type !== 'VEC4' || w.componentType !== 5126 || w.normalized ||
            data[p.attributes.JOINTS_0].some(v => v >= joints.length)) fail('Invalid skin joint or weight attribute');
        const weights = data[p.attributes.WEIGHTS_0];
        if (weights.some(v => v < 0 || v > 1)) fail('Invalid skin weight range');
        for (let i = 0; i < weights.length; i += 4)
          if (Math.abs(weights.slice(i, i + 4).reduce((a, b) => a + b, 0) - 1) > 0.0001)
            fail('Skin weights must sum to one');
      }
      if (pos.componentType !== 5126 || pos.type !== 'VEC3' || pos.normalized)
        fail('Positions must be float VEC3');
      vertices += pos.count;
      const positions = data[p.attributes.POSITION];
      for (let i = 0; i < positions.length; i += 3) {
        const r = Math.hypot(...positions.slice(i, i + 3));
        if (r > 8) fail('Geometry coordinate budget exceeded');
        radius = Math.max(radius, r);
      }
      for (const [kind, a] of Object.entries(p.attributes)) {
        const attr = index(a, accessors, 'attribute');
        if (attr.count !== pos.count) fail('Attribute count mismatch');
        if (kind === 'NORMAL' && (attr.type !== 'VEC3' || attr.componentType !== 5126))
          fail('Invalid normals');
        if (kind.startsWith('TEXCOORD') && attr.type !== 'VEC2') fail('Invalid texture coordinates');
        if (
          kind === 'COLOR_0' &&
          (!['VEC3', 'VEC4'].includes(attr.type) ||
            data[a].some((v) => v < 0 || v > (attr.componentType === 5126 ? 1 : 65535)))
        )
          fail('Invalid vertex colors');
        if (kind === 'NORMAL' && data[a].some((v) => Math.abs(v) > 1.001)) fail('Invalid normals');
        if (
          kind.startsWith('TEXCOORD') &&
          attr.componentType === 5126 &&
          data[a].some((v) => Math.abs(v) > 16)
        )
          fail('Invalid texture coordinate range');
      }
      if (p.indices !== undefined) {
        const a = index(p.indices, accessors, 'indices');
        if (
          a.type !== 'SCALAR' ||
          a.componentType === 5126 ||
          a.normalized ||
          data[p.indices].some((n) => n >= pos.count) ||
          a.count % 3
        )
          fail('Invalid triangle indices');
        triangles += a.count / 3;
      } else {
        if (pos.count % 3) fail('Invalid triangle vertices');
        triangles += pos.count / 3;
      }
      if (p.material !== undefined) index(p.material, materials, 'material');
    }
    meshRadius.push(radius);
    meshSkinned.push(Boolean(skinned));
    meshCost.push({
      triangles: triangles - before.triangles,
      vertices: vertices - before.vertices,
      primitives: primitives - before.primitives,
    });
  }
  if (!triangles || triangles > LIMITS.triangles || vertices > LIMITS.vertices)
    fail('Geometry budget exceeded');
  const names = new Set(),
    parents = new Set();
  for (const node of nodes) {
    object(node, ['name', 'mesh', 'children', 'translation', 'rotation', 'scale', 'skin'], 'node');
    if (node.name !== undefined) {
      if (typeof node.name !== 'string' || !/^[-_a-zA-Z0-9]{1,48}$/.test(node.name) || names.has(node.name))
        fail('Node names must be unique simple identifiers');
      names.add(node.name);
    }
    if (node.mesh !== undefined) index(node.mesh, meshes, 'mesh');
    if (node.skin !== undefined && (node.skin !== 0 || !skin || node.mesh === undefined || !meshSkinned[node.mesh]))
      fail('Invalid skinned mesh node');
    if (node.mesh !== undefined && meshSkinned[node.mesh] && node.skin !== 0) fail('Missing mesh skin');
    if (node.translation) vector(node.translation, 3, -2, 2, 'node translation');
    if (node.scale) vector(node.scale, 3, 0.001, 2, 'node scale');
    if (node.rotation) {
      vector(node.rotation, 4, -1, 1, 'node rotation');
      if (Math.abs(Math.hypot(...node.rotation) - 1) > 0.01) fail('Node quaternion is not normalized');
    }
    for (const child of list(node.children, LIMITS.nodes, 'children')) {
      index(child, nodes, 'node');
      if (parents.has(child)) fail('Node has multiple parents');
      parents.add(child);
    }
  }
  object(scenes[0], ['nodes', 'name'], 'scene');
  const roots = list(scenes[0].nodes, LIMITS.nodes, 'roots');
  if (gltf.scene !== undefined && gltf.scene !== 0) fail('Invalid default scene');
  const visited = new Set();
  const offsets = new Map();
  let radius = 0;
  const visit = (id, depth, offset, scale) => {
    const n = index(id, nodes, 'node');
    if (depth > (skin ? 12 : 6) || visited.has(id)) fail('Cyclic, duplicate or excessive node hierarchy');
    visited.add(id);
    offset += Math.hypot(...(n.translation || [0, 0, 0])) * scale;
    scale *= Math.max(...(n.scale || [1, 1, 1]));
    offsets.set(id, offset);
    if (skin && (scale !== 1 || (n.scale || []).some(v => v !== 1) ||
        (n.rotation && Math.abs(Math.hypot(...n.rotation) - 1) > 0.0001))) fail('Skin profile requires unit node transforms');
    if (n.mesh !== undefined) radius = Math.max(radius, offset + scale * meshRadius[n.mesh]);
    for (const c of n.children || []) visit(c, depth + 1, offset, scale);
  };
  for (const root of roots) {
    if (parents.has(root)) fail('Scene root is a child');
    visit(root, 0, 0, 1);
  }
  if (skin) {
    const subtree = new Set();
    const gather = id => { subtree.add(id); for (const child of nodes[id].children || []) gather(child); };
    if (visited.size !== nodes.length) fail('Unreachable nodes');
    gather(skin.skeleton);
    if (joints.some(id => !subtree.has(id) || nodes[id].mesh !== undefined || !nodes[id].name))
      fail('Joints must be named mesh-free descendants of the skeleton root');
    const skinNodes = nodes.filter(n => n.skin !== undefined);
    if (!skinNodes.length || skinNodes.length > 4) fail('Invalid skinned mesh instance count');
    for (const n of skinNodes) {
      if (!roots.includes(nodes.indexOf(n)) || (n.translation || []).some(v => v !== 0) ||
          (n.rotation && n.rotation.some((v, i) => v !== Number(i === 3))) || (n.children || []).length)
        fail('Skinned meshes require identity scene-root transforms');
      for (let i = 0; i < joints.length; i++) {
        const bindOffset = Math.hypot(...data[skin.inverseBindMatrices].slice(i * 16 + 12, i * 16 + 15));
        radius = Math.max(radius, 1.01 * (offsets.get(joints[i]) + bindOffset + meshRadius[n.mesh]));
      }
    }
  }
  if (visited.size !== nodes.length || radius < 0.01 || radius > 64)
    fail('Unreachable nodes or invalid visual radius');
  const submitted = { triangles: 0, vertices: 0, primitives: 0 };
  for (const node of nodes)
    if (node.mesh !== undefined) {
      const cost = meshCost[node.mesh];
      submitted.triangles += cost.triangles;
      submitted.vertices += cost.vertices;
      submitted.primitives += cost.primitives;
    }
  if (
    submitted.triangles > LIMITS.triangles ||
    submitted.vertices > LIMITS.vertices ||
    submitted.primitives > LIMITS.primitives
  )
    fail('Repeated mesh nodes exceed the rendered geometry budget');
  const clipNames = new Set();
  let tracks = 0,
    keys = 0;
  for (const clip of animations) {
    object(clip, ['name', 'samplers', 'channels'], 'animation');
    text(clip.name, 48, 'clip name');
    if (clipNames.has(clip.name)) fail('Duplicate clip name');
    clipNames.add(clip.name);
    const ss = list(clip.samplers, 24, 'animation samplers'),
      channels = list(clip.channels, 24, 'animation channels');
    for (const s of ss) {
      object(s, ['input', 'output', 'interpolation'], 'animation sampler');
      const input = index(s.input, accessors, 'animation input'),
        output = index(s.output, accessors, 'animation output');
      if (
        input.type !== 'SCALAR' ||
        input.componentType !== 5126 ||
        output.type !== 'VEC4' ||
        output.componentType !== 5126 ||
        input.count !== output.count ||
        !['LINEAR', 'STEP'].includes(s.interpolation ?? 'LINEAR') ||
        (keys += input.count) > LIMITS.keys
      )
        fail('Unsupported animation sampler');
      const times = data[s.input];
      if (times.some((t, i) => t < 0 || t > 10 || (i && t <= times[i - 1]))) fail('Invalid animation time');
      const quats = data[s.output];
      for (let i = 0; i < quats.length; i += 4)
        if (Math.abs(Math.hypot(...quats.slice(i, i + 4)) - 1) > (skin ? 0.0001 : 0.01)) fail('Invalid animation quaternion');
    }
    const targets = new Set();
    for (const ch of channels) {
      if (++tracks > 64) fail('Animation track budget exceeded');
      object(ch, ['sampler', 'target'], 'animation channel');
      index(ch.sampler, ss, 'sampler');
      object(ch.target, ['node', 'path'], 'animation target');
      index(ch.target.node, nodes, 'target');
      if (skin && nodes[ch.target.node].skin !== undefined) fail('Skinned mesh root animation is unsupported');
      if (ch.target.path !== 'rotation' || targets.has(ch.target.node))
        fail('Only unique node rotation tracks are supported; no root motion');
      targets.add(ch.target.node);
    }
  }
  let embeddedPixels = 0;
  for (const image of images) {
    object(image, ['name', 'uri', 'bufferView', 'mimeType'], 'image');
    if (image.uri !== undefined) {
      if (
        image.bufferView !== undefined ||
        !(manifest.textures || []).includes(path(image.uri)) ||
        !files.has(image.uri)
      )
        fail('GLB texture is not a declared local PNG');
      if (image.mimeType !== undefined && image.mimeType !== 'image/png') fail('Invalid image MIME');
    } else {
      const b = index(image.bufferView, views, 'image');
      if (image.mimeType !== 'image/png') fail('Embedded images must be PNG');
      embeddedPixels += await validatePNG(
        bytes.subarray(binAt + 8 + (b.byteOffset ?? 0), binAt + 8 + (b.byteOffset ?? 0) + b.byteLength),
      );
    }
  }
  for (const s of samplers) {
    object(s, ['magFilter', 'minFilter', 'wrapS', 'wrapT', 'name'], 'sampler');
    if (s.magFilter !== undefined && ![9728, 9729].includes(s.magFilter))
      fail('Invalid magnification filter');
    if (s.minFilter !== undefined && ![9728, 9729, 9984, 9985, 9986, 9987].includes(s.minFilter))
      fail('Invalid minification filter');
    for (const k of ['wrapS', 'wrapT'])
      if (s[k] !== undefined && ![33071, 33648, 10497].includes(s[k])) fail('Invalid texture wrap');
  }
  for (const t of textures) {
    object(t, ['source', 'sampler', 'name'], 'texture');
    index(t.source, images, 'image');
    if (t.sampler !== undefined) index(t.sampler, samplers, 'sampler');
  }
  const map = (t) => {
    object(t, ['index', 'texCoord', 'scale', 'strength'], 'texture reference');
    index(t.index, textures, 'texture');
    if (t.texCoord !== undefined && ![0, 1].includes(t.texCoord)) fail('Invalid texture coordinate set');
    for (const k of ['scale', 'strength'])
      if (t[k] !== undefined && (!Number.isFinite(t[k]) || t[k] < 0 || t[k] > 1))
        fail('Invalid texture intensity');
  };
  for (const m of materials) {
    object(
      m,
      [
        'name',
        'pbrMetallicRoughness',
        'normalTexture',
        'occlusionTexture',
        'emissiveTexture',
        'emissiveFactor',
        'alphaMode',
        'alphaCutoff',
        'doubleSided',
      ],
      'material',
    );
    if (m.alphaMode !== undefined && !['OPAQUE', 'MASK'].includes(m.alphaMode))
      fail('Transparent blend materials are unsupported');
    if (m.doubleSided !== undefined && typeof m.doubleSided !== 'boolean') fail('Invalid material side');
    if (
      m.alphaCutoff !== undefined &&
      (!Number.isFinite(m.alphaCutoff) || m.alphaCutoff < 0 || m.alphaCutoff > 1)
    )
      fail('Invalid alpha cutoff');
    if (m.emissiveFactor) vector(m.emissiveFactor, 3, 0, 1, 'emissive factor');
    for (const k of ['normalTexture', 'occlusionTexture', 'emissiveTexture']) if (m[k]) map(m[k]);
    if (m.pbrMetallicRoughness) {
      const p = object(
        m.pbrMetallicRoughness,
        [
          'baseColorFactor',
          'baseColorTexture',
          'metallicFactor',
          'roughnessFactor',
          'metallicRoughnessTexture',
        ],
        'PBR',
      );
      if (p.baseColorFactor) vector(p.baseColorFactor, 4, 0, 1, 'base color');
      for (const k of ['metallicFactor', 'roughnessFactor'])
        if (p[k] !== undefined && (!Number.isFinite(p[k]) || p[k] < 0 || p[k] > 1))
          fail('Invalid PBR factor');
      for (const k of ['baseColorTexture', 'metallicRoughnessTexture']) if (p[k]) map(p[k]);
    }
  }
  return { triangles: submitted.triangles, radius, embeddedPixels };
}
