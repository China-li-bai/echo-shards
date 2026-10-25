import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Incremental cache can be added later via R2 (NEXT_INC_CACHE_R2_BUCKET).
});
