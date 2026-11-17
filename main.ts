// Sunset Bay — program penyerahan untuk bounty gta6-01 (Node 22, hanya
// pustaka standar). Game-nya tinggal di folder game/ sebelah file ini:
// file statis yang dimainkan browser desktop tanpa jaringan (index.html +
// modul ES + three.js yang di-vendor sebagai *.min.js). Program ini
// menyalin game/ dan screenshots/ ke folder keluaran lalu menulis
// dossier.json di sana, memakai buildDossier dari vendor/makefun-game.ts.
//
// Di luar kontainer penilai, MAKEFUN_OUTPUT_DIR menggantikan /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Mainkan dulu secara lokal dengan `node serve.ts` di http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// Batas-batas dari gate penilai (reference/gate.json): hanya text_max_bytes
// yang membentuk isi dossier; sisanya menolak entri yang memang akan
// ditolak gate (lebih dari 4 screenshot atau satu di atas 256 KiB; game/
// di atas 993 file atau 48 MiB, atau ada path game/ di atas 1000 byte —
// game/ dihitung berdampingan dengan batas 1000 entri /output sendiri,
// beserta screenshots/ dan dossier.json).
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
