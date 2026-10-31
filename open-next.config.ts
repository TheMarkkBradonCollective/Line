import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache: every LINE page is per-user and dynamic.
export default defineCloudflareConfig({});
