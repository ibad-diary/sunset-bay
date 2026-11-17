// Kota Sunset Bay, dibangun prosedural dari primitif: tanah, jalan,
// trotoar, gedung bertekstur jendela (digambar di kanvas, tanpa unduhan),
// pohon palem, lampu jalan, pantai + teluk, dan dermaga kayu.
// Mengembalikan daftar kotak tabrakan gedung dan titik parkir mobil.

import * as THREE from 'three';
import { CITY, STREETS, PALETTE, pick } from './config.js';

function facadeTexture(rng, base, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  // Bayangan lantai: garis horizontal tipis tiap lantai.
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 128, 3);
  // Jendela: sebagian menyala hangat (senja), sebagian gelap.
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 4; col++) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#2c3a52';
      g.fillRect(12 + col * 28, 14 + row * 34, 18, 20);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm() {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 4.6, 7), trunkMat);
  trunk.position.y = 2.3;
  trunk.rotation.z = 0.06;
  group.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7d3a, roughness: 0.85, flatShading: true });
  for (let i = 0; i < 6; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.6, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 0.9, 4.7, Math.sin(a) * 0.9);
    frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
    frond.scale.set(1, 1, 0.28);
    group.add(frond);
  }
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), leafMat);
  crown.position.y = 4.8;
  crown.scale.y = 0.6;
  group.add(crown);
  return group;
}

function makeLamp() {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.6, metalness: 0.5 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.2, 6), poleMat);
  pole.position.y = 2.6;
  group.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.08), poleMat);
  arm.position.set(0.5, 5.1, 0);
  group.add(arm);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffe6b0, emissive: 0xffc46b, emissiveIntensity: 1.4,
  });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), bulbMat);
  bulb.position.set(1.0, 5.0, 0);
  group.add(bulb);
  return group;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const addCollider = (x, z, w, d) => {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  };

  // Langit senja + kabut hangat.
  scene.background = new THREE.Color(0xf2a05c);
  scene.fog = new THREE.Fog(0xe8906a, 120, 320);

  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x55606e, 1.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.6);
  sun.position.set(-90, 26, -40); // matahari rendah di atas teluk (barat)
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -120; sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -120;
  sun.shadow.camera.far = 320;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  // Piringan matahari di atas laut.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(14, 32),
    new THREE.MeshBasicMaterial({ color: 0xffdf9e, fog: false }),
  );
  sunDisc.position.set(-220, 26, -60);
  sunDisc.lookAt(0, 26, -60);
  scene.add(sunDisc);

  // Tanah kota + pantai + laut.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 16, CITY.half * 2 + 16),
    new THREE.MeshStandardMaterial({ color: 0x5d7a52, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.beachWidth + 6, CITY.half * 2 + 16),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(CITY.bayEdge - CITY.beachWidth / 2 - 1, 0.02, 0);
  beach.receiveShadow = true;
  scene.add(beach);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(180, CITY.half * 2 + 200),
    new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.25, metalness: 0.1 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(CITY.bayEdge - CITY.beachWidth - 92, 0.05, 0);
  scene.add(sea);

  // Aspal jalan (dua arah) + garis tengah kuning.
  const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 0.95 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xd8b13c, roughness: 0.8 });
  const span = CITY.half * 2 + 8;
  for (const s of STREETS) {
    for (const [x, z, w, d] of [[s, 0, CITY.roadWidth, span], [0, s, span, CITY.roadWidth]]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, 0.06, z);
      road.receiveShadow = true;
      scene.add(road);
    }
    const lineV = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, span), lineMat);
    lineV.position.set(s, 0.09, 0);
    scene.add(lineV);
    const lineH = new THREE.Mesh(new THREE.BoxGeometry(span, 0.04, 0.28), lineMat);
    lineH.position.set(0, 0.09, s);
    scene.add(lineH);
  }

  // Tekstur fasad: tiga varian warna, jendela menyala sebagian.
  const facades = PALETTE.buildings.slice(0, 3).map((hex) => {
    const css = `#${hex.toString(16).padStart(6, '0')}`;
    return facadeTexture(rng, css, 0.45);
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4238, roughness: 1 });

  // Blok kota: alas trotoar + gedung; satu blok jadi Taman Teluk.
  const blockCenters = [-60, -20, 20, 60];
  const parkBlock = { x: 20, z: 20 };
  const slabMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 1 });
  const parkMat = new THREE.MeshStandardMaterial({ color: 0x4d7a4a, roughness: 1 });
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      const isPark = bx === parkBlock.x && bz === parkBlock.z;
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(30, 0.3, 30),
        isPark ? parkMat : slabMat,
      );
      slab.position.set(bx, 0.15, bz);
      slab.receiveShadow = true;
      scene.add(slab);
      if (isPark) {
        for (let i = 0; i < 7; i++) {
          const palm = makePalm();
          palm.position.set(bx - 10 + rng() * 20, 0.3, bz - 10 + rng() * 20);
          palm.rotation.y = rng() * Math.PI * 2;
          scene.add(palm);
        }
        continue;
      }
      const count = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < count; i++) {
        const w = 9 + rng() * 8;
        const d = 9 + rng() * 8;
        const h = 8 + rng() * rng() * 24; // sedikit gedung tinggi, banyak yang sedang
        const x = bx + (rng() - 0.5) * (30 - w - 4);
        const z = bz + (rng() - 0.5) * (30 - d - 4);
        const tex = pick(rng, facades);
        const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
          [side, side, roofMat, roofMat, side, side]);
        tower.position.set(x, 0.3 + h / 2, z);
        tower.castShadow = true;
        tower.receiveShadow = true;
        scene.add(tower);
        addCollider(x, z, w, d);
        // Atap: kotak pendingin kecil supaya siluet tidak polos.
        if (rng() < 0.6) {
          const ac = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.9, 1.6),
            new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.7, metalness: 0.4 }),
          );
          ac.position.set(x + (rng() - 0.5) * w * 0.4, 0.3 + h + 0.45, z + (rng() - 0.5) * d * 0.4);
          scene.add(ac);
        }
      }
    }
  }

  // Palem di tepi pantai + lampu jalan di persimpangan.
  for (let z = -90; z <= 90; z += 18) {
    const palm = makePalm();
    palm.position.set(CITY.bayEdge + 3, 0, z + (rng() - 0.5) * 6);
    palm.rotation.y = rng() * Math.PI * 2;
    scene.add(palm);
  }
  for (const s of STREETS) {
    for (const t of STREETS) {
      if ((s + t) % 80 === 0) {
        const lamp = makeLamp();
        lamp.position.set(s + 6.5, 0, t + 6.5);
        lamp.rotation.y = Math.PI / 4;
        scene.add(lamp);
      }
    }
  }

  // Dermaga kayu menjorok ke teluk + tiang-tiangnya. Lantai dermaga
  // rendah (puncak ~0,4 m) supaya bisa dinaiki pejalan kaki dari pantai;
  // TIDAK ada collider — Raka berjalan naik ke atasnya (lihat pierTop di
  // main.js), mobil tetap bisa lewat tapi melambat di tepinya.
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6844, roughness: 0.95 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(34, 0.5, 5), woodMat);
  pier.position.set(CITY.bayEdge - 18, 0.15, 0);
  pier.castShadow = true;
  pier.receiveShadow = true;
  scene.add(pier);
  for (let i = 0; i < 6; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.6, 6), woodMat);
    post.position.set(CITY.bayEdge - 4 - i * 6, 0, i % 2 === 0 ? -2.2 : 2.2);
    scene.add(post);
  }
  // Batas dermaga (x,z) + tinggi pijakan, dipakai main.js untuk menaikkan Raka.
  const pierBounds = { minX: CITY.bayEdge - 35, maxX: CITY.bayEdge - 1, minZ: -2.5, maxZ: 2.5, topY: 0.4 };

  // Awan: gumpalan putih pipih yang melayang pelan (digerakkan di main).
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xfff2e0, roughness: 1, transparent: true, opacity: 0.85 });
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(4 + rng() * 4, 8, 6), cloudMat);
      puff.position.set(p * 6 - puffs * 3, rng() * 1.5, (rng() - 0.5) * 6);
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(-140 + rng() * 260, 55 + rng() * 22, -120 + rng() * 240);
    scene.add(cloud);
    clouds.push(cloud);
  }

  // Titik parkir mobil yang bisa dikendarai pemain (tepi jalan, menghadap
  // searah jalan: jalan x=0 membujur ke z, jadi heading 0 atau PI).
  const carSpots = [
    { x: 6.5, z: -58, heading: 0 },
    { x: -33.5, z: 22, heading: Math.PI },
    { x: 46.5, z: -18, heading: 0 },
    { x: -6.5, z: 62, heading: Math.PI },
  ];

  return { colliders, carSpots, clouds, parkCenter: parkBlock, pierBounds };
}
