import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createInfinityRoom } from "./infinityRoom.js";

const canvas = document.querySelector("#scene");
const overlay = document.querySelector("#overlay");
const hud = document.querySelector("#hud");
const enterButton = document.querySelector("#enter");
const leaveButton = document.querySelector("#leave");
const themeButtons = document.querySelectorAll("[data-theme]");

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
} catch (error) {
  document.querySelector(".lede").textContent =
    "This room needs WebGL. Try another browser, or make sure hardware acceleration is on.";
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020205);
scene.fog = new THREE.FogExp2(0x020205, 0.046);

const camera = new THREE.PerspectiveCamera(
  72,
  window.innerWidth / window.innerHeight,
  0.05,
  80,
);
camera.position.set(0, 1.62, 0.35);

const infinity = createInfinityRoom("aurora");
scene.add(infinity.group);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(
  new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.85,
    0.72,
    0.18,
  ),
);
composer.addPass(new OutputPass());

const look = {
  yaw: 0.18,
  pitch: -0.08,
  dragging: false,
  lastX: 0,
  lastY: 0,
};
const keys = new Set();
const velocity = new THREE.Vector3();
const wish = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);
const orientation = new THREE.Euler(0, 0, 0, "YXZ");
const clock = new THREE.Clock();
const moveKeys = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "ShiftLeft",
  "KeyC",
]);

let inside = false;
let pointerLocked = false;

function clampCamera() {
  const pad = 0.38;
  const { width, height, depth } = infinity.room;
  camera.position.x = THREE.MathUtils.clamp(
    camera.position.x,
    -width / 2 + pad,
    width / 2 - pad,
  );
  camera.position.y = THREE.MathUtils.clamp(
    camera.position.y,
    0.45,
    height / 2 - pad,
  );
  camera.position.z = THREE.MathUtils.clamp(
    camera.position.z,
    -depth / 2 + pad,
    depth / 2 - pad,
  );
}

function applyLook(dx, dy) {
  look.yaw -= dx * 0.0022;
  look.pitch -= dy * 0.0022;
  look.pitch = THREE.MathUtils.clamp(look.pitch, -1.2, 1.2);
}

function setInside(value) {
  inside = value;
  overlay.classList.toggle("is-hidden", value);
  hud.hidden = !value;
  hud.classList.toggle("is-visible", value);
  if (!value && pointerLocked) {
    document.exitPointerLock();
  }
}

function requestLookLock() {
  canvas.requestPointerLock?.();
}

enterButton.addEventListener("click", () => {
  setInside(true);
  requestLookLock();
});

leaveButton.addEventListener("click", () => {
  setInside(false);
});

document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === canvas;
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Escape" && inside) {
    setInside(false);
    return;
  }
  if (inside && moveKeys.has(event.code)) {
    event.preventDefault();
  }
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("mousedown", (event) => {
  if (!inside) return;
  if (event.button !== 0) return;
  if (!pointerLocked) requestLookLock();
  look.dragging = true;
  look.lastX = event.clientX;
  look.lastY = event.clientY;
});

window.addEventListener("mouseup", () => {
  look.dragging = false;
});

window.addEventListener("mousemove", (event) => {
  if (!inside) return;
  if (pointerLocked) {
    applyLook(event.movementX, event.movementY);
    return;
  }
  if (!look.dragging) return;
  applyLook(event.clientX - look.lastX, event.clientY - look.lastY);
  look.lastX = event.clientX;
  look.lastY = event.clientY;
});

canvas.addEventListener(
  "touchstart",
  (event) => {
    if (!inside) return;
    const touch = event.changedTouches[0];
    look.dragging = true;
    look.lastX = touch.clientX;
    look.lastY = touch.clientY;
  },
  { passive: true },
);

canvas.addEventListener(
  "touchmove",
  (event) => {
    if (!inside || !look.dragging) return;
    const touch = event.changedTouches[0];
    applyLook(touch.clientX - look.lastX, touch.clientY - look.lastY);
    look.lastX = touch.clientX;
    look.lastY = touch.clientY;
  },
  { passive: true },
);

window.addEventListener("touchend", () => {
  look.dragging = false;
});

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    themeButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    infinity.setTheme(button.dataset.theme);
  });
});

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  composer.setSize(width, height);
});

function updateMovement(delta) {
  if (!inside) {
    velocity.multiplyScalar(0.9);
    return;
  }

  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() > 0) forward.normalize();
  right.crossVectors(forward, worldUp).normalize();

  wish.set(0, 0, 0);
  if (keys.has("KeyW") || keys.has("ArrowUp")) wish.add(forward);
  if (keys.has("KeyS") || keys.has("ArrowDown")) wish.sub(forward);
  if (keys.has("KeyD") || keys.has("ArrowRight")) wish.add(right);
  if (keys.has("KeyA") || keys.has("ArrowLeft")) wish.sub(right);
  if (keys.has("Space")) wish.y += 1;
  if (keys.has("ShiftLeft") || keys.has("KeyC")) wish.y -= 1;

  if (wish.lengthSq() > 0) wish.normalize();
  velocity.lerp(wish.multiplyScalar(2.35), 1 - Math.exp(-8 * delta));
  camera.position.addScaledVector(velocity, delta);
  clampCamera();
}

function frame() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  orientation.set(look.pitch, look.yaw, 0, "YXZ");
  camera.quaternion.setFromEuler(orientation);
  updateMovement(delta);
  infinity.update(time);
  composer.render();
  requestAnimationFrame(frame);
}

clampCamera();
if (new URLSearchParams(window.location.search).has("enter")) {
  setInside(true);
}
frame();
