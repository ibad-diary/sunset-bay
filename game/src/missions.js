// Misi + cerita Sunset Bay (orisinal): Raka, kurir baru di kota teluk,
// menjalani tiga tugas berurutan — antar paket, kejar kurir, kabur dari
// polisi. Tiap misi punya penanda suar di dunia, hadiah uang, dan layar
// selesai. Uang tersimpan sebagai saldo Rp di HUD.

import * as THREE from 'three';

export const MISSIONS = [
  {
    id: 'antar-paket',
    title: 'Misi 1 — Antar Paket',
    briefing: 'Paket pertama Raka: sekotak suku cadang perahu untuk Pak Darman, nelayan tua di ujung dermaga. Antar sebelum senja habis — pelanggan pertama jangan sampai kecewa.',
    objective: 'Antar paket ke ujung Dermaga Selatan (penanda emas).',
    reward: 150000,
    target: { x: -136, z: 0 },
  },
  {
    id: 'kejar-kurir',
    title: 'Misi 2 — Kejar Kurir',
    briefing: 'Paket kedua direbut kurir liar dari geng jalanan — dia kabur naik mobil oranye menyusuri jalan kota. Potong jalannya, tabrak pelan sampai dia berhenti, lalu ambil paketnya kembali.',
    objective: 'Kejar mobil kurir bertanda emas — pepet sampai dia berhenti.',
    reward: 250000,
    target: null, // mobil traffic target, diikat saat misi mulai
  },
  {
    id: 'kabur-polisi',
    title: 'Misi 3 — Kabur dari Polisi',
    briefing: 'Geng itu melapor balik: polisi teluk kini mengincar Raka dengan 3 bintang. Jangan tertangkap. Menghilanglah dari pandangan patroli sampai namamu bersih lagi.',
    objective: 'Kabur dari polisi sampai bintang wanted hilang semua.',
    reward: 400000,
    target: null,
  },
];

export function formatRp(n) {
  return 'Rp' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Suar penanda misi: tiang cahaya emas + berlian melayang yang berputar.
function makeBeacon(scene) {
  const group = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffd34d, transparent: true, opacity: 0.35, depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 26, 12, 1, true), beamMat);
  beam.position.y = 13;
  group.add(beam);
  const gemMat = new THREE.MeshStandardMaterial({
    color: 0xffd34d, emissive: 0xffb020, emissiveIntensity: 1.2, roughness: 0.3,
  });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), gemMat);
  gem.position.y = 5;
  group.add(gem);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.8 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.9, 24), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  group.visible = false;
  scene.add(group);
  return { group, gem, ring, beamMat };
}

export function createMissions(scene) {
  const beacon = makeBeacon(scene);
  let index = 0; // misi aktif ke-berapa (0..2), 3 = semua selesai
  let money = 0;
  let chaseHold = 0; // detik pemain menempel mobil target Misi 2
  let escapeArmed = false; // Misi 3 baru selesai setelah wanted sempat 3 lalu 0
  let targetCar = null;
  let elapsed = 0;
  let onComplete = null; // (mission) => void, diisi main.js untuk banner

  function current() {
    return index < MISSIONS.length ? MISSIONS[index] : null;
  }

  function targetPos() {
    const m = current();
    if (!m) return null;
    if (m.id === 'kejar-kurir' && targetCar) return { x: targetCar.x, z: targetCar.z };
    return m.target;
  }

  function complete(mission) {
    money += mission.reward;
    index += 1;
    chaseHold = 0;
    if (mission.id === 'kejar-kurir' && targetCar) {
      targetCar.stopped = false;
      targetCar = null;
    }
    if (onComplete) onComplete(mission);
  }

  return {
    get index() { return index; },
    get money() { return money; },
    get chaseHold() { return chaseHold; },
    get current() { return current(); },
    get done() { return index >= MISSIONS.length; },
    get targetCar() { return targetCar; },
    set onComplete(fn) { onComplete = fn; },
    setMoney(n) { money = n; },
    setIndex(i) { index = Math.max(0, Math.min(MISSIONS.length, i)); },

    // Misi 2: ikat satu mobil traffic jadi kurir yang dikejar.
    bindTarget(car) {
      targetCar = car;
      if (car) { car.isTarget = true; car.speed = 6; }
    },

    // Misi 2 selesai lewat jalur lain: pemain membajak langsung mobil
    // targetnya — paket ikut berpindah tangan, kurirnya sudah berhenti.
    resolveTargetStolen() {
      const m = current();
      if (!m || m.id !== 'kejar-kurir' || !targetCar) return false;
      targetCar = null;
      complete(m);
      return true;
    },

    // Misi 3: dipanggil sekali saat misi mulai — wanted naik ke 3.
    armEscape(wanted) {
      wanted.setStars(3);
      escapeArmed = true;
    },

    targetPos,
    beaconGroup: beacon.group,

    update(dt, px, pz, wanted) {
      elapsed += dt;
      const m = current();
      if (!m) {
        beacon.group.visible = false;
        return null;
      }
      // Misi 3 tidak punya titik target — selesai saat wanted hilang.
      // (Dicek di sini, sebelum penjaga target di bawah, supaya misi
      // tanpa penanda tidak pernah tertahan.)
      if (m.id === 'kabur-polisi') {
        beacon.group.visible = false;
        if (escapeArmed && wanted.level === 0) {
          escapeArmed = false;
          complete(m);
          return m;
        }
        return null;
      }
      const pos = targetPos();
      if (!pos) {
        beacon.group.visible = false;
        return null;
      }
      // Suar mengikuti target, berlian berputar + naik-turun pelan.
      beacon.group.visible = true;
      beacon.group.position.set(pos.x, 0, pos.z);
      beacon.gem.rotation.y += dt * 2.2;
      beacon.gem.position.y = 5 + Math.sin(elapsed * 2) * 0.6;
      beacon.beamMat.opacity = 0.28 + Math.sin(elapsed * 3) * 0.1;
      const ringScale = 1 + Math.sin(elapsed * 2) * 0.12;
      beacon.ring.scale.set(ringScale, ringScale, 1);

      const dist = Math.hypot(px - pos.x, pz - pos.z);
      if (m.id === 'antar-paket' && dist < 6) {
        complete(m);
        return m;
      }
      if (m.id === 'kejar-kurir' && targetCar) {
        if (dist < 4.5) {
          chaseHold += dt;
          if (chaseHold >= 1.2) {
            targetCar.stopped = true;
            targetCar.speed = 0;
            complete(m);
            return m;
          }
        } else {
          chaseHold = Math.max(0, chaseHold - dt);
        }
      }
      return null;
    },
  };
}
