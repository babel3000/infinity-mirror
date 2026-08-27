import * as THREE from "three";

const REFLECTIVITY = 0.86;

const THEMES = {
  aurora: {
    palette: ["#7cf0ff", "#b794ff", "#ff7ad9"],
    lattice: "#9ad7ff",
    intensity: 2.4,
  },
  lantern: {
    palette: ["#fff1c1", "#ffb347", "#ffe08a"],
    lattice: "#ffd6a5",
    intensity: 2.1,
  },
  ember: {
    palette: ["#ff6b35", "#ffb347", "#ffd6a5"],
    lattice: "#ff8a5b",
    intensity: 2.2,
  },
};

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function bounceCount(ix, iy, iz) {
  return Math.abs(ix) + Math.abs(iy) + Math.abs(iz);
}

function axisSign(index) {
  return index % 2 === 0 ? 1 : -1;
}

function createLightLayout(room, count, seed, yRange) {
  const rand = mulberry32(seed);
  const lights = [];
  const margin = 0.55;

  for (let i = 0; i < count; i += 1) {
    lights.push({
      x: (rand() - 0.5) * (room.width - margin * 2),
      y: yRange[0] + rand() * (yRange[1] - yRange[0]),
      z: (rand() - 0.5) * (room.depth - margin * 2),
      seed: rand(),
      scale: 0.75 + rand() * 0.7,
    });
  }

  return lights;
}

function fillRoomCopies(mesh, layout, room, copies, scale) {
  const dummy = new THREE.Object3D();
  const bounces = [];
  const seeds = [];
  let i = 0;

  for (let ix = -copies; ix <= copies; ix += 1) {
    for (let iy = -copies; iy <= copies; iy += 1) {
      for (let iz = -copies; iz <= copies; iz += 1) {
        const sx = axisSign(ix);
        const sy = axisSign(iy);
        const sz = axisSign(iz);
        const bounce = bounceCount(ix, iy, iz);

        for (const light of layout) {
          dummy.position.set(
            ix * room.width + light.x * sx,
            iy * room.height + light.y * sy,
            iz * room.depth + light.z * sz,
          );
          dummy.scale.setScalar(scale * light.scale);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          bounces.push(bounce);
          seeds.push(light.seed);
          i += 1;
        }
      }
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.geometry.setAttribute(
    "aBounce",
    new THREE.InstancedBufferAttribute(new Float32Array(bounces), 1),
  );
  mesh.geometry.setAttribute(
    "aSeed",
    new THREE.InstancedBufferAttribute(new Float32Array(seeds), 1),
  );
}

function createOrbMaterial(palette, intensity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: intensity },
      uColorA: { value: new THREE.Color(palette[0]) },
      uColorB: { value: new THREE.Color(palette[1]) },
      uColorC: { value: new THREE.Color(palette[2]) },
    },
    vertexShader: /* glsl */ `
      attribute float aBounce;
      attribute float aSeed;
      varying vec3 vColor;
      uniform float uTime;
      uniform float uIntensity;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uColorC;

      void main() {
        float twinkle = 0.72 + 0.28 * sin(uTime * (1.1 + aSeed * 1.8) + aSeed * 12.566);
        float fade = pow(${REFLECTIVITY.toFixed(2)}, aBounce);
        float cycle = fract(aSeed + uTime * 0.025);
        vec3 color = mix(uColorA, uColorB, smoothstep(0.0, 0.5, cycle));
        color = mix(color, uColorC, smoothstep(0.5, 1.0, cycle));
        vColor = color * twinkle * fade * uIntensity;

        vec4 worldPosition = instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `,
    toneMapped: false,
  });
}

function createLattice(room, copies, color) {
  const positions = [];
  const xPlanes = copies * 2 + 2;
  const yPlanes = copies * 2 + 2;
  const zPlanes = copies * 2 + 2;
  const x0 = -((copies + 0.5) * room.width);
  const y0 = -((copies + 0.5) * room.height);
  const z0 = -((copies + 0.5) * room.depth);

  const pushLine = (ax, ay, az, bx, by, bz) => {
    positions.push(ax, ay, az, bx, by, bz);
  };

  for (let iy = 0; iy < yPlanes; iy += 1) {
    for (let iz = 0; iz < zPlanes; iz += 1) {
      const y = y0 + iy * room.height;
      const z = z0 + iz * room.depth;
      for (let ix = 0; ix < xPlanes - 1; ix += 1) {
        const x = x0 + ix * room.width;
        pushLine(x, y, z, x + room.width, y, z);
      }
    }
  }

  for (let ix = 0; ix < xPlanes; ix += 1) {
    for (let iz = 0; iz < zPlanes; iz += 1) {
      const x = x0 + ix * room.width;
      const z = z0 + iz * room.depth;
      for (let iy = 0; iy < yPlanes - 1; iy += 1) {
        const y = y0 + iy * room.height;
        pushLine(x, y, z, x, y + room.height, z);
      }
    }
  }

  for (let ix = 0; ix < xPlanes; ix += 1) {
    for (let iy = 0; iy < yPlanes; iy += 1) {
      const x = x0 + ix * room.width;
      const y = y0 + iy * room.height;
      for (let iz = 0; iz < zPlanes - 1; iz += 1) {
        const z = z0 + iz * room.depth;
        pushLine(x, y, z, x, y, z + room.depth);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uRoom: { value: new THREE.Vector3(room.width, room.height, room.depth) },
    },
    vertexShader: /* glsl */ `
      uniform vec3 uRoom;
      varying float vFade;

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        float bounce =
          abs(world.x) / uRoom.x +
          abs(world.y) / uRoom.y +
          abs(world.z) / uRoom.z;
        vFade = pow(${REFLECTIVITY.toFixed(2)}, bounce);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vFade;

      void main() {
        gl_FragColor = vec4(uColor * vFade * 0.8, 1.0);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  return lines;
}

function createGlassRoom(room) {
  const group = new THREE.Group();

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(room.width, room.height, room.depth),
    new THREE.MeshBasicMaterial({
      color: 0x0b0b14,
      transparent: true,
      opacity: 0.07,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  );
  glass.renderOrder = 1;
  group.add(glass);

  const frameMaterial = new THREE.MeshBasicMaterial({
    color: 0xd8c7ff,
    transparent: true,
    opacity: 0.28,
    fog: false,
    toneMapped: false,
  });
  const edgeRadius = 0.018;
  const edges = [
    [room.width, edgeRadius, edgeRadius],
    [edgeRadius, room.height, edgeRadius],
    [edgeRadius, edgeRadius, room.depth],
  ];
  const offsets = [
    [
      [0, room.height / 2, room.depth / 2],
      [0, room.height / 2, -room.depth / 2],
      [0, -room.height / 2, room.depth / 2],
      [0, -room.height / 2, -room.depth / 2],
    ],
    [
      [room.width / 2, 0, room.depth / 2],
      [room.width / 2, 0, -room.depth / 2],
      [-room.width / 2, 0, room.depth / 2],
      [-room.width / 2, 0, -room.depth / 2],
    ],
    [
      [room.width / 2, room.height / 2, 0],
      [room.width / 2, -room.height / 2, 0],
      [-room.width / 2, room.height / 2, 0],
      [-room.width / 2, -room.height / 2, 0],
    ],
  ];

  offsets.forEach((axisOffsets, axis) => {
    const [sx, sy, sz] = edges[axis];
    for (const [x, y, z] of axisOffsets) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(sx, sy, sz),
        frameMaterial,
      );
      bar.position.set(x, y, z);
      group.add(bar);
    }
  });

  return group;
}

export function createInfinityRoom(themeName = "aurora") {
  const room = { width: 6.4, height: 4.4, depth: 6.4 };
  const copies = 4;
  const roomsPerAxis = copies * 2 + 1;
  const theme = THEMES[themeName];
  const group = new THREE.Group();

  const smallLayout = createLightLayout(room, 16, 7, [0.35, room.height / 2 - 0.4]);
  const largeLayout = createLightLayout(room, 5, 19, [0.2, room.height / 2 - 0.55]);

  const smallCount = roomsPerAxis ** 3 * smallLayout.length;
  const largeCount = roomsPerAxis ** 3 * largeLayout.length;

  const smallMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.045, 8, 8),
    createOrbMaterial(theme.palette, theme.intensity),
    smallCount,
  );
  const largeMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.13, 1),
    createOrbMaterial(theme.palette, theme.intensity * 1.15),
    largeCount,
  );

  fillRoomCopies(smallMesh, smallLayout, room, copies, 1);
  fillRoomCopies(largeMesh, largeLayout, room, copies, 1.15);

  smallMesh.frustumCulled = false;
  largeMesh.frustumCulled = false;

  const lattice = createLattice(room, copies, theme.lattice);
  const glass = createGlassRoom(room);

  group.add(smallMesh, largeMesh, lattice, glass);

  return {
    group,
    room,
    smallMesh,
    largeMesh,
    lattice,
    setTheme(name) {
      const next = THEMES[name];
      if (!next) return;
      for (const mesh of [smallMesh, largeMesh]) {
        mesh.material.uniforms.uColorA.value.set(next.palette[0]);
        mesh.material.uniforms.uColorB.value.set(next.palette[1]);
        mesh.material.uniforms.uColorC.value.set(next.palette[2]);
        mesh.material.uniforms.uIntensity.value =
          next.intensity * (mesh === largeMesh ? 1.15 : 1);
      }
      lattice.material.uniforms.uColor.value.set(next.lattice);
    },
    update(time) {
      smallMesh.material.uniforms.uTime.value = time;
      largeMesh.material.uniforms.uTime.value = time;
    },
  };
}
