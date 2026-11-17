// Semua angka penyetel Sunset Bay di satu tempat: ukuran kota, gerak
// karakter, fisika mobil arcade, dan warna-warna senja kota ini.

export const CITY = {
  half: 100,            // kota membentang -100..100 di x dan z
  roadGap: 40,          // jarak antar sumbu jalan
  roadWidth: 10,        // lebar aspal
  blockPad: 2,          // jarak gedung dari tepi blok
  bayEdge: -104,        // garis pantai: laut di barat x < bayEdge
  beachWidth: 8,
};

export const STREETS = [-80, -40, 0, 40, 80]; // sumbu jalan di x dan di z

export const PLAYER = {
  walkSpeed: 4.2,
  runSpeed: 8.0,
  accel: 26,
  turnSpeed: 10,
  radius: 0.55,
  eyeHeight: 1.7,
};

export const CAR = {
  accel: 14,            // m/s^2 saat gas
  brake: 26,            // m/s^2 saat rem / mundur
  drag: 0.55,           // hambatan udara per detik
  maxSpeed: 30,         // ~108 km/jam
  maxReverse: 9,
  steerMax: 0.55,       // radian roda depan
  steerSpeed: 2.4,
  length: 4.4,
  width: 1.9,
  radius: 2.4,          // lingkaran tabrakan kasar
};

export const TRAFFIC_COUNT = 6;
export const WALKER_COUNT = 9;

export const SAVE_KEY = 'sunset-bay.save.v1';
export const SAVE_EVERY_SECONDS = 5;

// Palet senja: langit, laut, aspal, dan warna gedung yang hangat.
export const PALETTE = {
  skyTop: 0x2e4a7a,
  skyBottom: 0xff9a5c,
  sun: 0xffd9a0,
  sea: 0x1e6f8e,
  sand: 0xd9b380,
  grass: 0x4d7a4a,
  asphalt: 0x4b4e56,
  sidewalk: 0xa89f92,
  curb: 0x6f6a62,
  buildings: [0xe8b04b, 0xd96a4f, 0x7fb3a3, 0xc98bb0, 0x8fa8d8, 0xe0d6c0, 0xb56a8a, 0x6fa287],
  windowLit: 0xffd98a,
  windowDark: 0x2c3a52,
};

// RNG deterministik (mulberry32) supaya kotanya sama di tiap muatan.
export function makeSeededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// Jarak titik ke ruas jalan terdekat; dipakai untuk tahu apakah posisi
// berada di atas aspal (untuk minimap dan suara langkah, nanti).
export function nearestStreetDistance(x, z) {
  let best = Infinity;
  for (const s of STREETS) {
    best = Math.min(best, Math.abs(x - s), Math.abs(z - s));
  }
  return best;
}

export function isOnRoad(x, z) {
  return nearestStreetDistance(x, z) <= CITY.roadWidth / 2;
}
