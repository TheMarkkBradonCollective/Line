#!/usr/bin/env bash
# Build a debug APK for the LINE Capacitor shell.
# Requires ANDROID_HOME (or ANDROID_SDK_ROOT) and a JDK.
# Does not produce a fake binary if the SDK is missing.
set -euo pipefail

cd "$(dirname "$0")/.."

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$SDK" ]]; then
  echo "error: ANDROID_HOME is not set."
  echo "Install the Android SDK and point ANDROID_HOME at it, then run this again."
  echo "  npm run build:apk"
  echo "The android/ project is already in the repo. Gradle command, once the SDK is present:"
  echo "  cd android && ./gradlew assembleDebug"
  echo "Debug APK path:"
  echo "  android/app/build/outputs/apk/debug/app-debug.apk"
  echo "Optional: bake in the website address before syncing."
  echo "  CAPACITOR_SERVER_URL=http://10.0.2.2:43921 npm run build:apk"
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "error: java is not on PATH. Install a JDK (17 is a safe choice for current Android Gradle)."
  exit 1
fi

printf 'sdk.dir=%s\n' "$SDK" > android/local.properties

if [[ -n "${CAPACITOR_SERVER_URL:-}" ]]; then
  echo "WebView will open ${CAPACITOR_SERVER_URL}"
else
  echo "No CAPACITOR_SERVER_URL set. The APK opens the bundled launcher in www/."
fi

npx cap sync android
(cd android && ./gradlew assembleDebug --no-daemon)

echo "Built android/app/build/outputs/apk/debug/app-debug.apk"
