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
// Laju puncak patroli: SENGAJA di bawah laju jelajah mobil pemain
// (CAR.accel / CAR.drag = 14 / 0,55 ≈ 25,5 m/s) supaya kabur dengan
// mengemudi bersih mungkin — pemain unggul ~4,5 m/s di jalan lurus,
// tapi polisi tetap lebih cepat dari mobil yang melambat (belok,
// menabrak gedung) sehingga penangkapan tetap mungkin. Dulu 26 m/s:
// polisi lebih cepat dari mobil pemain bahkan di jalan lurus, jadi
// kabur mengemudi mustahil secara matematis.
export const POLICE_TOP_SPEED = 21;

// Tiap mobil patroli punya callsign + peran, tampil di HUD saat wanted > 0.
const POLICE_ROSTER = [
  { callsign: 'Unit 7', role: 'Patroli' },
  { callsign: 'Unit 12', role: 'Intersepsi' },
  { callsign: 'Unit 3', role: 'Patroli' },
  { callsign: 'Unit 21', role: 'Pengejaran' },
  { callsign: 'Unit 9', role: 'Blokade' },
];

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
    callsign: '', role: '',
  };
}

export function createWanted(scene) {
  let level = 0;
  let hiddenTimer = 0;
  let decayFlash = 0;
  const police = [];
  // Jejak posisi pemain (6 dtk terakhir): patroli mengejar TITIK
  // JEJAK, bukan posisi pemain saat ini — supaya kejar-kejaran
  // mengikuti jalan di belakang pemain (tail chase), bukan memotong
  // lurus menembus blok kota dan mencegat dari depan di tikungan.
  // Dulu polisi membidik posisi saat ini: jalur lurus mereka jauh
  // lebih pendek dari putaran pemain di jalan, jadi mereka mencegat
  // head-on di tikungan dan Misi 3 mustahil diselesaikan mengemudi.
  let trailTime = 0;
  const trail = [];
  const TRAIL_DELAY_DRIVING = 4; // dtk jejak saat pemain mengemudi
  const TRAIL_DELAY_FOOT = 0.5; // dtk jejak saat pemain jalan kaki

  function spawnPolice(px, pz, heading) {
    // Muncul di BELAKANG pemain, relatif terhadap arah hadap/geraknya,
    // supaya patroli mengejar dari belakang — tidak pernah muncul
    // tiba-tiba di depan mobil pemain (dulu: arah acak, sering tepat
    // di jalur mobil, lalu tilang ngebut + tabrak polisi menaikkan
    // wanted saat pemain kabur). Jarak dijaga 42–56 m: bila arah
    // belakang mengarah keluar kota, clamp batas kota bisa memangkas
    // jarak (mis. pemain di tepi barat) — coba sudut yang makin
    // melebar dari garis belakang, pakai yang pertama yang hasil
    // clamp-nya tetap ≥ 40 m (fallback: yang terjauh).
    const behind = (heading ?? 0) + Math.PI;
    const offsets = [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.4, -2.4, Math.PI];
    let best = null;
    for (const off of offsets) {
      const a = behind + off + (Math.random() - 0.5) * 0.3;
      const d = 42 + Math.random() * 14;
      const x = Math.max(-CITY.half + 6, Math.min(CITY.half - 6, px + Math.cos(a) * d));
      const z = Math.max(-CITY.half + 6, Math.min(CITY.half - 6, pz + Math.sin(a) * d));
      const dist = Math.hypot(x - px, z - pz);
      if (!best || dist > best.dist) best = { x, z, dist };
      if (dist >= 40) break;
    }
    const car = makePoliceCar(scene, best.x, best.z, Math.atan2(px - best.x, pz - best.z));
    // Callsign diambil bergilir dari roster supaya tiap patroli aktif
    // punya identitas berbeda di HUD.
    const id = POLICE_ROSTER[police.length % POLICE_ROSTER.length];
    car.callsign = id.callsign;
    car.role = id.role;
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

    // Polisi terdekat + identitasnya (callsign + peran), untuk HUD.
    nearestCallsign(px, pz) {
      let best = null;
      let bestD = Infinity;
      for (const car of police) {
        const d = Math.hypot(car.x - px, car.z - pz);
        if (d < bestD) { best = car; bestD = d; }
      }
      if (!best) return null;
      return { callsign: best.callsign, role: best.role, dist: bestD };
    },

    // Per detik: spawn/despawn patroli sesuai bintang, kejar pemain,
    // lampu kelap-kelip, dan peluruhan bintang saat bersembunyi.
    // Kejar-kejaran ini TANPA teleport: polisi yang tertinggal jauh
    // tetap mengemudi mengejar (laju puncak di bawah mobil pemain,
    // jadi pengemudi bersih bisa menjauh), bukan dipindah mendekat.
    // Dulu ada teleport saat jarak > 95 m — polisi muncul ulang 45 m
    // ke arah acak, sering tepat di depan mobil, lalu tilang ngebut +
    // tabrak polisi menaikkan wanted sehingga kabur mengemudi mustahil.
    // Patroli membidik TITIK JEJAK pemain (bukan posisi saat ini):
    // saat mengemudi, jejak 3 dtk lalu — mereka mengikuti jalan di
    // belakang pemain; saat jalan kaki, jejak 0,5 dtk lalu supaya
    // penangkapan pejalan kaki yang berhenti tetap mungkin.
    update(dt, px, pz, colliders, heading, focusSpeed) {
      const want = Math.min(level, POLICE_MAX_ACTIVE);
      while (police.length < want) spawnPolice(px, pz, heading);
      while (police.length > want) despawnPolice(police[police.length - 1]);

      // Rekam jejak + pilih titik yang dikejar patroli.
      trailTime += dt;
      trail.push({ x: px, z: pz, t: trailTime });
      while (trail.length > 2 && trail[0].t < trailTime - 6) trail.shift();
      const delay = (focusSpeed ?? 0) > 12 ? TRAIL_DELAY_DRIVING : TRAIL_DELAY_FOOT;
      const tt = trailTime - delay;
      let tgt = trail[0] || { x: px, z: pz };
      for (const p of trail) { if (p.t <= tt) tgt = p; else break; }

      for (const car of police) {
        // Belok mengarah ke titik jejak, kejar dengan laju sedikit di
        // bawah mobil pemain tercepat supaya kabur masih mungkin.
        const dx = tgt.x - car.x;
        const dz = tgt.z - car.z;
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
        // Kontak dengan pemain (jarak SEBENARNYA, bukan ke jejak):
        // hitung durasi sentuhan untuk penangkapan. Saat lepas, timer
        // meluruh pelan (bukan reset instan) supaya polisi yang
        // menyerempet dua kali tetap bisa menangkap.
        const distPlayer = Math.hypot(px - car.x, pz - car.z);
        if (distPlayer < CAR.radius + 0.4) car.contactTimer += dt;
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
