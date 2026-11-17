// Input keyboard + mouse untuk Sunset Bay. Tombol yang ditahan dibaca
// tiap frame; tombol sekali tekan (E, jeda, mulai) diantre sebagai aksi
// supaya tidak ada tekanan yang hilang di antara dua frame. Kamera
// diputar dengan menyeret mouse (klik juga mengunci pointer bila browser
// mengizinkan, tapi seret selalu jalan sebagai cadangan).

export const ACTION_ENTER_CAR = 1;
export const ACTION_PAUSE = 2;
export const ACTION_START = 4;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const ENTER = new Set(['KeyE']);
const PAUSE = new Set(['KeyP', 'Escape']);
const START = new Set(['Enter', 'Space']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let dragYaw = 0;
  let dragPitch = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let locked = false;

  function press(code) {
    if (ENTER.has(code)) actions |= ACTION_ENTER_CAR;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (START.has(code)) actions |= ACTION_START;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    press(event.code);
    if (FORWARD.has(event.code) || BACK.has(event.code) ||
        LEFT.has(event.code) || RIGHT.has(event.code) ||
        START.has(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    if (canvas.requestPointerLock) {
      try { canvas.requestPointerLock(); } catch (_) { /* seret tetap jalan */ }
    }
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  window.addEventListener('pointermove', (event) => {
    if (locked) {
      dragYaw -= event.movementX * 0.0032;
      dragPitch -= event.movementY * 0.0026;
      return;
    }
    if (!dragging) return;
    dragYaw -= (event.clientX - lastX) * 0.005;
    dragPitch -= (event.clientY - lastY) * 0.004;
    lastX = event.clientX;
    lastY = event.clientY;
  });

  function axis(neg, pos) {
    return (pos ? 1 : 0) - (neg ? 1 : 0);
  }

  return {
    // -1..1: maju/mundur (W/S) dan kiri/kanan (A/D).
    moveForward() {
      return axis(
        [...BACK].some((c) => held.has(c)),
        [...FORWARD].some((c) => held.has(c)),
      );
    },
    moveStrafe() {
      return axis(
        [...LEFT].some((c) => held.has(c)),
        [...RIGHT].some((c) => held.has(c)),
      );
    },
    running() {
      return [...RUN].some((c) => held.has(c));
    },
    // Putaran kamera sejak pemanggilan terakhir, dalam radian.
    takeLook() {
      const look = { yaw: dragYaw, pitch: dragPitch };
      dragYaw = 0;
      dragPitch = 0;
      return look;
    },
    // Tekanan sekali yang terjadi sejak pemanggilan terakhir.
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    // Dipakai mode tangkapan layar: meniru tombol ditahan dari kode.
    inject(code, down) {
      if (down) held.add(code); else held.delete(code);
    },
  };
}
