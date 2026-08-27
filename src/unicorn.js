import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const COPIES = 2;
const TARGET_HEIGHT = 1.58;

function axisSign(index) {
  return index % 2 === 0 ? 1 : -1;
}

function prepareModel(root) {
  const lights = [];
  root.traverse((object) => {
    if (object.isLight) {
      lights.push(object);
      return;
    }
    if (!object.isMesh) return;
    object.frustumCulled = true;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      if (!material) continue;
      material.side = THREE.DoubleSide;
      if (material.map) {
        material.map.colorSpace = THREE.SRGBColorSpace;
        material.emissiveMap = material.map;
        material.emissive.set(0xffffff);
        material.emissiveIntensity = 0.12;
      }
    }
  });
  for (const light of lights) {
    light.parent?.remove(light);
  }
}

function fitToRoom(root, room) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  root.scale.setScalar(TARGET_HEIGHT / Math.max(size.y, 0.001));
  root.updateMatrixWorld(true);
  box.setFromObject(root);

  const center = box.getCenter(new THREE.Vector3());
  const walkFloor = 0;
  root.position.x += -center.x;
  root.position.y += walkFloor - box.min.y;
  root.position.z += -1.05 - center.z;
  root.updateMatrixWorld(true);
  box.setFromObject(root);
  const fitted = box.getSize(new THREE.Vector3());
  return Math.max(fitted.x, fitted.z) * 0.42 + 0.16;
}

export async function createUnicornHerd(room) {
  const gltf = await new GLTFLoader().loadAsync(
    `${import.meta.env.BASE_URL}models/unicorn/scene.gltf`,
  );
  prepareModel(gltf.scene);
  const keepOut = fitToRoom(gltf.scene, room);

  const group = new THREE.Group();
  const mixers = [];
  const clip = gltf.animations[0];
  const origin = new THREE.Vector3(0, 0, -1.05);

  for (let ix = -COPIES; ix <= COPIES; ix += 1) {
    for (let iy = -COPIES; iy <= COPIES; iy += 1) {
      for (let iz = -COPIES; iz <= COPIES; iz += 1) {
        const clone = gltf.scene.clone(true);
        const holder = new THREE.Group();
        holder.position.set(ix * room.width, iy * room.height, iz * room.depth);
        holder.scale.set(axisSign(ix), axisSign(iy), axisSign(iz));
        holder.add(clone);
        group.add(holder);

        if (clip) {
          const mixer = new THREE.AnimationMixer(clone);
          const action = mixer.clipAction(clip);
          action.play();
          mixers.push(mixer);
        }
      }
    }
  }

  return {
    group,
    origin,
    keepOut,
    update(delta) {
      for (const mixer of mixers) mixer.update(delta);
    },
  };
}

export function createUnicornLights() {
  const lights = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0xc9b6ff, 0x140c18, 0.7);
  const key = new THREE.PointLight(0xffd4f0, 12, 7, 1.8);
  key.position.set(0.35, 1.35, 0.15);
  const fill = new THREE.PointLight(0x7cf0ff, 5, 6, 2);
  fill.position.set(-0.8, 1.1, -1.8);
  lights.add(hemi, key, fill);
  return lights;
}
