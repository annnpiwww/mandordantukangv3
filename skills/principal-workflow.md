# Principal Workflow (Mandor)

Aktif: task MEDIUM/COMPLEX, permintaan fitur/arsitektur/desain, atau usulan user yang janggal.
Lewati: SIMPLE (langsung edit, lalu verifikasi).

## Routing per kelas
| Fase | SIMPLE | MEDIUM | COMPLEX |
| :--- | :--- | :--- | :--- |
| DISCOVER | baca baris target | ya | ya |
| ANALYZE | - | singkat | ya |
| CHALLENGE | kalau usulan user janggal | 1 putaran | ya |
| CONCEPTUALIZE | - | kalau ada produk/UI | ya |
| PLAN | - | 1 spec | spec per slice + urutan |
| DELEGATE / EXECUTE | edit sendiri | Tukang | Tukang, `isolate: true` |
| VERIFY | test/log | gate `CHECK` | gate `CHECK` per slice |
| LEARN | - | kalau ada keputusan reusable | ya |

## Fase
1. **DISCOVER**: tulis tujuan user dalam 1 kalimat (masalah apa, untuk siapa, kapan dianggap beres). Cek implementasi dan data asli pakai `semantex`/`xerj`/`gitnexus`. Jangan tanya hal yang bisa dibaca dari repo.
2. **ANALYZE**: constraint nyata (data, server, deploy, user), dependency (`gitnexus impact`), risiko (data loss, security, performa, migrasi).
3. **CHALLENGE**, jawab semua:
   - Masalah aslinya apa, dan beda tidak dengan solusi yang diminta? (contoh: user minta tabel lebar, masalahnya layar HP sempit)
   - Asumsi mana yang belum terbukti? Buktikan, atau tandai sebagai asumsi.
   - Ada rung lebih rendah di Ladder (config, kode yang sudah ada, hapus kebutuhannya)?
   - Hidden requirement: state kosong/error, izin, data lama, mobile, rollback.
   Usulan user lemah: sebut risiko + bukti + alternatif. Ada tradeoff nyata: `ask` 2-3 opsi dengan preview, rekomendasikan satu. User tetap pilih caranya: eksekusi, jangan diulang.
4. **CONCEPTUALIZE**: fitur/alur baru pakai `skills/product-intelligence.md`. UI/visual/format tampilan pakai `skills/uiux-intelligence.md`.
5. **PLAN** (arsitektur):
   - Alternatif: tulis 2+ hanya kalau tradeoff-nya nyata. Pilih yang paling sederhana dan andal, sebut 1 alasan menolak yang lain.
   - Data flow dan kontrak: input, proses, output; schema/API/format pesan lintas modul ditulis verbatim di `required_changes`.
   - Security: trust boundary + guard OWASP yang berlaku.
   - Performa: hanya kalau ada volume/latensi nyata.
   - Migrasi: data lama, backward compat, rollback.
   - Urutan: slice COMPLEX berurutan hanya kalau ada dependency nyata.
   Hasil plan langsung jadi field spec: `objective`, `allowed_files`, `required_changes` (langkah + kontrak + edge case), `acceptance_criteria` (perilaku teramati), `verification_command`, `constraints`. Tanpa dokumen terpisah.
6. **DELEGATE / EXECUTE / VERIFY**: kontrak bridge tetap (allowlist, 1 verify command, idle pasca delegasi, Max 1 Pass Gate, no self-approve). Saat gate, cocokkan hasil dengan masalah asli dari DISCOVER, bukan cuma kriteria teknis. Belum menjawab masalah: 1 `task reject` spesifik.
7. **LEARN**: keputusan reusable (pilihan arsitektur, konvensi format, alasan menolak opsi) dicatat 1-3 baris di dokumen project yang sudah ada (spec, ADR, README) atau vault project. Tidak ada keputusan baru: skip.

## Anti-pola
- Memaksakan semua fase ke task kecil.
- Analisis panjang ke user. Kedalaman masuk spec; ke user tetap Caveman Ultra.
- Abstraksi atau layer baru untuk satu caller.
- Klaim "lebih baik/lebih cepat" tanpa ukuran.
