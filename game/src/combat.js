// Combat Sunset Bay — pukulan jarak dekat saat jalan kaki (tombol F
// atau klik mouse). Satu ayunan lengan + efek sapuan putih di depan
// pemain; pejalan kaki yang kena terpukul mundur dan lari ketakutan,
// polisi yang kena (mobil patroli didekati) ikut menaikkan wanted.

import * as THREE from 'three';

export const PUNCH_RANGE = 3.0; // jangkauan pukulan (m) — cukup longgar
// supaya pejalan kaki yang sedang minggir (2,4 m/dtk) masih kena.
export const PUNCH_ARC = 0.9; // radian dari arah hadap pemain
export const PUNCH_COOLDOWN = 0.45;

export function createCombat(scene) {
  // Efek sapuan: busur putih transparan yang muncul sepersekian detik.
  const swipeMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
  });
  const swipe = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.09, 8, 14, Math.PI * 0.85), swipeMat);
  swipe.visible = false;
  scene.add(swipe);

  let cooldown = 0;
  let swipeT = 0;
  let punches = 0;
  let hits = 0;

  return {
    get punches() { return punches; },
    get hits() { return hits; },
    get coolingDown() { return cooldown > 0; },

    update(dt) {
      cooldown = Math.max(0, cooldown - dt);
      if (swipeT > 0) {
        swipeT -= dt;
        swipeMat.opacity = Math.max(0, swipeT / 0.18) * 0.85;
        swipe.scale.setScalar(1 + (0.18 - Math.max(0, swipeT)) * 1.6);
        if (swipeT <= 0) swipe.visible = false;
      }
    },

    // Coba memukul dari (px,pz) menghadap heading. Mengembalikan
    // { hit, walkersHit, policeHit } — pemanggil yang menaikkan wanted.
    tryPunch(px, pz, heading, walkers, police, elapsed) {
      if (cooldown > 0) return { hit: false, walkersHit: 0, policeHit: false, cooling: true };
      cooldown = PUNCH_COOLDOWN;
      punches += 1;
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      // Efek sapuan di depan pemain, menghadap arah pukulan.
      swipe.position.set(px + fx * 1.5, 1.25, pz + fz * 1.5);
      swipe.rotation.set(Math.PI / 2, 0, -heading + Math.PI * 0.25);
      swipe.visible = true;
      swipeT = 0.18;
      let walkersHit = 0;
      for (const w of walkers) {
        const dx = w.x - px;
        const dz = w.z - pz;
        const d = Math.hypot(dx, dz);
        if (d > PUNCH_RANGE || d < 0.01) continue;
        const dot = (dx / d) * fx + (dz / d) * fz;
        if (dot < Math.cos(PUNCH_ARC)) continue; // di luar busur depan
        // Kena: terdorong mundur 2,5 m lalu lari ketakutan.
        const len = d;
        w.x += (dx / len) * 2.5;
        w.z += (dz / len) * 2.5;
        w.fleeX = dx / len;
        w.fleeZ = dz / len;
        w.fleeT = 3;
        w.hitAt = elapsed;
        walkersHit += 1;
      }
      let policeHit = false;
      for (const car of police) {
        if (Math.hypot(car.x - px, car.z - pz) < PUNCH_RANGE + 0.8) { policeHit = true; break; }
      }
      const hit = walkersHit > 0 || policeHit;
      if (hit) hits += 1;
      return { hit, walkersHit, policeHit, cooling: false };
    },
  };
}
