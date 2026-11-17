// HUD Sunset Bay: teks distrik/tujuan/petunjuk, speedometer saat
// mengemudi, bintang wanted yang hidup, saldo Rp, lencana mobil curian,
// banner misi selesai, dan minimap kanvas 2D — jalan, laut, taman, mobil,
// polisi, penanda misi, dan titik pemain yang berputar mengikuti arah.

import { CITY, STREETS } from './config.js';
import { formatRp } from './missions.js';

export function createHud() {
  const root = document.getElementById('hud');
  const district = document.getElementById('district');
  const objective = document.getElementById('objective');
  const speedo = document.getElementById('speedo');
  const speedNum = document.getElementById('speedNum');
  const hint = document.getElementById('hint');
  const wantedEl = document.getElementById('wanted');
  const wantedStars = document.getElementById('wantedStars');
  const moneyEl = document.getElementById('money');
  const stolenEl = document.getElementById('stolenBadge');
  const muteEl = document.getElementById('muteIcon');
  const punchEl = document.getElementById('punchFlash');
  const banner = document.getElementById('missionBanner');
  const bannerTitle = document.getElementById('bannerTitle');
  const bannerText = document.getElementById('bannerText');
  const map = document.getElementById('minimap');
  const ctx = map.getContext('2d');
  const R = 84; // jari-jari minimap (px)
  let bannerTimer = null;
  let punchTimer = null;

  function toMap(x, z) {
    return [R + (x / (CITY.half + 20)) * R, R + (z / (CITY.half + 20)) * R];
  }

  function drawMinimap(playerX, playerZ, heading, cars, walkers, extra) {
    const opts = extra || {};
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
    // Penanda misi: berlian emas berdenyut.
    if (opts.missionPos) {
      const [mx, mz] = toMap(opts.missionPos.x, opts.missionPos.z);
      const pulse = 5 + Math.sin(Date.now() / 280) * 1.6;
      ctx.fillStyle = '#ffd34d';
      ctx.strokeStyle = '#7a5a00';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mx, mz - pulse); ctx.lineTo(mx + pulse * 0.7, mz);
      ctx.lineTo(mx, mz + pulse); ctx.lineTo(mx - pulse * 0.7, mz);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
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
    // Polisi: titik biru-merah dengan cincin berdenyut.
    if (opts.police) {
      const ringR = 5.4 + Math.sin(Date.now() / 300) * 1.2;
      for (const car of opts.police) {
        const [cx, cz] = toMap(car.x, car.z);
        ctx.fillStyle = '#3d7dd8';
        ctx.beginPath(); ctx.arc(cx, cz, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ff4040';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(cx, cz, ringR, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // Mobil target Misi 2: titik oranye besar.
    if (opts.targetCar) {
      const [tx, tz] = toMap(opts.targetCar.x, opts.targetCar.z);
      ctx.fillStyle = '#ff8c1a';
      ctx.beginPath(); ctx.arc(tx, tz, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(tx, tz, 4.5, 0, Math.PI * 2); ctx.stroke();
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
    // Bintang wanted hidup: ★ terisi kuning, ☆ kosong redup; warna
    // label memerah saat buronan tinggi.
    setWanted(level) {
      const filled = '★'.repeat(level);
      const empty = '☆'.repeat(5 - level);
      wantedStars.textContent = filled + empty;
      wantedEl.style.color = level >= 3 ? '#ff6b5e' : level > 0 ? '#ffd34d' : '#cfd6e4';
    },
    setMoney(amount) { moneyEl.textContent = formatRp(amount); },
    setStolen(stolen) { stolenEl.classList.toggle('hidden', !stolen); },
    // Ikon speaker: 🔊 suara hidup, 🔇 dibisukan (tombol M).
    setMuted(muted) { if (muteEl) muteEl.textContent = muted ? '🔇 BISU' : '🔊 SUARA'; },
    // Kilat "PUKUL!" di tengah layar saat ayunan pukulan mendarat.
    flashPunch(hit) {
      if (!punchEl) return;
      punchEl.textContent = hit ? '💥 PUKUL! KENA!' : '💥 PUKUL!';
      punchEl.classList.remove('hidden');
      if (punchTimer) clearTimeout(punchTimer);
      punchTimer = setTimeout(() => punchEl.classList.add('hidden'), 350);
    },
    // Banner tengah layar beberapa detik saat misi tuntas.
    showMissionComplete(mission) {
      bannerTitle.textContent = '★ MISI SELESAI — ' + mission.title + ' ★';
      bannerText.textContent = 'Hadiah ' + formatRp(mission.reward) + ' masuk ke saldo Raka.';
      banner.classList.remove('hidden');
      if (bannerTimer) clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => banner.classList.add('hidden'), 4200);
    },
    drawMinimap,
  };
}
