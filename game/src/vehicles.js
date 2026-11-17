// Mobil Sunset Bay: bodi dari kotak + kabin + roda silinder, tanpa aset
// luar. Satu pabrik membangun mobil pemain (yang bisa dinaiki) dan mobil
// traffic; mengemudinya arcade: gas, rem/mundur, setir yang melembut
// mengikuti kecepatan, dan dorongan keluar dari kotak gedung.

import * as THREE from 'three';
import { CAR, CITY, STREETS } from './config.js';

const PAINTS = [0xd94848, 0x3d7dd8, 0xe8b13c, 0x53a06a, 0x8a5fc0, 0xd8d3c8];

export function buildCarMesh(paint) {
  const group = new THREE.Group();
  const paintMat = new THREE.MeshStandardMaterial({ color: paint, roughness: 0.35, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x18222e, roughness: 0.15, metalness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.width, 0.62, CAR.length), paintMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.3, 0.55, CAR.length * 0.48), glassMat);
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(CAR.width, 0.22, 0.25), darkMat);
  bumperF.position.set(0, 0.38, CAR.length / 2);
  group.add(bumperF);
  const bumperB = bumperF.clone();
  bumperB.position.z = -CAR.length / 2;
  group.add(bumperB);

  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0.9 });
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), lightMat);
    lamp.position.set(side * 0.62, 0.62, CAR.length / 2 + 0.03);
    group.add(lamp);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xb02020, emissive: 0x801010, emissiveIntensity: 0.6 }));
    tail.position.set(side * 0.62, 0.62, -CAR.length / 2 - 0.03);
    group.add(tail);
  }

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.position.set(x, 0.36, z);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  return { group, wheels };
}

// Keadaan satu mobil yang dikendarai: posisi, arah, laju, sudut setir.
export function makeDrivableCar(scene, spot, paint, index) {
  const { group, wheels } = buildCarMesh(paint);
  group.position.set(spot.x, 0, spot.z);
  group.rotation.y = spot.heading;
  scene.add(group);
  const state = {
    index, group, wheels, paint,
    x: spot.x, z: spot.z, heading: spot.heading,
    speed: 0, steer: 0, parked: true,
  };
  return state;
}

// Maju satu langkah mengemudi arcade. Mengembalikan laju (m/s).
export function driveCar(car, gas, steerInput, dt, colliders, others) {
  const targetSteer = steerInput * CAR.steerMax;
  car.steer += (targetSteer - car.steer) * Math.min(1, CAR.steerSpeed * dt * 2);

  if (gas > 0) car.speed += CAR.accel * gas * dt;
  else if (gas < 0) {
    car.speed += (car.speed > 0.5 ? -CAR.brake : CAR.accel * 0.6) * dt;
  }
  car.speed -= car.speed * CAR.drag * dt;
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  if (Math.abs(car.speed) < 0.05 && gas === 0) car.speed = 0;

  const speedFactor = Math.max(0.35, 1 - Math.abs(car.speed) / CAR.maxSpeed * 0.55);
  car.heading += (car.steer * speedFactor * car.speed / CAR.length) * dt * 1.6;

  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const hit = resolveCircle(nx, nz, CAR.radius * 0.62, colliders);
  car.x = hit.x; car.z = hit.z;
  if (hit.bumped) car.speed *= 0.45;

  // Dorong pelan dari mobil lain (tabrakan sederhana lingkaran-lingkaran).
  for (const other of others) {
    if (other === car) continue;
    const dx = car.x - other.x;
    const dz = car.z - other.z;
    const d = Math.hypot(dx, dz);
    const min = CAR.radius * 0.9;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2;
      car.x += (dx / d) * push;
      car.z += (dz / d) * push;
      car.speed *= 0.8;
    }
  }

  car.x = Math.max(-CITY.half, Math.min(CITY.half, car.x));
  car.z = Math.max(-CITY.half, Math.min(CITY.half, car.z));
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  // Roda depan ikut setir; semua roda berputar mengikuti laju.
  car.wheels[0].rotation.y = car.steer;
  car.wheels[1].rotation.y = car.steer;
  for (const wheel of car.wheels) wheel.rotation.x += (car.speed * dt) / 0.36;
  return car.speed;
}

// Geser lingkaran keluar dari kotak gedung pertama yang ditabrak.
export function resolveCircle(x, z, radius, colliders) {
  let bumped = false;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    bumped = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * radius;
      z = cz + (dz / d) * radius;
    } else {
      // Titik tepat di dalam kotak: dorong ke sisi terdekat.
      const left = x - c.minX, right = c.maxX - x;
      const top = z - c.minZ, bottom = c.maxZ - z;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x = c.minX - radius;
      else if (m === right) x = c.maxX + radius;
      else if (m === top) z = c.minZ - radius;
      else z = c.maxZ + radius;
    }
  }
  return { x, z, bumped };
}

// --- Traffic: mobil AI yang melaju lurus di satu jalan, lalu berputar
// ke ujung lain kota (loop), dengan laju dan jalur yang beda-beda. ---
export function makeTraffic(scene, rng) {
  const cars = [];
  const streets = STREETS.filter((s) => s !== 0);
  for (let i = 0; i < 6; i++) {
    const vertical = i % 2 === 0;
    const street = streets[i % streets.length];
    const lane = (i % 2 === 0 ? 1 : -1) * 2.4;
    const paint = PAINTS[i % PAINTS.length];
    const { group } = buildCarMesh(paint);
    scene.add(group);
    cars.push({
      group, vertical, street, lane,
      pos: -95 + rng() * 190,
      speed: 7 + rng() * 5,
      heading: vertical ? (lane > 0 ? 0 : Math.PI) : (lane > 0 ? Math.PI / 2 : -Math.PI / 2),
      x: 0, z: 0, stopped: false, isTarget: false, paint,
    });
  }
  for (const car of cars) car.cruiseSpeed = car.speed;
  // Sinkronkan x/z awal supaya bisa dibajak / dikejar sejak frame pertama.
  for (const car of cars) {
    car.x = car.vertical ? car.street + car.lane : car.pos;
    car.z = car.vertical ? car.pos : car.street + car.lane;
  }
  return cars;
}

export function updateTraffic(cars, dt, avoid) {
  for (const car of cars) {
    if (car.stopped) continue; // dihentikan pemain (mis. Misi 2): diam di tempat
    // Menghindar: berhenti bila pemain/mobil pemain menghalangi jalan
    // di depan (jarak < 7 m) — lalu jalan lagi setelah jalanan kosong.
    let effSpeed = car.cruiseSpeed || car.speed;
    if (avoid) {
      const dx = car.x - avoid.x;
      const dz = car.z - avoid.z;
      if (Math.hypot(dx, dz) < 7) effSpeed = 0;
    }
    car.pos += effSpeed * dt * (car.lane > 0 ? 1 : -1);
    if (car.pos > 98) car.pos = -98;
    if (car.pos < -98) car.pos = 98;
    if (car.vertical) {
      car.group.position.set(car.street + car.lane, 0, car.pos);
    } else {
      car.group.position.set(car.pos, 0, car.street + car.lane);
    }
    car.group.rotation.y = car.heading;
    car.x = car.group.position.x;
    car.z = car.group.position.z;
  }
}
