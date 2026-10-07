import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The debug APK is a shell around LINE.
 * Set CAPACITOR_SERVER_URL to a running Next.js server before `npm run build:apk`
 * and the WebView opens that server directly.
 * Example (emulator reaching the host machine):
 *   CAPACITOR_SERVER_URL=http://10.0.2.2:43921 npm run build:apk
 * Without that variable, the APK shows the bundled launcher in www/.
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: "social.line.share",
  appName: "LINE",
  webDir: "www",
  backgroundColor: "#ffffff",
  android: {
    allowMixedContent: true,
    backgroundColor: "#ffffff",
  },
  server: serverUrl
    ? { url: serverUrl, cleartext: true }
    : { androidScheme: "https" },
};

export default config;
