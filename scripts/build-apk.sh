#!/usr/bin/env bash
# Build the LINE Android APK (Capacitor shell that opens the live site).
# Requires ANDROID_HOME and a JDK 21.
#   CAPACITOR_SERVER_URL=https://line-line-a767.vercel.app \
#   LINE_KEYSTORE_PROPERTIES=/path/outside/repo/keystore.properties npm run build:apk
# With LINE_KEYSTORE_PROPERTIES set, builds a signed release APK; otherwise a debug APK.
set -euo pipefail
cd "$(dirname "$0")/.."

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
[[ -z "$SDK" ]] && { echo "error: set ANDROID_HOME to the Android SDK."; exit 1; }
command -v java >/dev/null || { echo "error: java not on PATH (JDK 21)."; exit 1; }
printf 'sdk.dir=%s\n' "$SDK" > android/local.properties

if [[ -n "${CAPACITOR_SERVER_URL:-}" ]]; then echo "WebView will open ${CAPACITOR_SERVER_URL}"; else echo "No CAPACITOR_SERVER_URL: APK opens the bundled launcher in www/."; fi
npx cap sync android

if [[ -n "${LINE_KEYSTORE_PROPERTIES:-}" ]]; then
  (cd android && ./gradlew assembleRelease --no-daemon)
  echo "Built android/app/build/outputs/apk/release/app-release.apk"
else
  (cd android && ./gradlew assembleDebug --no-daemon)
  echo "Built android/app/build/outputs/apk/debug/app-debug.apk"
fi
