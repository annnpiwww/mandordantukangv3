# UI/UX Design Intelligence (Mandor)

Aktif: review screenshot, redesign, halaman/komponen baru, format tampilan atau pesan yang dikeluhkan user.
Lewati: perubahan logika tanpa permukaan visual.
Pelengkap: `antislop-ui` (anti generik); `impeccable` / `ui-ux-pro-max` / `frontend-design` kalau terpasang untuk detail visual.

Usability dulu, estetika kedua. Cantik tapi susah dipakai tetap gagal.

## Checklist evaluasi (sebut yang bermasalah saja)
- **Hierarki visual**: 1 fokus utama per layar, aksi utama paling menonjol.
- **Arsitektur informasi**: urutan mengikuti tugas user, label pakai bahasa user.
- **Layout & spacing**: grid konsisten, skala spacing 4/8, alignment rapi.
- **Tipografi**: maks 2 family, skala ukuran jelas, panjang baris nyaman.
- **Warna**: pakai token/variabel yang sudah ada; kontras teks WCAG AA 4.5:1; warna bukan satu-satunya penanda status.
- **Konsistensi komponen**: reuse komponen yang ada sebelum bikin baru.
- **Mobile-first**: lebar 360px, target sentuh 44px, konten tidak kepotong. Teks monospace/chat: hitung lebar karakter nyata.
- **Responsif**: pakai breakpoint project, tanpa horizontal scroll.
- **Aksesibilitas**: label, role, urutan fokus keyboard, alt text.
- **Interaksi**: feedback cepat, state disabled jelas, aksi destruktif minta konfirmasi.
- **State**: loading, empty, error, success. Tiap state punya teks dan jalan keluar.

## Review screenshot
Format temuan: `[elemen] masalah: koreksi konkret (nilai)`.
Contoh: `[tombol Simpan] kontras 2.8:1: pakai --primary-700, 4.9:1`.
Dilarang komentar umum ("kurang modern", "kurang clean"). Urutkan dari dampak terbesar ke usability.

## Redesign besar
1. Analisis desain sekarang: apa yang sudah jalan dan dipertahankan.
2. Masalah UX, dengan bukti (screenshot, keluhan, langkah user).
3. Arah desain: 1 paragraf + referensi pola nyata.
4. Hierarki komponen: pohon komponen, tandai reuse vs baru.
5. Spesifikasi interaksi: state + transisi tiap komponen.
6. Mockup/referensi: wajib kalau layout berubah besar; preview via `ask` atau gambar.
7. Acceptance criteria implementasi yang terukur (lebar, kontras, semua state ada, lolos `orca-bridge browser`).

Butir 4-7 masuk spec Tukang. Tukang tidak improvisasi desain di luar spec.
