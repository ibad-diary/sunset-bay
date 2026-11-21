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
6. Misi dan cerita — rangkaian tiga tugas kurir di distrik kota
   yang sudah terbuka semua sejak awal, dengan karakter yang sudah
   ada di dunia (Pak Darman, Dito dari Geng Ombak).
7. Combat sederhana — pukulan dan dorongan saat konflik
   jalanan, tanpa senjata berat di tahap awal.
8. HUD dan minimap — wanted, kecepatan, saldo, tujuan misi,
   dan peta kecil yang mengikuti pemain.
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
- Tahap 2 — Sistem (MILESTONE 2, dibangun 2026-11-17): curi mobil,
  wanted dan polisi, serta tiga misi cerita kurir selesai.
  Desain M2 — Curi mobil: semua mobil parkir dan mobil traffic bisa
  dibajak dengan E saat didekati; membajak mobil traffic menghentikan
  mobilnya dan pengemudinya keluar lalu lari; mobil curian ditandai di
  HUD ("MOBIL CURIAN") dan minimap. Wanted: bintang 1–5, naik saat
  membajak (+1 parkir, +2 traffic), menabrak pejalan kaki (+2),
  menabrak mobil polisi (+1), atau ngebut di dekat polisi (+1);
  turun perlahan bila tidak ada polisi yang melihat (1 bintang per
  ~12 detik saat bersembunyi). Polisi: mobil patroli hitam-putih
  dengan lampu merah-biru kelap-kelip, spawn sejumlah bintang wanted
  (maks 3 aktif), mengejar dan menabrak pemain; kontak 1 detik saat
  wanted ≥ 3 berarti TERTANGKAP — layar gagal + tombol coba lagi
  (wanted direset, Raka kembali ke titik awal, progres misi tetap).
  Misi (berurutan, hadiah uang tampil di HUD sebagai saldo Rp):
  M1 "Antar Paket" — bawa paket ke ujung dermaga, hadiah Rp150.000;
  M2 "Kejar Kurir" — potong jalan kurir lain (mobil traffic target
  bertanda emas) sampai berhenti lalu ambil paketnya, Rp250.000;
  M3 "Kabur dari Polisi" — wanted naik ke 3 bintang, bertahan sampai
  wanted hilang, Rp400.000. Tiap misi: briefing di layar start dan
  objektif HUD, penanda suar cahaya + panah di dunia, dan penanda di
  minimap; layar "MISI SELESAI" saat tuntas. Cerita orisinal: Raka,
  kurir baru di Sunset Bay, dikejar utang lama dan diawasi polisi
  teluk — tanpa unsur dari game komersial mana pun. Perbaikan kecil:
  dermaga bisa dinaiki (collider penghalang dihapus, lantai dermaga
  direndahkan, Raka naik ke ketinggian dermaga saat di atasnya);
  pejalan kaki minggir saat pemain/mobil mendekat. Yang MASIH stub
  untuk M3: combat dan suara.
  Verifikasi M2 (headless Chrome, CDP, 2026-11-17): bajak mobil parkir
  → wanted 1 + 1 polisi spawn; bajak mobil traffic → mobil berhenti,
  pengemudi lari, wanted +2, dan bila itu mobil target Misi 2 maka
  Misi 2 ikut selesai; Misi 1 → Rp150.000; Misi 2 → Rp400.000 total;
  Misi 3 (wanted 3 → 0) → Rp800.000 total, semua misi selesai; polisi
  mengejar (posisi terpantau mendekat tiap probe) dan kontak 1 detik
  di wanted 3 → layar TERTANGKAP → Coba Lagi mereset wanted/polisi.
  Tiga bug ditemukan saat playtest dan diperbaiki: (1) Misi 3 tidak
  pernah selesai karena penjaga "tanpa target" mengembalikan update
  lebih awal; (2) polisi menyerempet pemain lalu melaju terus sehingga
  timer kontak selalu reset — polisi kini merangkak saat dekat dan
  timer meluruh pelan; (3) pengemudi yang baru dibajak terhitung
  "tertabrak" mobil diam — tabrakan pejalan kaki kini mensyaratkan
  mobil melaju > 2 m/s. Screenshot M2: 1-chase.jpg (kejar-kejaran,
  wanted 3, Rp400.000, MOBIL CURIAN) dan 2-mission.jpg (suar emas
  dermaga Misi 1); 3-start.jpg dan 4-drive.jpg dipertahankan dari M1.
- Tahap 3 — Poles: combat, suara, balancing, dan
  rekaman final sebelum batas waktu pengumpulan.
- Tahap 3 — Poles (MILESTONE 3, dibangun 2026-11-17): combat, suara,
  dan polish murah selesai. Desain M3 — Combat: pukulan jarak dekat
  saat jalan kaki (tombol F atau klik mouse, file baru combat.js):
  ayunan lengan kanan Raka (characters.js: punch()), efek sapuan
  putih di depan pemain, pejalan kaki yang kena terdorong 2,5 m lalu
  lari ketakutan 3 detik; memukul pejalan kaki/polisi menaikkan wanted
  +1; prompt HUD "F pukul" muncul bila pejalan kaki dekat, kilat
  "💥 PUKUL! KENA!" di tengah layar saat mendarat. Suara (file baru
  audio.js, semua prosedural WebAudio, tanpa aset eksternal): dengung
  mesin (pitch ikut laju mobil), sirene dua nada saat wanted ≥ 1 dan
  polisi dekat (< 45 m), bunyi ambil/antar paket, dentum pukulan,
  jingle 4 nada saat misi selesai, dan pad ambient Am–F–C–G pelan yang
  berganti akor tiap 5 detik; tombol M = bisu + ikon 🔊/🔇 di HUD;
  AudioContext hanya dibuat setelah gestur pengguna (klik/tombol),
  dibungkus try/catch supaya headless Chrome tidak throw. Polish:
  (a) traffic berhenti bila pemain/mobil menghalangi jalan (< 7 m),
  pejalan kaki sudah minggir sejak M2; (b) kamera tidak tembus gedung
  — collider kini menyimpan tinggi atap, posisi kamera dinaikkan ke
  atas atap bila masuk kotak gedung; (c) mobil curian dari traffic
  kini ikut tersimpan (save v3: carData posisi + warna) dan dipulihkan
  saat Lanjutkan. Balance polisi (26 vs 30 m/s) dan harga/hadiah misi
  TIDAK diubah. Screenshot baru: 4-combat.jpg menggantikan
  4-drive.jpg (drive sudah terwakili di 1-chase.jpg); 1-chase,
  2-mission, 3-start dipertahankan.
