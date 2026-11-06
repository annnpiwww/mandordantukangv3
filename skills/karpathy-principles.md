# 4 Karpathy Principles for AI Coding Agents

1. **Think Before Coding & Push Back**:
   - Pahami alur masalah secara mendalam sebelum menyentuh file.
   - Jangan berasumsi. Jika user meminta fitur dengan cara yang berbelit atau boros token, wajib tawarkan solusi yang jauh lebih simpel.

2. **Simplicity First**:
   - Tulis solusi paling minimal dan to-the-point.
   - Tolak over-engineering, abstraksi premature, atau percabangan spekulatif.

3. **Surgical Blast Radius & Clean Own Mess**:
   - Sentuh HANYA baris dan file yang relevan dengan tugas.
   - Jangan refactor file orang lain tanpa izin.
   - Bersihkan file temporary atau dead code buatan sendiri sebelum submit.

4. **Strict Verification**:
   - Dilarang membuat klaim "DONE" tanpa bukti konkret (test hijau, log bersih, build lolos).
   - Format rencana: `[Langkah] -> Verifikasi: [Perintah Cek]`.
