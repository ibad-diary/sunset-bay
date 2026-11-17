// Sunset Bay — orkestrasi utama: renderer three.js, kamera third-person,
// gerak pejalan kaki, bajak mobil (parkir + traffic), wanted + polisi,
// tiga misi cerita kurir, HUD, simpan otomatis, dan mode tangkapan layar
// (?shot=start|walk|drive|aerial|steal|chase|mission).

import * as THREE from 'three';
import { CITY, PLAYER, CAR, TRAFFIC_COUNT, WALKER_COUNT, SAVE_EVERY_SECONDS, makeSeededRandom, pick } from './config.js';
import { createInput, ACTION_ENTER_CAR, ACTION_PAUSE, ACTION_START, ACTION_PUNCH, ACTION_MUTE } from './input.js';
import { buildCity } from './city.js';
import { buildPerson } from './characters.js';
import { makeDrivableCar, driveCar, resolveCircle, makeTraffic, updateTraffic, buildCarMesh } from './vehicles.js';
import { createHud } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { createWanted } from './wanted.js';
import { createMissions, MISSIONS } from './missions.js';
import { createCombat } from './combat.js';
import { createAudio } from './audio.js';

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
const wanted = createWanted(scene);
const missions = createMissions(scene);
const combat = createCombat(scene);
const audio = createAudio();
// AudioContext hanya boleh hidup setelah gestur pengguna — tombol apa
// pun (termasuk MULAI) membangunkan suara; gagal pun game tetap jalan.
window.addEventListener('keydown', () => audio.unlock());
window.addEventListener('pointerdown', () => audio.unlock());

// --- Pemain: Raka, kurir berjaket teal dan beanie merah. ---
const playerRig = buildPerson({});
scene.add(playerRig.group);
const player = {
  x: 2, z: -30, heading: Math.PI, speed: 0, moving: false,
};
let playerRigY = 0.3; // naik saat berdiri di atas dermaga

// --- Mobil yang bisa dikendarai (4, terparkir di tepi jalan). ---
const PAINTS = [0xd94848, 0x3d7dd8, 0xe8b13c, 0x53a06a];
const cars = city.carSpots.map((spot, i) => makeDrivableCar(scene, spot, PAINTS[i], i));
for (const car of cars) car.stolen = false;
let driving = -1; // indeks mobil yang sedang dikemudikan, -1 = jalan kaki

// --- Pejalan kaki di trotoar. ---
const walkerPalette = [0xc96a3b, 0x7a5fc0, 0x3f8f5f, 0xd8d3c8, 0x4a6a8a, 0xb03a5a];
const walkers = [];
function addWalker(x, z, opts) {
  const rig = buildPerson({
    jacket: (opts && opts.jacket) || pick(rng, walkerPalette),
    pants: pick(rng, [0x2e3440, 0x4a3b2e, 0x3a3a4a]),
    beanie: pick(rng, [0x2e5f8a, 0x8a8a2e, 0x5a5a5a, 0xc0392b]),
  });
  scene.add(rig.group);
  const w = {
    rig, x, z,
    axis: (opts && opts.axis) || 'z',
    dir: rng() < 0.5 ? 1 : -1,
    speed: 1.1 + rng() * 0.7,
    fleeT: 0, fleeX: 0, fleeZ: 0, hitAt: -99,
  };
  walkers.push(w);
  return w;
}
for (let i = 0; i < WALKER_COUNT; i++) {
  const alongStreet = i % 2 === 0;
  addWalker(
    alongStreet ? -95 + rng() * 190 : [-86, -46, -6, 34, 74][i % 5],
    alongStreet ? [-86, -46, -6, 34, 74][i % 5] : -95 + rng() * 190,
    { axis: alongStreet ? 'z' : 'x' },
  );
}

// --- Traffic. ---
const traffic = makeTraffic(scene, rng);

// --- Kamera third-person. ---
const cam = { yaw: Math.PI, pitch: 0.32, dist: 7, tx: 0, ty: 2, tz: 0 };
const camPos = new THREE.Vector3(10, 6, -40);
const camTarget = new THREE.Vector3(0, 2, -30);

let screen = 'start'; // start | play | pause | busted
let saveTimer = 0;
let framesRendered = 0;
let elapsed = 0;
let hintHoldUntil = 0; // sampai detik game ini, hint penting tidak ditimpa
let activeMissionId = null;
let speedTrapCooldown = 0;
let ramCooldown = 0;
let chaseStaged = false;

function districtAt(x, z) {
  if (x < -88) return 'Pantai Teluk';
  if (Math.hypot(x - 20, z - 20) < 26) return 'Taman Teluk';
  if (z > 70) return 'Dermaga Selatan';
  return 'Sunset Bay — Pusat Kota';
}

function onPier(x, z) {
  const p = city.pierBounds;
  return x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ;
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

function nearestTrafficCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of traffic) {
    if (car.stopped) continue;
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function refreshObjective() {
  const m = missions.current;
  if (m) hud.setObjective(m.title + ' — ' + m.objective);
  else hud.setObjective('Semua misi selesai — jelajahi Sunset Bay sesukamu, Raka.');
  const brief = document.getElementById('missionBrief');
  if (brief) {
    brief.textContent = m
      ? m.title + ': ' + m.briefing + ' Hadiah ' + m.reward.toLocaleString('id-ID') + ' rupiah.'
      : 'Semua misi selesai! Raka kini kurir yang dikenal di Sunset Bay.';
  }
}

function enterCar(car) {
  driving = car.index;
  car.parked = false;
  playerRig.group.visible = false;
  hud.showSpeed(true);
  hud.setStolen(!!car.stolen);
  hud.setObjective(car.stolen
    ? 'Mobil curian — kabur dari pandangan polisi supaya wanted turun!'
    : 'Mengemudi — W gas, S rem/mundur, A/D belok. E untuk turun.');
  hud.setHint('W gas · S rem · A/D belok · E keluar mobil');
  cam.dist = 10.5;
}

// Membajak mobil parkir: naik wanted 1 bintang (sekali per mobil).
function stealParkedCar(car) {
  if (!car.stolen) {
    car.stolen = true;
    wanted.addStars(1);
    hud.setWanted(wanted.level);
    hud.setHint('Mobil dibajak! Wanted naik — polisi teluk mulai mengawasimu.');
  }
  enterCar(car);
}

// Membajak mobil traffic yang sedang jalan: mobil berhenti, pengemudinya
// keluar dan lari, mobilnya jadi milik pemain (wanted +2).
function hijackTrafficCar(tcar) {
  const idx = traffic.indexOf(tcar);
  if (idx >= 0) traffic.splice(idx, 1);
  scene.remove(tcar.group);
  // Bila yang dibajak adalah kurir target Misi 2, misinya ikut selesai.
  const wasTarget = missions.targetCar === tcar;
  if (wasTarget) missions.resolveTargetStolen();
  // Pengemudi keluar dan lari menjauh dari Raka.
  const dx = tcar.x - player.x;
  const dz = tcar.z - player.z;
  const len = Math.hypot(dx, dz) || 1;
  const driver = addWalker(tcar.x + (dx / len) * 1.5, tcar.z + (dz / len) * 1.5, { jacket: 0xe87a2c });
  driver.fleeT = 3.5;
  driver.fleeX = dx / len;
  driver.fleeZ = dz / len;
  driver.hitAt = elapsed; // baru keluar dari mobil: bukan korban tabrakan
  // Mobil yang sama kini jadi mobil yang bisa dikendarai pemain.
  const paint = tcar.paint !== undefined ? tcar.paint : 0xe87a2c;
  const car = makeDrivableCar(scene, { x: tcar.x, z: tcar.z, heading: tcar.heading }, paint, cars.length);
  car.stolen = true;
  car.parked = false;
  cars.push(car);
  wanted.addStars(2);
  hud.setWanted(wanted.level);
  hud.setHint('Mobil dibajak dari pengemudinya! Wanted +2 — kabur!');
  enterCar(car);
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
  hud.setStolen(false);
  refreshObjective();
  hud.setHint('WASD jalan · Shift lari · Seret mouse untuk melihat');
  cam.dist = 7;
}

// Misi baru dimulai: Misi 2 mengikat satu mobil traffic jadi target,
// Misi 3 menaikkan wanted ke 3 bintang.
function onMissionStart(mission) {
  activeMissionId = mission ? mission.id : null;
  if (!mission) return;
  if (mission.id === 'kejar-kurir') {
    let target = traffic.find((c) => !c.stopped) || null;
    if (!target && traffic.length === 0) {
      // Semua traffic sudah dibajak: hadirkan satu kurir baru di jalan.
      const { group } = buildCarMesh(0xe87a2c);
      scene.add(group);
      target = {
        group, vertical: true, street: 0, lane: 2.4, pos: -60,
        speed: 6, heading: 0, x: 2.4, z: -60, stopped: false, isTarget: false, paint: 0xe87a2c,
      };
      traffic.push(target);
    }
    if (target) missions.bindTarget(target);
  }
  if (mission.id === 'kabur-polisi') missions.armEscape(wanted);
  refreshObjective();
}

missions.onComplete = (mission) => {
  hud.showMissionComplete(mission);
  hud.setMoney(missions.money);
  hud.setWanted(wanted.level);
  audio.jingle();
  refreshObjective();
};

// Satu ayunan pukulan (dipakai tombol F/klik maupun debug playtest):
// animasi lengan + sapuan, bunyi, kilat HUD, dan wanted +1 bila kena.
function doPunch() {
  playerRig.punch();
  const res = combat.tryPunch(player.x, player.z, player.heading, walkers, wanted.police, elapsed);
  if (res.cooling) return res;
  audio.punch(res.hit);
  hud.flashPunch(res.hit);
  if (res.walkersHit > 0 || res.policeHit) {
    wanted.addStars(1);
    hud.setWanted(wanted.level);
    // Hint penting: ditahan 3 detik game supaya tidak langsung ditimpa
    // hint jalan kaki yang ditulis ulang tiap frame.
    hud.setHint(res.policeHit
      ? 'Kamu memukul polisi! Wanted +1 — kabur!'
      : 'Kamu memukul pejalan kaki! Wanted +1.');
    hintHoldUntil = elapsed + 3;
  }
  return res;
}

function startGame(fromSave) {
  const saved = fromSave ? loadGame() : null;
  if (saved) {
    player.x = saved.player.x; player.z = saved.player.z; player.heading = saved.player.heading;
    // Mobil curian dari traffic (save v3): pulihkan lengkap dari carData.
    if (saved.carData) {
      const cd = saved.carData;
      const restored = makeDrivableCar(scene, { x: cd.x, z: cd.z, heading: cd.heading }, cd.paint, cars.length);
      restored.stolen = true;
      cars.push(restored);
    }
    if (saved.car && saved.car.index < cars.length) {
      const car = cars[saved.car.index];
      car.x = saved.car.x; car.z = saved.car.z; car.heading = saved.car.heading;
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
    }
    if (typeof saved.money === 'number') missions.setMoney(saved.money);
    if (typeof saved.missionIndex === 'number') missions.setIndex(saved.missionIndex);
  }
  audio.unlock(); // gestur klik MULAI: suara boleh hidup
  hud.setMoney(missions.money);
  hud.setWanted(wanted.level);
  refreshObjective();
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('pauseScreen').classList.add('hidden');
  document.getElementById('bustedScreen').classList.add('hidden');
  hud.show();
  screen = 'play';
  onMissionStart(missions.current);
}

document.getElementById('startBtn').addEventListener('click', () => startGame(false));
document.getElementById('continueBtn').addEventListener('click', () => startGame(true));
document.getElementById('resumeBtn').addEventListener('click', () => {
  document.getElementById('pauseScreen').classList.add('hidden');
  screen = 'play';
});
document.getElementById('retryBtn').addEventListener('click', () => {
  // Coba lagi dari save: wanted direset, Raka kembali ke titik awal.
  wanted.clear();
  hud.setWanted(0);
  if (driving >= 0) {
    cars[driving].speed = 0;
    cars[driving].parked = true;
    driving = -1;
  }
  player.x = 2; player.z = -30; player.heading = Math.PI;
  playerRig.group.visible = true;
  playerRig.group.position.set(player.x, 0.3, player.z);
  hud.showSpeed(false);
  hud.setStolen(false);
  refreshObjective();
  document.getElementById('bustedScreen').classList.add('hidden');
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

function showBusted() {
  screen = 'busted';
  document.getElementById('bustedScreen').classList.remove('hidden');
}

// --- Langkah simulasi (fixed step). ---
function step(dt) {
  elapsed += dt;
  const look = input.takeLook();
  cam.yaw += look.yaw;
  cam.pitch = Math.max(-0.15, Math.min(0.9, cam.pitch + look.pitch));

  const actions = input.takeActions();
  if (actions & ACTION_PAUSE) togglePause();
  if (actions & ACTION_MUTE) hud.setMuted(audio.toggleMute());
  if (screen !== 'play') return;

  // Awan melayang pelan ke timur.
  for (const cloud of city.clouds) {
    cloud.position.x += dt * 0.7;
    if (cloud.position.x > 160) cloud.position.x = -160;
  }
  // Traffic menghindar: berhenti bila pemain/mobilnya menghalangi jalan.
  const avoidPoint = driving >= 0
    ? { x: cars[driving].x, z: cars[driving].z }
    : { x: player.x, z: player.z };
  updateTraffic(traffic, dt, avoidPoint);
  combat.update(dt);

  // Wanted + polisi: kejar pemain, lampu strobo, peluruhan saat sembunyi.
  const focusX = driving >= 0 ? cars[driving].x : player.x;
  const focusZ = driving >= 0 ? cars[driving].z : player.z;
  wanted.update(dt, focusX, focusZ, city.colliders);
  hud.setWanted(wanted.level);
  if (wanted.arrestReady()) {
    showBusted();
    return;
  }

  // Misi: penanda suar + penyelesaian; misi baru memicu pengikatannya.
  const done = missions.update(dt, focusX, focusZ, wanted);
  if (done) hud.setMoney(missions.money);
  if (missions.current && missions.current.id !== activeMissionId) onMissionStart(missions.current);
  if (!missions.current && activeMissionId !== null) { activeMissionId = null; refreshObjective(); }

  // Pejalan kaki: patroli trotoar, minggir saat pemain/mobil mendekat,
  // dan lari menjauh bila baru saja ketakutan.
  for (const w of walkers) {
    const threatX = driving >= 0 ? cars[driving].x : player.x;
    const threatZ = driving >= 0 ? cars[driving].z : player.z;
    const tdx = w.x - threatX;
    const tdz = w.z - threatZ;
    const tdist = Math.hypot(tdx, tdz);
    if (w.fleeT > 0) {
      w.fleeT -= dt;
      w.x += w.fleeX * 5 * dt;
      w.z += w.fleeZ * 5 * dt;
      w.rig.group.rotation.y = Math.atan2(w.fleeX, w.fleeZ);
      w.rig.animateWalk(dt, 5, true);
    } else if (tdist < 4.5 && tdist > 0.01) {
      // Minggir: melangkah menjauh dari ancaman, tegak lurus jalan.
      const ax = tdx / tdist;
      const az = tdz / tdist;
      w.x += ax * 2.4 * dt;
      w.z += az * 2.4 * dt;
      w.rig.group.rotation.y = Math.atan2(ax, az);
      w.rig.animateWalk(dt, 2.4, false);
    } else {
      const pos = w.axis === 'z' ? w.z : w.x;
      const next = pos + w.dir * w.speed * dt;
      if (next > 95 || next < -95) w.dir *= -1;
      if (w.axis === 'z') w.z += w.dir * w.speed * dt; else w.x += w.dir * w.speed * dt;
      w.rig.group.rotation.y = w.axis === 'z'
        ? (w.dir > 0 ? 0 : Math.PI)
        : (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      w.rig.animateWalk(dt, w.speed, false);
    }
    w.rig.group.position.set(w.x, 0.3, w.z);
  }

  if (driving >= 0) {
    const car = cars[driving];
    const gas = input.moveForward();
    const steer = input.moveStrafe();
    const speed = driveCar(car, gas, steer, dt, city.colliders, cars);
    hud.setSpeed(Math.abs(speed) * 3.6);
    hud.setDistrict(districtAt(car.x, car.z));
    // Ngebut di dekat polisi: +1 bintang (dengan jeda antar tilang).
    speedTrapCooldown = Math.max(0, speedTrapCooldown - dt);
    ramCooldown = Math.max(0, ramCooldown - dt);
    if (Math.abs(speed) > 20 && wanted.nearestPoliceDist(car.x, car.z) < 25 && speedTrapCooldown === 0) {
      wanted.addStars(1);
      hud.setWanted(wanted.level);
      hud.setHint('Ngebut di depan polisi! Wanted naik.');
      speedTrapCooldown = 8;
    }
    // Menabrak mobil polisi saat mengemudi: +1 bintang.
    if (ramCooldown === 0 && wanted.police.some((p) => Math.hypot(p.x - car.x, p.z - car.z) < 3.2) && Math.abs(speed) > 5) {
      wanted.addStars(1);
      hud.setWanted(wanted.level);
      ramCooldown = 6;
    }
    // Menabrak pejalan kaki: +2 bintang, pejalan kaki lari ketakutan.
    // Hanya saat mobil benar-benar melaju — pejalan kaki yang lewat di
    // samping mobil diam (mis. pengemudi yang baru dibajak dan lari)
    // bukan tabrakan.
    for (const w of walkers) {
      const d = Math.hypot(w.x - car.x, w.z - car.z);
      if (d < 2.2 && Math.abs(speed) > 2 && elapsed - w.hitAt > 3) {
        w.hitAt = elapsed;
        wanted.addStars(2);
        hud.setWanted(wanted.level);
        hud.setHint('Kamu menabrak pejalan kaki! Wanted +2.');
        const len = Math.hypot(w.x - car.x, w.z - car.z) || 1;
        w.fleeX = (w.x - car.x) / len;
        w.fleeZ = (w.z - car.z) / len;
        w.fleeT = 2.5;
      }
    }
    // Polisi menempel di wanted rendah: mobil didorong pelan.
    if (wanted.level > 0 && wanted.level < 3 && wanted.rammedPlayer(car.x, car.z)) {
      car.speed *= 0.985;
    }
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
      // Di jalur dermaga (z ~ 0) Raka boleh jalan sampai ujung dermaga;
      // di tempat lain batas barat kota tetap di garis pantai.
      const minX = Math.abs(nz) < 3 ? city.pierBounds.minX : -CITY.half - 4;
      player.x = Math.max(minX, Math.min(CITY.half, hit.x));
      player.z = Math.max(-CITY.half, Math.min(CITY.half, hit.z));
    }
    // Naik ke ketinggian lantai dermaga saat berdiri di atasnya.
    const wantRigY = onPier(player.x, player.z) ? 0.3 + city.pierBounds.topY : 0.3;
    playerRigY += (wantRigY - playerRigY) * Math.min(1, dt * 10);
    playerRig.group.position.set(player.x, playerRigY, player.z);
    playerRig.group.rotation.y = player.heading;
    if (player.moving) playerRig.animateWalk(dt, player.speed, running);
    else playerRig.idle(dt, elapsed);

    hud.setDistrict(districtAt(player.x, player.z));
    const near = nearestCar(3.6);
    const nearTraffic = near ? null : nearestTrafficCar(4.5);
    const nearWalker = walkers.some((w) => Math.hypot(w.x - player.x, w.z - player.z) < 3);
    let hintText = 'WASD jalan · Shift lari · Seret mouse untuk melihat';
    if (near) {
      hintText = near.stolen ? 'Tekan E untuk masuk mobil curianmu' : 'Tekan E untuk membajak mobil ini';
      hud.setObjective(near.stolen
        ? 'Mobil curianmu — tekan E untuk mengemudi.'
        : 'Mobil parkir di dekatmu — tekan E untuk membajaknya (wanted +1).');
    } else if (nearTraffic) {
      hintText = 'Tekan E untuk membajak mobil yang lewat ini!';
      hud.setObjective('Mobil melintas di dekatmu — tekan E untuk membajaknya (wanted +2).');
    } else if (nearWalker) {
      hintText = 'F pukul · WASD jalan · Shift lari · Seret mouse untuk melihat';
      refreshObjective();
    } else {
      refreshObjective();
    }
    // Hint penting (mis. habis memukul) ditahan beberapa detik game.
    if (elapsed >= hintHoldUntil) hud.setHint(hintText);
    if (actions & ACTION_ENTER_CAR) {
      if (near) stealParkedCar(near);
      else if (nearTraffic) hijackTrafficCar(nearTraffic);
    }
    if (actions & ACTION_PUNCH) doPunch();
    cam.tx = player.x; cam.tz = player.z; cam.ty = 1.8;
  }

  // Suara per frame: dengung mesin ikut laju, sirene ikut jarak polisi.
  audio.update(
    driving >= 0,
    driving >= 0 ? Math.abs(cars[driving].speed) * 3.6 : 0,
    wanted.level,
    wanted.nearestPoliceDist(focusX, focusZ),
  );

  // Simpan otomatis tiap beberapa detik.
  saveTimer += dt;
  if (saveTimer >= SAVE_EVERY_SECONDS) {
    saveTimer = 0;
    const car = driving >= 0 ? cars[driving] : null;
    saveGame({
      playerX: player.x, playerZ: player.z, playerHeading: player.heading,
      // Mobil bajakan dari traffic (indeks >= 4) kini ikut tersimpan
      // lengkap (posisi + warna) supaya bisa dipulihkan saat muat.
      carIndex: car && car.index < 4 ? car.index : -1,
      carData: car && car.index >= 4
        ? { x: car.x, z: car.z, heading: car.heading, paint: car.paint, stolen: true }
        : null,
      carX: car ? car.x : 0, carZ: car ? car.z : 0,
      carHeading: car ? car.heading : 0,
      money: missions.money,
      missionIndex: missions.index,
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
  // Kamera jangan tembus gedung: bila posisinya masuk kotak gedung,
  // naikkan ke atas atap gedung itu.
  for (const c of city.colliders) {
    if (c.top === undefined) continue;
    if (camPos.x > c.minX - 0.6 && camPos.x < c.maxX + 0.6 &&
        camPos.z > c.minZ - 0.6 && camPos.z < c.maxZ + 0.6 &&
        camPos.y < c.top + 0.9) camPos.y = c.top + 0.9;
  }
  camera.position.copy(camPos);
  camTarget.set(focusX, focusY, focusZ);
  camera.lookAt(camTarget);

  // Minimap digambar tiap frame saat HUD tampil.
  if (screen === 'play') {
    const hx = driving >= 0 ? cars[driving].x : player.x;
    const hz = driving >= 0 ? cars[driving].z : player.z;
    const hh = driving >= 0 ? cars[driving].heading : player.heading;
    const mpos = missions.targetPos();
    hud.drawMinimap(hx, hz, hh, cars, walkers, {
      missionPos: mpos,
      police: wanted.police,
      targetCar: missions.targetCar,
    });
  }

  // Panggung foto kejar-kejaran: jaga satu mobil polisi tetap dalam
  // frame — bila tertinggal di belakang kamera atau lebih dari 25 m,
  // tempatkan lagi di depan mobil pemain (menghadap ke arahnya) supaya
  // terlihat jelas di foto sebagai patroli yang mengejar.
  if (SHOT === 'chase' && wanted.police.length > 0 && driving >= 0) {
    const car = cars[driving];
    const cop = wanted.police[0];
    const dx = cop.x - car.x;
    const dz = cop.z - car.z;
    const d = Math.hypot(dx, dz);
    const along = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
    if (along < 2 || d > 25) {
      cop.x = car.x + Math.sin(car.heading) * 14 + Math.cos(car.heading) * 6;
      cop.z = car.z + Math.cos(car.heading) * 14 - Math.sin(car.heading) * 6;
      cop.heading = car.heading + Math.PI;
      cop.group.position.set(cop.x, 0, cop.z);
      chaseStaged = true;
    }
  }

  renderer.render(scene, camera);
  framesRendered += 1;
  // Panggung foto combat: pukul di frame 24 supaya ayunan lengan +
  // sapuan putih masih terlihat saat __shotReady di frame 30.
  if (SHOT === 'combat' && framesRendered === 24 && screen === 'play') doPunch();
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
  if (SHOT === 'steal') {
    startGame(false);
    // Raka berdiri di samping mobil parkir pertama, siap membajak.
    player.x = cars[0].x + 2.6; player.z = cars[0].z + 1.2; player.heading = Math.PI * 0.75;
    cam.yaw = Math.PI * 0.9; cam.pitch = 0.3; cam.dist = 8;
    return;
  }
  if (SHOT === 'chase') {
    startGame(false);
    // Misi 3 sedang jalan: wanted 3, Raka kabur naik mobil curian,
    // saldo hasil dua misi pertama tampil di HUD.
    missions.setMoney(400000);
    missions.setIndex(2);
    hud.setMoney(400000);
    const car = cars[0];
    car.stolen = true;
    car.x = 2.5; car.z = -30; car.speed = 14;
    car.group.position.set(car.x, 0, car.z);
    enterCar(car);
    input.inject('KeyW', true);
    missions.armEscape(wanted);
    activeMissionId = 'kabur-polisi';
    refreshObjective();
    cam.yaw = Math.PI; cam.pitch = 0.28;
    return;
  }
  if (SHOT === 'mission') {
    startGame(false);
    // Misi 1: Raka berjalan di pantai menuju suar emas di ujung dermaga.
    // Posisi z=5 supaya palem pantai tidak menutupi pandangan ke dermaga.
    player.x = -98; player.z = 5; player.heading = -Math.PI / 2;
    cam.yaw = Math.PI / 2; cam.pitch = 0.42; cam.dist = 12;
    camPos.set(-84, 6, 5);
    return;
  }
  if (SHOT === 'combat') {
    startGame(false);
    // Raka berhadapan dengan satu pejalan kaki 1,8 m di depannya, siap
    // memukul — pukulannya dipicu di frame 24 (lihat frame()).
    player.x = 2; player.z = -30; player.heading = Math.PI;
    const w = walkers[0];
    w.x = 2; w.z = -31.8; w.axis = 'z'; w.dir = 1;
    cam.yaw = 0; cam.pitch = 0.3; cam.dist = 8;
    camPos.set(2, 4, -21);
    return;
  }
}

stageShot();
requestAnimationFrame(frame);

// Penanda untuk alat luar: game sudah dimuat dan siap dimainkan.
window.__sunsetBay = {
  get screen() { return screen; },
  get driving() { return driving; },
  get wanted() { return wanted.level; },
  get money() { return missions.money; },
  get mission() { return missions.current ? missions.current.id : 'done'; },
  get police() { return wanted.police.length; },
  get targetPos() { return missions.targetPos(); },
  get targetCar() { return missions.targetCar ? { x: missions.targetCar.x, z: missions.targetCar.z } : null; },
  get chase() { return { hold: missions.chaseHold, px: player.x, pz: player.z }; },
  get policePos() { return wanted.police.map((c) => ({ x: +c.x.toFixed(1), z: +c.z.toFixed(1), contact: +c.contactTimer.toFixed(2) })); },
  get elapsed() { return +elapsed.toFixed(2); },
  get frames() { return framesRendered; },
  get audio() { return audio.state(); },
  get combat() { return { punches: combat.punches, hits: combat.hits }; },
  get walkers() { return walkers.map((w) => ({ x: +w.x.toFixed(1), z: +w.z.toFixed(1), fleeT: +w.fleeT.toFixed(2) })); },
  get traffic() { return traffic.map((c) => ({ x: +c.x.toFixed(1), z: +c.z.toFixed(1), speed: +(c.cruiseSpeed || c.speed).toFixed(1) })); },
  get playerPos() { return { x: +player.x.toFixed(1), z: +player.z.toFixed(1), heading: +player.heading.toFixed(2) }; },
  get cars() { return cars.map((c) => ({ index: c.index, x: +c.x.toFixed(1), z: +c.z.toFixed(1), stolen: !!c.stolen })); },
  // Bantuan playtest headless: memicu aksi yang sama seperti tombol pemain.
  debug: {
    setWanted(n) { wanted.setStars(n); hud.setWanted(wanted.level); },
    stealNearest() {
      const near = nearestCar(3.6);
      if (near) stealParkedCar(near);
      else { const t = nearestTrafficCar(4.5); if (t) hijackTrafficCar(t); }
    },
    // Teleport Raka ke target misi aktif (bantuan playtest saja).
    gotoMissionTarget() {
      const pos = missions.targetPos();
      if (!pos) return;
      if (driving >= 0) {
        const car = cars[driving];
        car.x = pos.x + 2.5; car.z = pos.z + 2.5;
        car.group.position.set(car.x, 0, car.z);
      } else {
        player.x = pos.x + 2.5; player.z = pos.z + 2.5;
      }
    },
    // Teleport Raka (bantuan playtest): jalan kaki atau beserta mobil.
    teleport(x, z, heading) {
      if (driving >= 0) {
        const car = cars[driving];
        car.x = x; car.z = z;
        if (heading !== undefined) car.heading = heading;
        car.group.position.set(car.x, 0, car.z);
        car.group.rotation.y = car.heading;
      } else {
        player.x = x; player.z = z;
        if (heading !== undefined) player.heading = heading;
      }
      return { x, z };
    },
    // Pukul (bantuan playtest): sama seperti tombol F.
    punch() {
      if (screen !== 'play' || driving >= 0) return null;
      return doPunch();
    },
    // Teleport Raka tepat di belakang satu pejalan kaki, menghadapnya.
    gotoWalker() {
      if (driving >= 0) return null;
      const w = walkers[0];
      if (!w) return null;
      player.x = w.x;
      player.z = w.z + 2.0;
      player.heading = Math.PI; // menghadap -z, ke arah pejalan kaki
      return { x: +w.x.toFixed(1), z: +w.z.toFixed(1) };
    },
    // Bisukan / hidupkan suara (bantuan playtest): sama seperti tombol M.
    toggleMute() {
      const m = audio.toggleMute();
      hud.setMuted(m);
      return m;
    },
    // Tarik mobil polisi terdekat ke samping pemain (bantuan playtest
    // penangkapan saja — memicu kontak 1 detik yang berujung TERTANGKAP).
    pullPoliceClose() {
      const px = driving >= 0 ? cars[driving].x : player.x;
      const pz = driving >= 0 ? cars[driving].z : player.z;
      const cop = wanted.police[0];
      if (!cop) return;
      cop.x = px + 1.5; cop.z = pz + 1.5;
      cop.speed = 0;
      cop.group.position.set(cop.x, 0, cop.z);
    },
  },
};
