import cron from "node-cron";
import { runScan } from "./lib/scanner";

const cronExpr = process.env.SCAN_CRON ?? "*/10 * * * *";

async function boot() {
  console.log(`[worker] starting with cron: ${cronExpr}`);

  cron.schedule(cronExpr, async () => {
    try {
      const result = await runScan();
      console.log("[worker] scan result", result);
    } catch (error) {
      console.error("[worker] scan failed", error);
    }
  });
}

void boot();
