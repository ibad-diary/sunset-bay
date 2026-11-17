// Sunset Bay — orkestrasi utama: renderer three.js, kamera third-person,
// gerak pejalan kaki, masuk/keluar mobil, pejalan kaki + traffic, HUD,
// simpan otomatis, dan mode tangkapan layar (?shot=start|walk|drive|aerial).

import * as THREE from 'three';
import { CITY, PLAYER, CAR, TRAFFIC_COUNT, WALKER_COUNT, SAVE_EVERY_SECONDS, makeSeededRandom, pick } from './config.js';
import { createInput, ACTION_ENTER_CAR, ACTION_PAUSE, ACTION_START } from './input.js';
import { buildCity } from './city.js';
import { buildPerson } from './characters.js';
import { makeDrivableCar, driveCar, resolveCircle, makeTraffic, updateTraffic } from './vehicles.js';
import { createHud } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';
const STEP = 1 / 60;

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 800);

const rng = makeSeededRandom(20261117);
const city = buildCity(scene, rng);
const input = createInput(canvas);
const hud = createHud();

// --- Pemain: Raka, kurir berjaket teal dan beanie merah. ---
const playerRig = buildPerson({});
scene.add(playerRig.group);
const player = {
  x: 2, z: -30, heading: Math.PI, speed: 0, moving: false,
};

// --- Mobil yang bisa dikendarai (4, terparkir di tepi jalan). ---
const PAINTS = [0xd94848, 0x3d7dd8, 0xe8b13c, 0x53a06a];
const cars = city.carSpots.map((spot, i) => makeDrivableCar(scene, spot, PAINTS[i], i));
let driving = -1; // indeks mobil yang sedang dikemudikan, -1 = jalan kaki

// --- Pejalan kaki di trotoar. ---
const walkerPalette = [0xc96a3b, 0x7a5fc0, 0x3f8f5f, 0xd8d3c8, 0x4a6a8a, 0xb03a5a];
const walkers = [];
for (let i = 0; i < WALKER_COUNT; i++) {
  const rig = buildPerson({
    jacket: pick(rng, walkerPalette),
    pants: pick(rng, [0x2e3440, 0x4a3b2e, 0x3a3a4a]),
    beanie: pick(rng, [0x2e5f8a, 0x8a8a2e, 0x5a5a5a, 0xc0392b]),
  });
  scene.add(rig.group);
  const alongStreet = i % 2 === 0;
  walkers.push({
    rig,
    x: alongStreet ? -95 + rng() * 190 : [-86, -46, -6, 34, 74][i % 5],
    z: alongStreet ? [-86, -46, -6, 34, 74][i % 5] : -95 + rng() * 190,
    axis: alongStreet ? 'z' : 'x',
    dir: rng() < 0.5 ? 1 : -1,
    speed: 1.1 + rng() * 0.7,
  });
}

// --- Traffic. ---
const traffic = makeTraffic(scene, rng);

// --- Kamera third-person. ---
const cam = { yaw: Math.PI, pitch: 0.32, dist: 7, tx: 0, ty: 2, tz: 0 };
const camPos = new THREE.Vector3(10, 6, -40);
const camTarget = new THREE.Vector3(0, 2, -30);

let screen = 'start'; // start | play | pause
let saveTimer = 0;
let framesRendered = 0;
let elapsed = 0;

function districtAt(x, z) {
  if (x < -88) return 'Pantai Teluk';
  if (Math.hypot(x - 20, z - 20) < 26) return 'Taman Teluk';
  if (z > 70) return 'Dermaga Selatan';
  return 'Sunset Bay — Pusat Kota';
}

function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function enterCar(car) {
  driving = car.index;
  car.parked = false;
  playerRig.group.visible = false;
  hud.showSpeed(true);
  hud.setObjective('Mengemudi — W gas, S rem/mundur, A/D belok. E untuk turun.');
  hud.setHint('W gas · S rem · A/D belok · E keluar mobil');
  cam.dist = 10.5;
}

function exitCar() {
  const car = cars[driving];
  driving = -1;
  car.parked = true;
  car.speed = 0;
  player.x = car.x - Math.sin(car.heading + Math.PI / 2) * 2.2;
  player.z = car.z - Math.cos(car.heading + Math.PI / 2) * 2.2;
  player.heading = car.heading;
  playerRig.group.visible = true;
  hud.showSpeed(false);
  hud.setObjective('Jelajahi kota — cari mobil parkir lalu tekan E untuk mengemudi.');
  hud.setHint('WASD jalan · Shift lari · Seret mouse untuk melihat');
  cam.dist = 7;
}

function startGame(fromSave) {
  const saved = fromSave ? loadGame() : null;
  if (saved) {
    player.x = saved.player.x; player.z = saved.player.z; player.heading = saved.player.heading;
    if (saved.car) {
      const car = cars[saved.car.index];
      car.x = saved.car.x; car.z = saved.car.z; car.heading = saved.car.heading;
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
    }
  }
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('pauseScreen').classList.add('hidden');
  hud.show();
  screen = 'play';
}

document.getElementById('startBtn').addEventListener('click', () => startGame(false));
document.getElementById('continueBtn').addEventListener('click', () => startGame(true));
document.getElementById('resumeBtn').addEventListener('click', () => {
  document.getElementById('pauseScreen').classList.add('hidden');
  screen = 'play';
});
if (hasSave()) document.getElementById('continueBtn').classList.remove('hidden');

function togglePause() {
  if (screen === 'play') {
    screen = 'pause';
    document.getElementById('pauseScreen').classList.remove('hidden');
  } else if (screen === 'pause') {
    screen = 'play';
    document.getElementById('pauseScreen').classList.add('hidden');
  }
}

// --- Langkah simulasi (fixed step). ---
function step(dt) {
  elapsed += dt;
  const look = input.takeLook();
  cam.yaw += look.yaw;
  cam.pitch = Math.max(-0.15, Math.min(0.9, cam.pitch + look.pitch));

  const actions = input.takeActions();
  if (actions & ACTION_PAUSE) togglePause();
  if (screen !== 'play') return;

  // Awan melayang pelan ke timur.
  for (const cloud of city.clouds) {
    cloud.position.x += dt * 0.7;
    if (cloud.position.x > 160) cloud.position.x = -160;
  }
  updateTraffic(traffic, dt);

  for (const w of walkers) {
    const pos = w.axis === 'z' ? w.z : w.x;
    const next = pos + w.dir * w.speed * dt;
    if (next > 95 || next < -95) w.dir *= -1;
    if (w.axis === 'z') w.z += w.dir * w.speed * dt; else w.x += w.dir * w.speed * dt;
    w.rig.group.position.set(w.x, 0.3, w.z);
    w.rig.group.rotation.y = w.axis === 'z'
      ? (w.dir > 0 ? 0 : Math.PI)
      : (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    w.rig.animateWalk(dt, w.speed, false);
  }

  if (driving >= 0) {
    const car = cars[driving];
    const gas = input.moveForward();
    const steer = input.moveStrafe();
    const speed = driveCar(car, gas, steer, dt, city.colliders, cars);
    hud.setSpeed(Math.abs(speed) * 3.6);
    hud.setDistrict(districtAt(car.x, car.z));
    if (actions & ACTION_ENTER_CAR) exitCar();
    cam.tx = car.x; cam.tz = car.z; cam.ty = 1.6;
    // Kamera mengikuti dari belakang mobil.
    const behind = car.heading + Math.PI;
    cam.yaw += (((behind - cam.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 1.6);
  } else {
    const fwd = input.moveForward();
    const strafe = input.moveStrafe();
    const running = input.running();
    const targetSpeed = (fwd !== 0 || strafe !== 0)
      ? (running ? PLAYER.runSpeed : PLAYER.walkSpeed) : 0;
    player.speed += (targetSpeed - player.speed) * Math.min(1, PLAYER.accel * dt / 6);
    player.moving = player.speed > 0.3;

    if (player.moving) {
      // Maju kamera = menjauhi kamera; kanan kamera = tegak lurusnya.
      const fx = -Math.sin(cam.yaw);
      const fz = -Math.cos(cam.yaw);
      const rx = Math.cos(cam.yaw);
      const rz = -Math.sin(cam.yaw);
      const mx = fx * fwd + rx * strafe;
      const mz = fz * fwd + rz * strafe;
      const len = Math.hypot(mx, mz) || 1;
      const wishHeading = Math.atan2(mx / len, mz / len);
      let dh = wishHeading - player.heading;
      dh = ((dh + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      player.heading += dh * Math.min(1, PLAYER.turnSpeed * dt);

      const nx = player.x + Math.sin(player.heading) * player.speed * dt;
      const nz = player.z + Math.cos(player.heading) * player.speed * dt;
      const hit = resolveCircle(nx, nz, PLAYER.radius, city.colliders);
      player.x = Math.max(-CITY.half - 4, Math.min(CITY.half, hit.x));
      player.z = Math.max(-CITY.half, Math.min(CITY.half, hit.z));
    }
    playerRig.group.position.set(player.x, 0.3, player.z);
    playerRig.group.rotation.y = player.heading;
    if (player.moving) playerRig.animateWalk(dt, player.speed, running);
    else playerRig.idle(dt, elapsed);

    hud.setDistrict(districtAt(player.x, player.z));
    const near = nearestCar(3.6);
    if (near) {
      hud.setHint('Tekan E untuk masuk mobil');
      hud.setObjective('Mobil parkir di dekatmu — tekan E untuk mengemudi.');
    } else {
      hud.setHint('WASD jalan · Shift lari · Seret mouse untuk melihat');
      hud.setObjective('Jelajahi kota — cari mobil parkir lalu tekan E untuk mengemudi.');
    }
    if ((actions & ACTION_ENTER_CAR) && near) enterCar(near);
    cam.tx = player.x; cam.tz = player.z; cam.ty = 1.8;
  }

  // Simpan otomatis tiap beberapa detik.
  saveTimer += dt;
  if (saveTimer >= SAVE_EVERY_SECONDS) {
    saveTimer = 0;
    const car = driving >= 0 ? cars[driving] : null;
    saveGame({
      playerX: player.x, playerZ: player.z, playerHeading: player.heading,
      carIndex: car ? car.index : -1,
      carX: car ? car.x : 0, carZ: car ? car.z : 0,
      carHeading: car ? car.heading : 0,
    });
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, STEP);
  step(dt);

  // Kamera: orbit di belakang target, dihaluskan.
  const focusX = driving >= 0 ? cars[driving].x : player.x;
  const focusZ = driving >= 0 ? cars[driving].z : player.z;
  const focusY = driving >= 0 ? 1.6 : 1.8;
  const cd = cam.dist;
  const wantX = focusX + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cd;
  const wantY = focusY + Math.sin(cam.pitch) * cd + 1.2;
  const wantZ = focusZ + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cd;
  camPos.x += (wantX - camPos.x) * 0.12;
  camPos.y += (wantY - camPos.y) * 0.12;
  camPos.z += (wantZ - camPos.z) * 0.12;
  camPos.y = Math.max(1.2, camPos.y);
  camera.position.copy(camPos);
  camTarget.set(focusX, focusY, focusZ);
  camera.lookAt(camTarget);

  // Minimap digambar tiap frame saat HUD tampil.
  if (screen === 'play') {
    const hx = driving >= 0 ? cars[driving].x : player.x;
    const hz = driving >= 0 ? cars[driving].z : player.z;
    const hh = driving >= 0 ? cars[driving].heading : player.heading;
    hud.drawMinimap(hx, hz, hh, cars, walkers);
  }

  renderer.render(scene, camera);
  framesRendered += 1;
  if (framesRendered === 30) window.__shotReady = true;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Mode tangkapan layar: panggung adegan nyata dari game, bukan gambar tempel. ---
function stageShot() {
  if (SHOT === 'start') {
    // Layar judul di atas kota: kamera rendah di jalan dekat pantai.
    player.x = -84; player.z = -10; player.heading = Math.PI / 2;
    cam.yaw = Math.PI / 2 + Math.PI; cam.pitch = 0.18; cam.dist = 9;
    camPos.set(-70, 4, -10);
    return;
  }
  if (SHOT === 'walk') {
    startGame(false);
    player.x = 2; player.z = -30; player.heading = Math.PI;
    cam.yaw = 0; cam.pitch = 0.3; // kamera di belakang pemain (menghadap -z)
    return;
  }
  if (SHOT === 'drive') {
    startGame(false);
    const car = cars[0];
    // Mobil sudah melaju saat foto diambil: posisi di tengah jalan + laju awal.
    car.x = 2.5; car.z = -30; car.speed = 14; // lajur kanan jalan x=0, sudah melaju
    car.group.position.set(car.x, 0, car.z);
    enterCar(car);
    input.inject('KeyW', true); // gas ditahan: mobil terus melaju di jalan
    cam.yaw = Math.PI; cam.pitch = 0.28;
    return;
  }
  if (SHOT === 'aerial') {
    startGame(false);
    player.x = 0; player.z = 0; player.heading = 0;
    // Awan dipindah ke atas laut (barat) supaya tidak menutupi kota.
    city.clouds.forEach((cloud, i) => {
      cloud.position.set(-150 - (i % 3) * 18, 62 + (i % 4) * 8, -110 + i * 32);
    });
    cam.yaw = 0.6; cam.pitch = 0.85; cam.dist = 150;
    camPos.set(60, 110, 90);
    return;
  }
}

stageShot();
requestAnimationFrame(frame);

// Penanda untuk alat luar: game sudah dimuat dan siap dimainkan.
window.__sunsetBay = { get screen() { return screen; }, get driving() { return driving; } };
