// HUD Sunset Bay: teks distrik/tujuan/petunjuk, speedometer saat
// mengemudi, dan minimap kanvas 2D — jalan, laut, taman, mobil, dan
// titik pemain yang berputar mengikuti arah hadap.

import { CITY, STREETS } from './config.js';

export function createHud() {
  const root = document.getElementById('hud');
  const district = document.getElementById('district');
  const objective = document.getElementById('objective');
  const speedo = document.getElementById('speedo');
  const speedNum = document.getElementById('speedNum');
  const hint = document.getElementById('hint');
  const map = document.getElementById('minimap');
  const ctx = map.getContext('2d');
  const R = 84; // jari-jari minimap (px)

  function toMap(x, z) {
    return [R + (x / (CITY.half + 20)) * R, R + (z / (CITY.half + 20)) * R];
  }

  function drawMinimap(playerX, playerZ, heading, cars, walkers) {
    ctx.clearRect(0, 0, 168, 168);
    // Laut di barat.
    ctx.fillStyle = '#1e6f8e';
    ctx.fillRect(0, 0, 14, 168);
    ctx.fillStyle = '#d9b380';
    ctx.fillRect(14, 0, 4, 168);
    // Blok kota.
    ctx.fillStyle = '#5d6b52';
    ctx.fillRect(18, 0, 150, 168);
    // Jalan.
    ctx.strokeStyle = '#3a3d44';
    ctx.lineWidth = 7;
    for (const s of STREETS) {
      const [mx] = toMap(s, 0);
      const [, mz] = toMap(0, s);
      ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, 168); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, mz); ctx.lineTo(168, mz); ctx.stroke();
    }
    // Taman Teluk.
    const [px, pz] = toMap(20, 20);
    ctx.fillStyle = '#3f6b3a';
    ctx.fillRect(px - 12, pz - 12, 24, 24);
    // Mobil (titik kuning) dan pejalan kaki (titik putih kecil).
    ctx.fillStyle = '#ffd34d';
    for (const car of cars) {
      const [cx, cz] = toMap(car.x, car.z);
      ctx.beginPath(); ctx.arc(cx, cz, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const w of walkers) {
      const [wx, wz] = toMap(w.x, w.z);
      ctx.beginPath(); ctx.arc(wx, wz, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    // Pemain: segitiga putih menghadap arah jalan.
    const [ux, uy] = toMap(playerX, playerZ);
    ctx.save();
    ctx.translate(ux, uy);
    ctx.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  return {
    show() { root.classList.remove('hidden'); },
    hide() { root.classList.add('hidden'); },
    setDistrict(name) { district.textContent = name; },
    setObjective(text) { objective.textContent = text; },
    setHint(text) { hint.textContent = text; },
    showSpeed(show) { speedo.classList.toggle('hidden', !show); },
    setSpeed(kmh) { speedNum.textContent = String(Math.round(kmh)); },
    drawMinimap,
  };
}
