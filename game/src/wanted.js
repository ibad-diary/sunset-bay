// Sistem wanted + polisi Sunset Bay: bintang buronan 1–5, mobil patroli
// hitam-putih dengan lampu merah-biru kelap-kelip yang mengejar pemain,
// dan penangkapan saat polisi menyentuh pemain di wanted tinggi.

import * as THREE from 'three';
import { CAR, CITY } from './config.js';
import { buildCarMesh, resolveCircle } from './vehicles.js';

export const WANTED_MAX = 5;
export const POLICE_MAX_ACTIVE = 3;
export const DECAY_HIDDEN_SECONDS = 12;
export const ARREST_CONTACT_SECONDS = 1;
export const POLICE_TOP_SPEED = 26;

// Satu mobil patroli: bodi putih dengan kap + atap hitam dan palang lampu.
function makePoliceCar(scene, x, z, heading) {
  const { group, wheels } = buildCarMesh(0xf2f2f2);
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.5, metalness: 0.4 });
  const hood = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.2, 0.1, 1.1), blackMat);
  hood.position.set(0, 0.88, 1.4);
  group.add(hood);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.3, 0.08, 1.6), blackMat);
  roof.position.set(0, 1.4, -0.2);
  group.add(roof);
  const redMat = new THREE.MeshStandardMaterial({ color: 0xd02020, emissive: 0xff2020, emissiveIntensity: 2 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x2050d0, emissive: 0x2040ff, emissiveIntensity: 2 });
  const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.4), blackMat);
  barBase.position.set(0, 1.46, -0.2);
  group.add(barBase);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.36), redMat);
  red.position.set(-0.28, 1.58, -0.2);
  group.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.36), blueMat);
  blue.position.set(0.28, 1.58, -0.2);
  group.add(blue);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    group, wheels, redMat, blueMat,
    x, z, heading, speed: 0, contactTimer: 0, flashPhase: Math.random() * 2,
  };
}

export function createWanted(scene) {
  let level = 0;
  let hiddenTimer = 0;
  let decayFlash = 0;
  const police = [];

  function spawnPolice(px, pz) {
    // Muncul di jalan agak jauh dari pemain, dari arah acak.
    const angle = Math.random() * Math.PI * 2;
    const d = 42 + Math.random() * 14;
    const x = Math.max(-CITY.half + 6, Math.min(CITY.half - 6, px + Math.cos(angle) * d));
    const z = Math.max(-CITY.half + 6, Math.min(CITY.half - 6, pz + Math.sin(angle) * d));
    const car = makePoliceCar(scene, x, z, Math.atan2(px - x, pz - z));
    police.push(car);
    return car;
  }

  function despawnPolice(car) {
    scene.remove(car.group);
    const i = police.indexOf(car);
    if (i >= 0) police.splice(i, 1);
  }

  return {
    get level() { return level; },
    get police() { return police; },

    addStars(n) {
      const before = level;
      level = Math.max(0, Math.min(WANTED_MAX, level + n));
      hiddenTimer = 0;
      return level - before;
    },
    setStars(n) {
      level = Math.max(0, Math.min(WANTED_MAX, n));
      hiddenTimer = 0;
    },
    clear() {
      level = 0;
      hiddenTimer = 0;
      for (const car of [...police]) despawnPolice(car);
    },

    nearestPoliceDist(px, pz) {
      let best = Infinity;
      for (const car of police) {
        best = Math.min(best, Math.hypot(car.x - px, car.z - pz));
      }
      return best;
    },

    // Per detik: spawn/despawn patroli sesuai bintang, kejar pemain,
    // lampu kelap-kelip, dan peluruhan bintang saat bersembunyi.
    update(dt, px, pz, colliders) {
      const want = Math.min(level, POLICE_MAX_ACTIVE);
      while (police.length < want) spawnPolice(px, pz);
      while (police.length > want) despawnPolice(police[police.length - 1]);

      for (const car of police) {
        // Polisi yang tertinggal terlalu jauh dipindah mendekat supaya
        // kejar-kejaran tidak mati karena satu mobil nyasar ke ujung kota.
        const d0 = Math.hypot(car.x - px, car.z - pz);
        if (d0 > 95) {
          const a = Math.random() * Math.PI * 2;
          car.x = Math.max(-CITY.half + 6, Math.min(CITY.half - 6, px + Math.cos(a) * 45));
          car.z = Math.max(-CITY.half + 6, Math.min(CITY.half - 6, pz + Math.sin(a) * 45));
          car.speed = 0;
        }
        // Belok mengarah ke pemain, kejar dengan laju sedikit di bawah
        // mobil pemain tercepat supaya kabur masih mungkin.
        const dx = px - car.x;
        const dz = pz - car.z;
        const dist = Math.hypot(dx, dz) || 1;
        const wantHeading = Math.atan2(dx, dz);
        let dh = wantHeading - car.heading;
        dh = ((dh + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
        const targetSpeed = dist > 30 ? POLICE_TOP_SPEED : dist > 8 ? POLICE_TOP_SPEED * 0.82 : 4;
        car.speed += (targetSpeed - car.speed) * Math.min(1, 1.4 * dt);
        const nx = car.x + Math.sin(car.heading) * car.speed * dt;
        const nz = car.z + Math.cos(car.heading) * car.speed * dt;
        const hit = resolveCircle(nx, nz, CAR.radius * 0.62, colliders);
        car.x = Math.max(-CITY.half, Math.min(CITY.half, hit.x));
        car.z = Math.max(-CITY.half, Math.min(CITY.half, hit.z));
        if (hit.bumped) car.speed *= 0.5;
        car.group.position.set(car.x, 0, car.z);
        car.group.rotation.y = car.heading;
        for (const wheel of car.wheels) wheel.rotation.x += (car.speed * dt) / 0.36;
        // Lampu strobo merah-biru bergantian.
        car.flashPhase += dt * 9;
        const on = Math.sin(car.flashPhase) > 0;
        car.redMat.emissiveIntensity = on ? 2.4 : 0.25;
        car.blueMat.emissiveIntensity = on ? 0.25 : 2.4;
        // Kontak dengan pemain: hitung durasi sentuhan untuk penangkapan.
        // Saat lepas, timer meluruh pelan (bukan reset instan) supaya
        // polisi yang menyerempet dua kali tetap bisa menangkap.
        if (dist < CAR.radius + 0.4) car.contactTimer += dt;
        else car.contactTimer = Math.max(0, car.contactTimer - dt * 2);
      }

      // Peluruhan: bintang turun bila tidak ada polisi yang dekat.
      if (level > 0) {
        const nearest = this.nearestPoliceDist(px, pz);
        if (nearest > 35 || police.length === 0) {
          hiddenTimer += dt;
          decayFlash += dt;
          if (hiddenTimer >= DECAY_HIDDEN_SECONDS) {
            level -= 1;
            hiddenTimer = 0;
          }
        } else {
          hiddenTimer = 0;
        }
      }
      return level;
    },

    // Benar bila ada polisi yang menempel cukup lama di wanted tinggi.
    arrestReady() {
      if (level < 3) return false;
      return police.some((car) => car.contactTimer >= ARREST_CONTACT_SECONDS);
    },

    // Polisi menabrak mobil pemain di wanted rendah: perlambat sedikit.
    rammedPlayer(px, pz) {
      return police.some((car) => Math.hypot(car.x - px, car.z - pz) < CAR.radius + 0.4);
    },
  };
}
