// Suara Sunset Bay — semuanya prosedural lewat WebAudio, tanpa file
// atau aset eksternal: dengung mesin, sirene polisi, bunyi paket,
// pukulan, jingle misi, dan pad musik ambient. AudioContext hanya
// dibuat/dilanjutkan setelah gestur pengguna (klik/tombol), supaya
// browser headless maupun browser biasa tidak melempar exception.

// Stasiun radio kota: bus musik ambient prosedural (pad Am–F–C–G).
// Namanya tampil di label mute HUD dan layar jeda.
export const RADIO_STATION = 'SENJA FM';

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenTimer = null;
  let musicTimer = null;
  let musicOscs = [];
  let muted = false;
  let started = false;
  let soundsPlayed = 0;
  let sirenOn = false;
  let engineOn = false;

  // Akor pad ambient (Am – F – C – G), frekuensi nada-nadanya.
  const CHORDS = [
    [220.0, 261.63, 329.63],
    [174.61, 220.0, 261.63],
    [196.0, 246.94, 293.66],
    [130.81, 164.81, 196.0],
  ];
  let chordIndex = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);
      // Bus musik SENJA FM: pad sine pelan.
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.05;
      musicGain.connect(master);
      // Dengung mesin: sawtooth lewat lowpass, gain mengikuti laju.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Sirene: square dua nada, gain 0 sampai polisi dekat.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenTimer = setInterval(() => {
        if (!ctx || muted) return;
        sirenHigh = !sirenHigh;
        try {
          sirenOsc.frequency.setTargetAtTime(sirenHigh ? 960 : 720, ctx.currentTime, 0.08);
        } catch (_) { /* abaikan */ }
      }, 380);
      // Pad musik SENJA FM: tiga sine, akor berganti tiap 5 detik.
      musicOscs = CHORDS[0].map((f) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0.33;
        o.connect(g);
        g.connect(musicGain);
        o.start();
        return o;
      });
      musicTimer = setInterval(() => {
        if (!ctx) return;
        chordIndex = (chordIndex + 1) % CHORDS.length;
        const chord = CHORDS[chordIndex];
        musicOscs.forEach((o, i) => {
          try { o.frequency.setTargetAtTime(chord[i], ctx.currentTime, 1.2); } catch (_) { /* abaikan */ }
        });
      }, 5000);
      return true;
    } catch (_) {
      ctx = null;
      return false;
    }
  }

  // Nada pendek (blip): dipakai paket, jingle, dan bunyi UI.
  function blip(freq, at, dur, type, vol) {
    if (!ctx || muted) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      const t = ctx.currentTime + (at || 0);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.05);
      soundsPlayed += 1;
    } catch (_) { /* suara gagal: game tetap jalan */ }
  }

  return {
    // Dipanggil dari gestur pengguna (klik MULAI / tombol apa pun).
    // Tidak pernah throw: bila AudioContext diblokir, suara diam saja.
    unlock() {
      try {
        if (!ensure()) return false;
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        started = true;
        return true;
      } catch (_) {
        return false;
      }
    },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      try {
        if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
      } catch (_) { /* abaikan */ }
      return muted;
    },
    // Dipanggil tiap frame: mesin ikut laju, sirene ikut jarak polisi.
    update(driving, speedKmh, wantedLevel, nearestPoliceDist) {
      if (!ctx || !started) return;
      try {
        const wantEngine = driving && Math.abs(speedKmh) > 2;
        engineOn = wantEngine;
        const targetGain = wantEngine ? 0.045 + Math.min(0.05, Math.abs(speedKmh) / 2200) : 0;
        engineGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.15);
        engineOsc.frequency.setTargetAtTime(52 + Math.abs(speedKmh) * 1.1, ctx.currentTime, 0.1);
        const wantSiren = wantedLevel >= 1 && nearestPoliceDist < 45;
        sirenOn = wantSiren;
        sirenGain.gain.setTargetAtTime(wantSiren ? 0.035 : 0, ctx.currentTime, 0.3);
      } catch (_) { /* abaikan */ }
    },
    // Bunyi ambil paket (naik) / antar paket (turun, dipakai misi).
    pickup() { blip(880, 0, 0.14, 'sine', 0.18); blip(1174, 0.09, 0.18, 'sine', 0.16); },
    deliver() { blip(1174, 0, 0.14, 'sine', 0.18); blip(880, 0.09, 0.2, 'sine', 0.16); },
    // Pukulan: dentum rendah (sine jatuh) + klik tajam.
    punch(hit) {
      if (!ctx || muted) return;
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        const t = ctx.currentTime;
        o.frequency.setValueAtTime(hit ? 190 : 140, t);
        o.frequency.exponentialRampToValueAtTime(55, t + 0.13);
        g.gain.setValueAtTime(hit ? 0.5 : 0.22, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
        o.connect(g);
        g.connect(master);
        o.start(t);
        o.stop(t + 0.18);
        soundsPlayed += 1;
      } catch (_) { /* abaikan */ }
    },
    // Jingle misi selesai: empat nada naik.
    jingle() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip(f, i * 0.13, 0.22, 'triangle', 0.2));
    },
    // Keadaan untuk alat luar / playtest headless.
    state() {
      return {
        ctx: ctx ? ctx.state : 'none',
        started,
        muted,
        soundsPlayed,
        engineOn,
        sirenOn,
        station: RADIO_STATION,
      };
    },
  };
}
