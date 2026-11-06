1/11
Pernah nggak coding pake satu AI, tapi boncos token karena dia halu dan nebak-nebak? Parahnya lagi, file yang nggak lu suruh malah ikut diacak-acak.

Gw bikin squad 4 AI yang kerja kayak proyek beneran: 1 mandor, 3 tukang. Semua punya jobdesc rapi dan nggak bakal overlap.

Ini cara kerjanya 👇

---

2/11
Idenya simpel: pisahin otak sama tangan.

Model mahal frontier class (Claude) cuma mikir: bikin arsitektur, bikin rencana kerja, review kode, dan nolak kerjaan jelek.

Model kenceng dan murah (Gemini) yang ngetik kode di lapangan. Otak model pintar, tangan model murah. Token lu selamat, dompet aman. 🧠

---

3/11
Syarat wajib biar squad ini jalan:

1. Orca IDE + `orca` CLI (terminal grid 2x2 plus browser bawaan)
2. Claude Pro (otak Mandor via OMP atau Claude Code)
3. Gemini (tangan para tukang via Antigravity)

Plus Node.js dan Bash di sistem. Tanpa tiga hal di atas, sistem ini nggak bakal bisa jalan sama sekali. ⚙️

---

4/11
Pane 1: MANDOR.

Dia lead architect yang pegang kendali. Mandor delegasi tugas via `orca-bridge delegate --spec`, cek koneksi lewat `orca-bridge status`, dan review via `orca-bridge task approve|reject`.

Dia tulis JSON spec ketat (daftar file + 1 command verifikasi). Mandor haram ngoding kecuali diff kecil banget (<15 baris).

Skill wajib: `mandor-prototype-spec` dan `senior-uiux-auditor`. 📋

---

5/11
Pane 2: TUKANG UI.

Spesialis tampilan, CSS, responsive layout, dan visual QA. Dia dilarang sentuh logic backend.

Setelah ngoding, dia wajib buktiin hasilnya pake screenshot via `orca-bridge browser`. Bukan cuma ngaku "udah rapi".

Skill andalannya: `ui-ux-pro-max`, `impeccable`, `taste-design`, dan `antislop-ui` biar bebas desain kaku. 🎨

---

6/11
Pane 3: TUKANG CODER.

Pegang logic utama: data, backend, service, API, dan testing. Prinsipnya blast radius minimal, benerin akar masalah tanpa ngerusak kode lain.

Build dan rilis juga jatahnya coder.

Skill wajibnya: `ponytail`, `minimal-code-discipline`, `antislop-code`, dan `systematic-debugging`. Kode bersih tanpa komentar sampah. 💻

---

7/11
Pane 4: TUKANG SECURITY.

Pake deep-reasoning model (Gemini Argon), dia dipanggil on-demand buat audit auth, secrets, database, dan input validation.

Pegang 7-point OWASP guard dan nggak boleh sentuh kode produksi.

Skill andalan: `principal-appsec-gatekeeper`, `verification-before-completion`, `differential-review`, dan `test-driven-development`. 🛡️

---

8/11
4 aturan baja biar squad ini bisa dipercaya:

1. File allowlist: tukang cuma boleh edit file yang diizinkan di spec.
2. No self-approve: bridge otomatis ngecek diff dan rerun test sebelum approve.
3. Max 1 reject: revisi gagal sekali, Mandor langsung ambil alih.
4. Zero-grep navigation: cari kode pake semantic symbols, tanpa blind scan boros token. 🔒

---

9/11
Squad ini belajar dari kesalahan mirip Hermes Agent.

Tiap kerjaan ditolak Mandor, otomatis kesimpen jadi lesson (`orca-bridge lesson add`). Keluhan user dicatat via `orca-bridge complaint add`. Kalo ada keluhan berulang (`REPEAT xN`), Mandor dipaksa bikin aturan baru.

Contoh nyata: user komplain 3x Mandor ngoding sendiri, squad langsung bikin aturan baru: ada tukang idle wajib didelegasiin! 💡

---

10/11
Yang paling seru: Squad Farm!

Otomatis jalan pas `orca-squad` aktif, buka kantor pixel-art di browser Orca: http://127.0.0.1:24300.

Lo bisa pantau siapa yang lagi ngetik, nunggu review di meeting room, ngopi di pantry, cek token spend, sampai ETA kerjaan. Ngeliat AI lo kerja kayak nonton game simulasi. 🎮

---

11/11
Mau coba squad ini di laptop lo? Cukup 2 perintah:

`git clone https://github.com/annnpiwww/mandordantukangv3 ~/.agents/skills/mandordantukangv3`
`bash ~/.agents/skills/mandordantukangv3/scripts/install.sh --global-rules`

Lalu jalanin:
`orca-squad [project_dir]`

Source code: https://github.com/annnpiwww/mandordantukangv3
Drop tanggapan lo di reply! #AICoding #DevTools