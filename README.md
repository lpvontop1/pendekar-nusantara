# Pendekar Nusantara

Platformer 2D prosedural bertema kepulauan Nusantara, dibangun dengan HTML/CSS/JS
di dalam WebView fullscreen Kotlin untuk **Android 9 (API 28) ke atas**.

## Fitur

- **Prosedural tanpa batas** — setiap petak dibuat dari seed deterministik
  (`mulberry32`), route dijamin tidak tumpang tindih dan selalu bisa dimainkan
  (divalidasi BFS reachability + aturan jarak lompatan fisika).
- **Level select tak terbatas** — grid per halaman 20 petak, hanya halaman aktif
  yang dirender, petak terkunci bertanda gembok.
- **Boss tiap 25 petak** — Rangda (kipas masker, summon leyak, dash), Kala Rau
  (slam gelombang, hujan orb, terjangan), Naga Besuki (melata, semburan api,
  sapu ekor). Gerbang keluar terkunci sampai boss tumbang.
- **Musuh folklore** — Buta Ijo (patroli/kejar), Kuntilanak (melayang menerkam),
  Tuyul (mencuri koin!), Banaspati (pelempar bola api), plus leyak summon.
- **Rintangan mematikan** — lava, rawa beracun, ranjau bambu, jurang; checkpoint
  candi dupa; portal esoteris di akhir petak dengan kompas penunjuk arah.
- **Ekonomi & toko** — koin, warung di tiap petak: Jamu (heal), Kopi Tubruk
  (stamina 2x 30 dtk), Roh Kelapa (stamina maks 2x permanen), Bulu Rajawali
  (lompat +12%), Sandal Angin (lari +25%), Jantung Waja (+1 nyawa).
- **Kontrol mobile** — dudi kiri/kanan + lompat + dash (multi-pointer, tepat di
  zona ibu jari), dukungan keyboard untuk pengujian desktop.
- **Audio sintesis** — gamelan laras slendro via WebAudio + SFX, tanpa file audio.
- **Offline penuh** — tanpa izin internet, semua aset dibundel.

## Struktur

```
app/src/main/
  java/com/lpvontop/pendekar/MainActivity.kt   # WebView fullscreen (immersive sticky)
  AndroidManifest.xml                          # landscape, tanpa izin
  res/                                         # tema, ikon
  assets/www/                                  # GAME (HTML/CSS/JS)
    index.html
    css/style.css
    js/  config util save audio input gen entities world game ui main
    assets/img/  sprite-sheet & tile (pixel art 32px, meta.js)
    assets/fonts/ Press Start 2P, VT323 (SIL OFL)
```

## Cara Build APK

**Android Studio (paling mudah)**
1. Buka folder proyek ini di Android Studio (Hedgehog/IGuana+).
2. Tunggu Gradle sync (butuh internet pertama kali untuk dependensi).
3. `Build > Build Bundle(s)/APK(s) > Build APK(s)`.

**Command line**
```bash
./gradlew assembleDebug     # hasil: app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease   # butuh signing config untuk distribusi
```

**Build manual (tanpa Gradle) — cara rilis v1.0.0 dibuat**

Skrip `scripts/build_apk.sh` memakai aapt2 + kotlinc 1.9.24 + d8 + zipalign +
apksigner (build-tools r34). APK yang dihasilkan sudah **ditandatangani** dengan
`release.keystore` (alias `pendekar`, password `pendekar2026` — keystore rilis
open-source, ganti untuk kebutuhan produksi).

```bash
# prasyarat: unduh & ekstrak ke work/sdk/
#   - platform-34-ext7_r02.zip  (dl.google.com/android/repository)
#   - build-tools_r34-linux.zip (dl.google.com/android/repository)
#   - kotlin-compiler-1.9.24.zip (github.com/JetBrains/kotlin/releases)
bash scripts/build_apk.sh
# hasil: work/apk-build/PendekarNusantara-v1.0.0.apk (±2.7 MB, signed, terverifikasi)
```

## QA / Pengujian (rilis v1.0.0)

- **Validasi generator** (`scripts/qa_validate.mjs`): 200 level dicek — 0 overlap,
  semua platform & portal terjangkau (BFS), checkpoint & musuh di permukaan. LULUS.
- **Blackbox auto-play** (`scripts/qa_bot_stress.mjs`): bot memainkan fisika asli
  107 level (rute + boss, maks 3 percobaan, progres toko disimulasikan):
  **96/107 menang (90%)**; semua 9 boss level yang diuji (L25–L300) menang.
  11 sisanya = titik macet spesifik bot (bukan ketidakterjangkauan — sudah
  ditutup validator BFS + uji input manusia di browser).
- **E2E browser** (`scripts/qa_browser.mjs`, `qa_combat2.mjs`, `qa_bosshit2.mjs`):
  menu, lock level, tombol sentuh, warung, stomp/dash, tiga boss + pola serangannya,
  mati/respawn checkpoint, portal kemenangan, paginasi — LULUS, **0 error console**.
- **Stress** : logika game berjalan **475x realtime** (12.000 tick + 94 musuh +
  500 partikel), heap stabil (+1,8 MB setelah 100.000 tick ± 28 menit gameplay),
  tanpa kebocoran.
- **APK**: dibangun, `zipalign`, ditandatangani (apksigner, RSA 2048, sertifikat
  SHA-256 `bb97a83d…`), diverifikasi `apksigner verify`.


## Menjalankan versi web saja (untuk pengembangan)

Buka `app/src/main/assets/www/index.html` langsung di browser, atau:
```bash
cd app/src/main/assets/www && python3 -m http.server 8080
```
Kontrol keyboard: `←/→` lari, `Space/W` lompat, `Shift/K` dash.

## Catatan teknis

- Engine: canvas 2D 480x270 (upscale pixelated), fisika langkah tetap 60 Hz,
  coyote-time + jump-buffer + variabel tinggi lompatan.
- Generator: platform selalu maju sehingga overlap mustahil; celah dibatasi
  aturan aman (datar ≤2 tile, naik ≤2 tile dengan celah ≤1, turun ≤3 tile).
- Progres disimpan di `localStorage` (DOM storage WebView).

## Lisensi

- Kode: MIT
- Aset gambar: dibuat dengan generator AI khusus untuk proyek ini
- Font: Press Start 2P & VT323 — SIL Open Font License
