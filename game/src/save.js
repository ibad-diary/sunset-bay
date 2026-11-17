// Simpan otomatis Sunset Bay ke localStorage: posisi pemain, mobil yang
// sedang dipakai beserta posisinya, dan waktu simpan. Muatannya kecil dan
// dibaca lagi saat tombol Lanjutkan ditekan; rusak atau kosong berarti
// mulai dari awal.

import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const payload = {
      version: 2,
      savedAt: Date.now(),
      player: { x: state.playerX, z: state.playerZ, heading: state.playerHeading },
      car: state.carIndex === -1 ? null : {
        index: state.carIndex, x: state.carX, z: state.carZ, heading: state.carHeading,
      },
      money: state.money || 0,
      missionIndex: state.missionIndex || 0,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch (_) {
    return false; // penyimpanan penuh / diblokir: game tetap jalan
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || (data.version !== 1 && data.version !== 2) || !data.player) return null;
    // Save v1 (M1) tidak punya uang/misi: default 0 agar tetap bisa dimuat.
    if (data.version === 1) { data.money = 0; data.missionIndex = 0; }
    return data;
  } catch (_) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}
