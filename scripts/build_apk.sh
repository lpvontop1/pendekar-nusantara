#!/bin/bash
# ============================================================
# Build APK Pendekar Nusantara — tanpa Gradle.
# Toolchain: aapt2 + kotlinc + d8 + zipalign + apksigner (build-tools r34)
# Hasil: APK release TANDA TANGAN (signed) siap pasang / rilis.
# Pemakaian:  bash scripts/build_apk.sh
# ============================================================
set -euo pipefail

SDK=${SDK:-/home/z/my-project/work/sdk}
BT=$SDK/android-14                 # build-tools r34 (diekstrak)
PLATFORM=$SDK/android-34/android.jar
KOTLINC=$SDK/kotlinc/bin/kotlinc
PROJ=${PROJ:-/home/z/my-project/nusantara-platformer}
SRC=$PROJ/app/src/main
OUT=${OUT:-/home/z/my-project/work/apk-build}
KS=$PROJ/release.keystore
KS_PASS=${KS_PASS:-pendekar2026}
VER_CODE=1
VER_NAME=1.0.0
APP_NAME="PendekarNusantara"

mkdir -p "$OUT"

echo "[1/7] aapt2 compile resource"
"$BT/aapt2" compile --dir "$SRC/res" -o "$OUT/res.zip"

echo "[2/7] aapt2 link (manifest + resource + asset www)"
"$BT/aapt2" link -o "$OUT/base.apk" \
  -I "$PLATFORM" \
  --manifest "$SRC/AndroidManifest.xml" \
  -R "$OUT/res.zip" \
  --auto-add-overlay \
  -A "$SRC/assets" \
  --min-sdk-version 28 --target-sdk-version 34 \
  --version-code "$VER_CODE" --version-name "$VER_NAME"

echo "[3/7] kotlinc (MainActivity -> app.jar, stdlib ikut)"
rm -rf "$OUT/classes" && mkdir -p "$OUT/classes"
"$KOTLINC" -jvm-target 17 -classpath "$PLATFORM" -include-runtime \
  -d "$OUT/classes/app.jar" \
  "$SRC/java/com/lpvontop/pendekar/MainActivity.kt" 2>&1 | grep -v "^warning:" || true

echo "[4/7] d8 dex"
rm -rf "$OUT/dex" && mkdir -p "$OUT/dex"
java -cp "$BT/lib/d8.jar" com.android.tools.r8.D8 \
  --release --lib "$PLATFORM" --min-api 28 \
  --output "$OUT/dex" "$OUT/classes/app.jar"

echo "[5/7] sisipkan classes.dex + zipalign"
(cd "$OUT/dex" && zip -qj "$OUT/base.apk" classes.dex)
"$BT/zipalign" -f 4 "$OUT/base.apk" "$OUT/aligned.apk"

echo "[6/7] keystore & sign"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -v -keystore "$KS" -alias pendekar -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=Pendekar Nusantara, OU=Game, O=lpvontop, L=Nusantara, C=ID"
fi
"$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$KS_PASS" --ks-key-alias pendekar \
  --out "$OUT/${APP_NAME}-v${VER_NAME}.apk" "$OUT/aligned.apk"

echo "[7/7] verifikasi"
"$BT/apksigner" verify --print-certs "$OUT/${APP_NAME}-v${VER_NAME}.apk" | head -6
ls -la "$OUT/${APP_NAME}-v${VER_NAME}.apk"
echo "SELESAI: $OUT/${APP_NAME}-v${VER_NAME}.apk"
