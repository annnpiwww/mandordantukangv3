# Comprehensive UI/UX Design System & Motion Specification

Dokumen ini adalah acuan terpusat (*Single Source of Truth*) untuk **AI Agent**, **UI/UX Designer**, dan **Frontend/Mobile Engineer**. Dokumen ini menggabungkan fondasi filosofis UI vs UX, variasi arsitektur tema antarmuka (SaaS/Dashboard, Fintech Neomorphic, Playful EdTech), katalog lengkap mikro-animasi fisika (*playful motion*), serta instruksi prompting implementasi AI agent.

---

## 1. Core Paradigm: UI vs UX Framework

Penting bagi AI Agent untuk membedakan antara kebutuhan visual (UI) dan alur fungsional (UX):

| Dimensi | User Interface (UI) - "Look & Feel" | User Experience (UX) - "Experience & Flow" |
|---|---|---|
| **Definisi** | Komponen visual permukaan yang dilihat pengguna (*Visual presentation layer*). | Perasaan, kemudahan, dan efisiensi saat menyelesaikan tugas (*Usability & functional layer*). |
| **Fokus Utama** | • Palet warna & kontras<br>• Tipografi & hirarki teks<br>• Bentuk tombol, ikonografi, & radius sudut<br>• Layout grid, alignment, & whitespace | • Kemudahan navigasi (*Wayfinding*)<br>• Kecepatan menemukan kebutuhan (*Time-to-task*)<br>• Penyelesaian masalah tanpa gesekan (*Frictionless goal solving*)<br>• Alur yang mulus & memuaskan (*Smooth step-by-step flow*) |
| **Evaluasi** | "Apakah antarmuka ini estetis, harmonis, konsisten, dan modern?" | "Apakah aplikasi ini mudah digunakan, intuitif, dan hemat waktu?" |

---

## 2. Multi-Theme Design Tokens & Layout Presets

AI Agent wajib menggunakan token spesifik sesuai tipe produk:

### Preset A: Productivity & SaaS Dashboard (Clean Minimal vs Dark Glass)
* **Light Theme ("Flowly"):**
  * Base Background: Warm Clean Off-White `#F8FAF9` / `#F3F4F6`
  * Card Surfaces: Pure White `#FFFFFF` dengan bayangan lembut `0 2px 8px rgba(0, 0, 0, 0.04)` dan radius rounded `16px - 20px`
  * Primary Accent: Sage / Forest Green `#10B981` / `#059669`
  * Status Badges: Lavender/Purple (`#A78BFA`), Amber/Gold (`#F59E0B`), Coral/Rose (`#F43F5E`)
  * Layout: Sidebar ramping kiri, Top greeting + Search pill, Grid widget metrik, Chart garis area hijau lembut, Task list berbadge warna.
* **Dark Theme ("Nexora"):**
  * Base Background: Deep Obsidian Charcoal `#0A0E13`
  * Card Surfaces: Frosted Elevasi `#121720` dengan garis tepi halus `border: 1px solid rgba(255, 255, 255, 0.06)`
  * Accent & Visual Punch: Emerald Green Neon Glow (`#10B981` / `#34D399`)
  * Data Visualization: Bar chart vertikal bertingkat dengan gradient glow.

### Preset B: Neomorphic & Fluid Fintech Mobile ("Cashly")
* **Base Background:** Soft Lavender Tint `#F5F3FF` ke Pure White `#FFFFFF`
* **Hero Element:** Curved Wallet Card dengan gradien ungu neon elektrik (`#7C3AED` $\rightarrow$ `#A855F7`) dengan drop pin bulat di tengah bawah.
* **Keypad & Inputs:** Floating soft-shadow number pad (`0-9`), large monetary display (`₹ / $`), dan slider limit transfer interaktif (`range slider`).
* **Micro-details:** Tombol Quick Send bundar horizontal dengan border avatar bersinar tipis.

### Preset C: Playful & Warm EdTech ("Thinkeo")
* **Target Audience:** Anak-anak, keluarga, edukasi ramah dan menyenangkan.
* **Palette:** Warm Butter Cream `#FFFDF5`, Pastel Lilac `#DDD6FE`, Soft Peach/Coral `#FED7AA`, Mint `#A7F3D0`, Bubblegum Pink `#FBCFE8`.
* **Geometry:** Sudut sangat melengkung (*Hyper-rounded* `24px - 32px`), bubble pill buttons, maskot 3D ramah, dan tipografi sans-serif membulat (misal: *Quicksand* / *Nunito*).
* **Gamification:** Streak counter api (`🔥 5-day streak`), kartu kategori grid 2x2 berwarna cerah, dan badge reward bintang (*Badges pop*).

---

## 3. Master Micro-Interactions & Motion Catalog

Semua interaksi menggunakan prinsip fisika: **Spring Physics** (stiffness: ~300-400, damping: ~20-28), squash & stretch, ink filling, dan stagger.

```
                      MOTION CATALOG MATRIX
  ┌──────────────────────────────────────────────────────────┐
  │ 1. Navigation & Bars   │ 4. Menus & Drawers (Part 1 & 2) │
  │ 2. Swipe Gestures      │ 5. Notifications & Toasts       │
  │ 3. Checkbox & Radio    │ 6. Like & Feedback (Part 2)     │
  │                        │ 7. Pull to Refresh (Part 1)     │
  └──────────────────────────────────────────────────────────┘
```

---

### Category 1: Like, Reaction & Favorite Micro-Interactions (Part 2)

| # | Pattern Name | Interaction Behavior & Physics | Trigger / State |
|---|---|---|---|
| **L1** | **Jelly Squish** | Tekanan jari membuat ikon hati memipih horizontal (*squashes*); saat dilepas, hati terisi warna gradien pink/violet dan bergoyang lentur seperti jeli (*jiggles like jelly*). | Heart Press & Release |
| **L2** | **Star Favorite** | Ketukan memutar bintang 360° (*single spin*), terisi warna transisi emas-ke-pink (*gold $\rightarrow$ pink*), disusul partikel kilau (*sparkles twinkle*) di sekitarnya. | Favorite Tap |
| **L3** | **Bookmark Save** | Pita bookmark meregang vertikal ke bawah (*stretches*), terisi warna gradien violet $\rightarrow$ cyan, dan toast pill mungil "Saved to collection" muncul membal di bawahnya. | Bookmark Tap |
| **L4** | **Reaction Picker** | Tahan ikon Like: Baris emotikon reaksi melayang muncul (*pop up*). Geser jari ke salah satu reaksi; saat dipilih, reaksi tersebut melesat masuk ke tombol (*flies into button*). | Long-press & Slide |
| **L5** | **Like Pill** | Sentuhan memicu gelombang gradien memancar (*spreads from touch position*); label teks berubah bentuk secara mulus (*morphs*) dari "Like" menjadi "Liked". | Pill Button Tap |
| **L6** | **Heartbeat** | Ikon hati berdetak cepat dua kali (*double beat*), memancarkan gelombang sonar melingkar (*heart waves*), disertai lonjakan grafik garis denyut nadi (*pulse line spikes*). | Tap / Double Tap |

---

### Category 2: Pull to Refresh Dynamics (Part 1)

| # | Pattern Name | Interaction Behavior & Physics | Trigger / State |
|---|---|---|---|
| **R1** | **Spoke Reveal** | Tarikan layar memunculkan 12 jari-jari melingkar (*spokes*) satu demi satu searah jarum jam secara proporsional dengan tarikan; lalu berputar penuh saat data diperbarui. | Continuous Pull Down |
| **R2** | **Material Arc** | Piringan putih (*white disc*) meluncur turun, busur kurva lingkaran dan panah di dalamnya bertambah panjang (*arc grows*), lalu mulai berputar. | Elastic Pull Down |
| **R3** | **Arrow Flip** | Panah menunjuk ke bawah ("Pull to refresh"); begitu mencapai batas ambang batas (*threshold limit*), panah membalik ke atas ("Release"), berubah menjadi spinner, lalu teks "Updated". | Threshold Crossing |
| **R4** | **Goo Drop** | Tetesan cairan elastis (*gooey drop*) memanjang dari header saat ditarik, menjepret kembali (*snaps back*), dan berputar menjadi spinner pemuat data. | Over-drag & Release |
| **R5** | **Bouncing Dots** | Tiga titik cahaya saling mendekat dan menyatu saat ditarik (*slide together*), lalu melompat berirama gelombang (*bounce in a wave*) selama loading berlangsung. | Threshold Release |
| **R6** | **Elastic Header** | Tepi atas daftar membengkok elastis mengikuti jari seperti jeli (*bends like jelly under finger*), lalu membal bergoyang kembali (*wobbles back*) ke bentuk datar saat dilepas. | Direct Touch Drag |

---

### Category 3: Tab Bar & Navigation Switching (Part 2)

| # | Pattern Name | Interaction Behavior & Animation Specs | Trigger / State |
|---|---|---|---|
| **T1** | **Worm Underline** | Garis indikator aktif memanjang elastis seperti cacing (*worm stretch*) menyambungkan tab aktif ke tab baru, sementara layar konten bergeser. | Tab Change |
| **T2** | **Hopping Dot** | Titik bercahaya melompat dalam busur parabola (*hops in an arc*) ke tab yang dituju dan sedikit gepeng (*squishes*) saat mendarat. | Tab Select |
| **T3** | **Spotlight** | Sorot cahaya kerucut (*conical glow*) bergeser mulus melintasi bar sambil sedikit mengayun (*swings*), menerangi ikon terpilih. | Tab Select |
| **T4** | **Ripple Fill** | Ripple gradien violet-ke-cyan memancar dari titik tengah mengisi pill background tab; indikator lama memudar. | Tap Event |
| **T5** | **Jelly Icon** | Ikon membal gepeng (*squashes*), melompat (*jumps*), dan bergoyang seperti jeli (*wobbles*) saat statusnya aktif. | Icon Tap |
| **T6** | **Badge Pop** | Membuka tab membuat badge angka meledak menjadi partikel dot kecil (*burst into dots*), dan kembali utuh saat tab ditinggalkan. | Focus In / Out |

---

### Category 4: Swipe Actions (Lists & Chat Items)

| # | Pattern Name | Interaction Behavior & Animation Specs | Trigger / State |
|---|---|---|---|
| **S1** | **Swipe to Delete** | Latar merah meluncur masuk, ikon tempat sampah meloncat (*pops*) saat melewati garis batas, baris melayang terlempar (*flies off*). | Left Swipe Threshold |
| **S2** | **Reveal Actions** | Geser kiri membuka deretan tombol aksi (Archive, Flag, More). Mengetuk salah satu tombol menutup kembali baris dengan sentakan cepat (*snaps shut*). | Drag to Reveal |
| **S3** | **Swipe to Archive** | Geser kanan: Melewati batas ambang membuat ikon arsip membal (*pops*) dan latar belakang abu-abu berubah menjadi hijau mint (*gray $\rightarrow$ mint*). | Right Swipe $\ge 40\%$ |
| **S4** | **Mark as Read** | Geseran pendek ke kanan menandai pesan terbaca; baris membal pulang (*springs back*) dan titik penanda biru/merah memudar. | Short Right Swipe |
| **S5** | **Multi-Stage** | Geser berlanjut ke kiri: Jarak pertama menampilkan opsi "Later" (Gold); tarikan lebih jauh mengubahnya menjadi "Delete" (Pink/Red). | Continuous 2-Phase Drag |
| **S6** | **Swipe to Reply** | Tarik gelembung obrolan ke kanan: Ikon panah balas muncul membal, dan kartu kutipan pesan meluncur masuk di atas kolom input teks. | Message Drag Right |

---

### Category 5: Checkbox, Radio, and Selection (Part 1)

| # | Pattern Name | Interaction Behavior & Animation Specs | Trigger / State |
|---|---|---|---|
| **C1** | **Circle to Check** | Garis lingkaran terurai (*unwinds*) dan mengalir mulus berubah bentuk menjadi tanda centang ($\checkmark$). Teks meredup ke abu-abu. | Toggle Check |
| **C2** | **Strike & Sink** | Checkbox terisi warna, garis mencoret teks (*strikethrough*), lalu seluruh baris tugas tenggelam (*sinks*) ke bagian bawah daftar. | Task Done |
| **C3** | **Select All** | Menekan induk memicu centang beruntun bertingkat (*staggered waterfall*) pada anak-anak daftar; indikator induk berubah dari dash $(-)$ ke centang $(\checkmark)$. | Master Toggle |
| **C4** | **Radio Slide** | Titik seleksi radio meregang elastis menyerupai gel/cairan (*stretches like goo*) saat berpindah dari satu opsi ke opsi berikutnya. | Radio Change |
| **C5** | **Card Select** | Kartu mengecil sejenak (*press scale*), badge centang meloncat muncul di sudut, dan border bercahaya gradien mengitari kartu. | Card Tap |
| **C6** | **Ink Fill** | Efek air/tinta naik dengan permukaan bergelombang (*wavy liquid top*) mengisi kotak, disusul gambar garis centang putih ($\checkmark$). | Box Tap |

---

### Category 6: Menus & Navigation Overlays (Part 1 & 2)

| # | Pattern Name | Interaction Behavior & Visual Mechanics |
|---|---|---|
| **M1** | **Hamburger Morph** | Tiga garis horizontal merapat ke tengah lalu berputar 45° membentuk tanda silang ($\times$), tombol terisi gradien violet $\rightarrow$ cyan. |
| **M2** | **Side Drawer** | Drawer masuk dari kiri dengan efek pegas (*spring entrance*), latar belakang meredup, baris menu masuk berurutan (*staggered*). |
| **M3** | **FAB Fan** | Ikon $(+)$ berputar menjadi $(\times)$ sementara 5 tombol tindakan meluncur membusur membentuk kipas (*fans out on an arc*). |
| **M4** | **Bottom Sheet** | Modal sheet meluncur naik dari tepi bawah layar, ikon di dalamnya membal muncul satu per satu (*pop in*). |
| **M5** | **Staggered Dropdown** | Chevron berputar balik, kartu dropdown membuka ke bawah (*unfolds down*), item meluncur masuk berurutan. |
| **M6** | **Circle Reveal** | Lingkaran klip (*clip-path circle*) membesar dari tombol menu hingga menutupi layar penuh, tautan besar memudar masuk. |
| **M7** | **Push Back** | Halaman utama menyusut ke dalam perspektif 3D (*scales back*) dan bergeser ke kanan, mengungkap menu di baliknya. |
| **M8** | **Kebab Popover** | Tiga titik menu terbang keluar (*fly out*) membesar menjadi ikon-ikon aksi individual popover. |
| **M9** | **Gooey Menu** | Tombol aksi memisahkan diri seperti tetesan cairan dari tombol induk (*gooey split*), lalu menyatu kembali saat ditutup. |
| **M10** | **Fold Down** | Baris kategori terbentang ke bawah satu demi satu seperti lipatan kertas (*folds down like paper*), mendorong konten bawahnya. |
| **M11** | **Button to Panel** | Tombol kapsul `+ New` membesar dan bertransformasi (*morphs*) menjadi panel kartu formulir lengkap. |
| **M12** | **Command Palette** | Search modal jatuh dari atas (*drops in*), teks simulasi mengetik sendiri, dan hasil pencarian tersaji dengan stagger. |

---

### Category 7: Notifications & Alerts (Part 2)

| # | Pattern Name | Interaction Behavior & Visual Mechanics |
|---|---|---|
| **N1** | **Gooey Drop** | Tetesan cairan jatuh dari sisi atas layar, lalu meleleh dan melebar (*melts and spreads*) membentuk kartu toast. |
| **N2** | **Flip Down** | Notifikasi berayun turun dari sisi atas dalam orientasi 3D menyerupai papan gantung toko (*swings like a hanging sign*). |
| **N3** | **Fly to Inbox** | Notifikasi mengempis menjadi partikel titik lalu terhisap melengkung (*sucked along an arc*) menuju ikon Inbox. |
| **N4** | **Snackbar Push** | Snackbar meluncur naik dan secara fisik membentur/mendorong tombol FAB bulat ke atas dengan efek pantul. |
| **N5** | **Chat Head** | Avatar bundar memantul masuk dari tepi layar, menampilkan bubble tiga titik mengetik (`...`), lalu berubah menjadi teks sapaan. |
| **N6** | **Merge Counter** | Tiga notifikasi identik yang datang berturut-turut saling menumpuk dan melebur (*merge*) menjadi satu kartu bertanda `×3`. |

---

## 4. AI Agent Prompting Rules & Toolchain Integration

Panduan instruksi ketika AI Coding Agent (Cursor, Claude Code, Gemini CLI, Copilot) mengonversi desain ini ke kode:

### 4.1 Ingestion Prompt Template (Godly Style)
Jika pengguna memberikan tangkapan layar desain web/app untuk direplikasi strukturnya, instruksikan AI Agent dengan aturan:
```text
"Tiru layout hierarchy, spacing (padding/margin), ukuran font, radius sudut, dan palet aksen dari screenshot referensi ini untuk halaman [NAMA HALAMAN]. JANGAN tiru logo, teks mentah, nama brand, atau gambar aslinya."
```

### 4.2 Motion Toolchain & Motion Skill Command
Untuk mempercepat animasi berbasis CSS/Framer Motion, agen dapat memanfaatkan pustaka gerak transisi siap pakai:
```bash
# Integrasikan preset transisi micro-interaction ke dalam project CLI
npx skills add Jakubantalik/transitions.dev
```

### 4.3 Motion Directives untuk AI Agent
1. **Dilarang Menggunakan Animasi Linear:** Semua transisi mikro wajib menggunakan fungsi kurva pegas (*spring*) atau `cubic-bezier(0.34, 1.56, 0.64, 1)`.
2. **Implementasi Efek Gooey / Cairan:** Wajib menyertakan SVG Filter global di DOM root:
   ```html
   <svg style="position: absolute; width: 0; height: 0;" aria-hidden="true">
     <filter id="goo">
       <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
       <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
       <feComposite in="SourceGraphic" in2="goo" operator="atop" />
     </filter>
   </svg>
   ```
3. **Optimasi Aksesibilitas:** Selalu bungkus animasi dengan pengecekan media query:
   ```css
   @media (prefers-reduced-motion: reduce) {
     * {
       animation-duration: 0.01ms !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```