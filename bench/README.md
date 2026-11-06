# Benchmark: single-agent vs Mandor & Tukang

Tujuan: membuktikan (atau membantah) bahwa pola Mandor & Tukang menurunkan **total token per task yang berhasil**. Belum ada hasil terukur di repo ini. Jangan kutip angka persen sebelum tabel `usage compare` terisi dari run nyata.

## Isi
- `fixture/`: project Node kecil (`npm test` = `node --test`), sengaja ada bug di `src/format.js` dan `TAX_RATE` dobel.
- `scenarios/simple.json`: fix bug 1 baris (SIMPLE).
- `scenarios/medium.json`: fitur `applyCoupon` + test (MEDIUM).
- `scenarios/complex.json`: refactor `TAX_RATE` ke `src/tax.js` lintas 4 file, `isolate: true` (COMPLEX).
- `run.sh <scenario> <pair|single>`: reset repo bench ke fixture, buat task dengan `task_id`, `mode`, `scenario`, lalu assign.

## Protokol per run
1. `bench/run.sh medium single` (Mandor kerjakan sendiri) atau `bench/run.sh medium pair` (butuh `orca-pair ~/.cache/mandordantukangv3-bench/repo` aktif).
2. Selesaikan task seperti biasa. Akhiri dengan `orca-bridge task approve <id>` atau `task reject <id> --final`.
3. Usage Mandor (omp) dikumpulkan otomatis saat approve/reject (`source: actual`, atribusi time-window, jadi jangan kerjakan hal lain di project bench selama run).
4. Usage Tukang (Antigravity belum mengekspos usage): isi manual kalau ada angka dari provider dashboard, `--source actual`; kalau tebakan, `--source estimated`:
   `orca-bridge usage add <id> --role tukang --model gemini-3.8-flash --in N --out N --source actual`
5. Ulangi tiap skenario × mode minimal 3 kali (variasi model besar).
6. Hasil: `cd ~/.cache/mandordantukangv3-bench/repo && orca-bridge usage compare` (dan `usage report --csv` untuk data mentah).

## Membaca hasil
- `token_src`: `actual` = dari provider/omp; `estimated` = perkiraan; `+incomplete` = mode pair tapi usage Tukang belum diisi (total kekecilan, jangan dibandingkan).
- `success` = jumlah APPROVED / jumlah run. Token murah tapi gagal tidak dihitung hemat.
- Bandingkan juga `avg_cost_usd`: token Mandor dan Tukang beda harga, total token saja bisa menyesatkan.
- `handoff_tokens_est` (di `usage report`): ukuran pesan handoff + report, perkiraan bytes/4. Ini biaya langsung dari koordinasi.
