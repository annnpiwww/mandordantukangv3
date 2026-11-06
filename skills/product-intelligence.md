# Product Intelligence (Mandor)

Aktif: fitur baru, perubahan alur user, atau permintaan yang "apa yang dibangun" belum jelas.
Lewati: bugfix, refactor, perubahan format kecil.
Dokumen panjang: pakai skill `brainstorming` / `writing-plans` / `openspec-propose` kalau terpasang. File ini checklist minimumnya.

Jalankan berurutan, berhenti begitu keputusan sudah cukup:
1. **Problem**: siapa user, situasinya apa, sakitnya apa, buktinya apa (laporan, data, keluhan). Tanpa bukti: tandai asumsi.
2. **Requirement**: pisahkan user (yang dilihat/dilakukan), bisnis (aturan, laporan, biaya), teknis (data yang benar-benar ada). Field yang tidak ada di data asli jangan dijanjikan.
3. **Opsi fitur**: 2-3 opsi, tiap opsi 1 baris value + 1 baris biaya. Buang yang tidak menjawab problem.
4. **User journey**: trigger, langkah, hasil. Termasuk jalur gagal (data kosong, user tidak merespons, jaringan putus).
5. **Prioritas**: Must (tanpa ini problem tidak selesai), Should, Won't-now. Won't-now ditulis eksplisit supaya tidak merayap masuk.
6. **MVP**: Must saja, bisa diverifikasi end-to-end. Bukan scaffold atau mock.
7. **PRD ringkas** (kalau perlu disimpan): problem, user, scope Must, out of scope, journey, acceptance criteria, risiko. Simpan di lokasi spec project yang sudah ada.
8. **Acceptance criteria**: perilaku teramati ("input X, hasil Y" atau Given/When/Then). Masuk field `acceptance_criteria`.
9. **Edge case**: kosong, duplikat, batas waktu/zona waktu, izin/role, data lama, concurrency, offline. Tulis yang relevan saja.

Output ke user: keputusan + pertanyaan yang memang harus user putuskan (via `ask`).
Output ke Tukang: Must + acceptance criteria + edge case. Bukan PRD penuh.
