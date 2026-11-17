// Tokoh low-poly dari primitif: badan, kepala, topi rajut, lengan dan
// kaki yang bisa diayun saat berjalan. Dipakai untuk pemain (Raka, kurir
// berjaket teal + beanie merah) dan untuk pejalan kaki dengan warna acak.

import * as THREE from 'three';

export function buildPerson({ jacket = 0x2a7f7f, pants = 0x2e3440, beanie = 0xc0392b, skin = 0xd9a066 } = {}) {
  const group = new THREE.Group();
  const jacketMat = new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const beanieMat = new THREE.MeshStandardMaterial({ color: beanie, roughness: 1 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.68, 0.34), jacketMat);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), skinMat);
  head.position.y = 1.66;
  head.castShadow = true;
  group.add(head);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.16, 12), beanieMat);
  cap.position.y = 1.8;
  group.add(cap);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), beanieMat);
  pom.position.y = 1.9;
  group.add(pom);

  // Mata: dua titik gelap kecil di wajah.
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 4), eyeMat);
    eye.position.set(side * 0.075, 1.68, 0.19);
    group.add(eye);
  }

  function limb(mat, w, h, d, x, y) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.y = -h / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    group.add(pivot);
    return pivot;
  }

  const armL = limb(jacketMat, 0.16, 0.6, 0.16, -0.4, 1.42);
  const armR = limb(jacketMat, 0.16, 0.6, 0.16, 0.4, 1.42);
  const legL = limb(pantsMat, 0.2, 0.78, 0.2, -0.16, 0.78);
  const legR = limb(pantsMat, 0.2, 0.78, 0.2, 0.16, 0.78);

  let phase = 0;
  let punchT = 0; // detik tersisa ayunan pukulan (0 = tidak memukul)
  const PUNCH_LEN = 0.22;
  return {
    group,
    // Mulai ayunan pukulan: lengan kanan menghantam ke depan.
    punch() { punchT = PUNCH_LEN; },
    // Ayunan jalan: kaki/lengan berlawanan arah, badan sedikit membungkuk saat lari.
    animateWalk(dt, speed, running) {
      phase += dt * speed * 2.4;
      const swing = Math.min(0.85, speed * 0.12) * (running ? 1.25 : 1);
      const s = Math.sin(phase);
      legL.rotation.x = s * swing;
      legR.rotation.x = -s * swing;
      armL.rotation.x = -s * swing * 0.8;
      armR.rotation.x = s * swing * 0.8;
      torso.position.y = 1.12 + Math.abs(Math.cos(phase)) * 0.045 * Math.min(1, speed / 4);
      torso.rotation.x = running ? 0.12 : 0.03;
      if (punchT > 0) {
        punchT = Math.max(0, punchT - dt);
        const p = 1 - punchT / PUNCH_LEN;
        armR.rotation.x = -1.8 * Math.sin(p * Math.PI);
        armR.rotation.z = -0.35 * Math.sin(p * Math.PI);
      }
    },
    idle(dt, time) {
      legL.rotation.x *= 0.8; legR.rotation.x *= 0.8;
      armL.rotation.x *= 0.8; armR.rotation.x *= 0.8;
      torso.position.y = 1.12 + Math.sin(time * 2) * 0.012;
      torso.rotation.x = 0;
      if (punchT > 0) {
        punchT = Math.max(0, punchT - dt);
        const p = 1 - punchT / PUNCH_LEN;
        armR.rotation.x = -1.8 * Math.sin(p * Math.PI);
        armR.rotation.z = -0.35 * Math.sin(p * Math.PI);
      }
    },
  };
}
