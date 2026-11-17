# Sunset Bay — Rencana Game

## Visi

Sunset Bay adalah game open-world orisinal berlatar kota pesisir
fiktif di tepi teluk, saat matahari terbenam. Pemain bebas
menjelajah kota, mengemudi, dan menjalani cerita kecil tentang
seorang kurir yang baru pindah ke kota ini dan perlahan dikenal
warganya. Nada gamenya hangat dan santai di permukaan, tetapi
ada ketegangan di baliknya: utang lama, geng jalanan, dan polisi
yang mengawasi setiap sudut. Ini bukan tiruan kota atau seri
game mana pun — nama jalan, karakter, dan distriknya dibuat
sendiri dari nol.

## Fitur (urut prioritas)

1. Kota yang bisa dijelajahi dengan jalan kaki — trotoar,
   gang, taman, dermaga, dan pasar malam yang hidup.
2. Mobil yang bisa dikendarai — akselerasi, rem, belok,
   dan tabrakan ringan dengan objek kota.
3. Traffic dan pejalan kaki — mobil lain mengikuti jalan,
   pejalan kaki menyeberang dan menghindar.
4. Curi mobil — pemain bisa mengambil mobil parkir dan
   kabur, dengan risiko ketahuan pemilik atau polisi.
5. Sistem wanted dan polisi — level buronan naik saat
   berbuat onar; polisi mengejar, memblokir, lalu mundur
   saat pemain lolos cukup lama.
6. Misi dan cerita — rangkaian tugas kurir yang membuka
   distrik baru, karakter baru, dan pilihan kecil.
7. Combat sederhana — pukulan dan dorongan saat konflik
   jalanan, tanpa senjata berat di tahap awal.
8. HUD dan minimap — kesehatan, wanted, kecepatan,
   tujuan misi, dan peta kecil yang mengikuti pemain.
9. Start dan save — layar mulai, jeda, dan penyimpanan
   progres misi serta posisi pemain.

## Catatan Teknis

- Mesin render memakai three.js yang di-vendor sebagai
  file *.min.js di bawah game/, supaya game jalan dari
  file statis tanpa perlu mengunduh pustaka saat main.
- Semua aset game berupa file statis tanpa network saat
  bermain; tidak ada panggilan API selama sesi jalan.
- main.ts berjalan di Node 22 dan menulis dossier.json
  ke /output sebagai ringkasan build untuk penjurian.
- Rekaman gameplay diambil dengan kit record yang
  disediakan, memakai screenshot start, play, dan end.

## Milestones

- Tahap 1 — Fondasi (MILESTONE 1, dibangun 2026-11-17): kota jalan kaki,
  mobil, traffic, HUD dan minimap sudah bisa dimainkan ujung ke ujung.
  Desain M1 — Kota: grid jalan 5×5 blok di tepi teluk (laut di sisi barat
  + dermaga kayu), gedung prosedural warna-warni dengan tinggi bervariasi,
  trotoar, lampu jalan, pohon palem, dan langit senja (matahari rendah,
  kabut hangat). Karakter: kurir "Raka" low-poly dari primitif three.js,
  third-person, WASD + seret mouse untuk melihat, Shift lari. Mobil: 4
  mobil parkir orisinal (warna beda-beda), tombol E masuk/keluar, gas/rem/
  setir arcade (W/S/A/D), kamera kejar di belakang mobil, tabrakan
  sederhana dengan gedung (kotak pembatas) dan batas kota. Traffic: mobil
  AI melaju mengikuti jalan lurus bolak-balik; pejalan kaki berjalan di
  trotoar. HUD: kecepatan saat mengemudi, teks petunjuk kontekstual,
  minimap kanvas 2D (jalan, pemain, mobil). Layar start: judul "Sunset
  Bay", daftar kontrol, tombol Start; jeda dengan Esc/P. Simpan: posisi
  pemain + mobil tersimpan otomatis ke localStorage tiap beberapa detik.
  Semua model dari primitif three.js, tanpa aset unduhan; three.js 0.187.0
  di-vendor sebagai game/vendor/three.module.min.js. Screenshot diambil
  dari game asli via ?shot=start|walk|drive|aerial.
  Yang BELUM ada di M1 (stub untuk M2/M3): curi mobil + wanted/polisi,
  misi/cerita, combat, dan suara — HUD menampilkan "Wanted: —" sebagai
  tempatnya nanti, tanpa sistem di baliknya.
- Tahap 2 — Sistem: curi mobil, wanted dan polisi,
  serta misi pertama dengan cerita kurir selesai.
- Tahap 3 — Poles: combat, save, balancing, dan
  rekaman final sebelum batas waktu pengumpulan.
