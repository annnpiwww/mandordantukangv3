# Anti-AI-Slop Code & UI Filter

Filter wajib untuk menghentikan output AI generik:
1. **No Comment Slop**: Hapus komentar generik yang hanya menceritakan ulang kode (`// update user state`, `// return result`). Simpan komentar yang menjelaskan *alasan* (WHY) dan trik non-obvious.
2. **No UI Slop**: Tolak template warna biru-ungu standar AI, spacing yang berantakan, atau tombol tanpa interaksi mikro yang jelas. Gunakan warna beralasan dan konsisten.
3. **No Dead Code**: Jangan tinggalkan blok kode dummy atau helper fungsi sekali pakai yang tidak ada pemanggilnya.
