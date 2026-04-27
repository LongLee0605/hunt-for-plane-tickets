export interface Env {
  APP_BASE_URL: string;
  CRON_SECRET: string;
}

async function triggerScan(env: Env) {
  const endpoint = `${env.APP_BASE_URL.replace(/\/$/, "")}/api/scan/cron`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Scan trigger failed (${response.status}): ${body}`);
  }
}

const worker = {
  async scheduled(_event: unknown, env: Env): Promise<void> {
    await triggerScan(env);
  },
};

export default worker;
