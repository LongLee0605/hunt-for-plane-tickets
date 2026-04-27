import "dotenv/config";
import cors from "cors";
import express from "express";
import { listDeals, listLatestMatchedDeals, listRules, upsertRule, deleteRule } from "../lib/db";
import { createRuleSchema } from "../lib/schema";
import { runScan } from "../lib/scanner";
import { createId, nowIso } from "../lib/utils";

const app = express();
const PORT = Number(process.env.PORT ?? 8787);

app.use(cors());
app.use(express.json());

app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    providers: { travelpayouts: Boolean(process.env.TRAVELPAYOUTS_TOKEN) },
    notifications: {
      gmailConfigured: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
      recipientConfigured: Boolean(process.env.NOTIFY_TO_EMAIL),
    },
  });
});

app.get("/api/rules", async (_req, res) => {
  res.json({ rules: await listRules() });
});

app.post("/api/rules", async (req, res) => {
  const parsed = createRuleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid rule payload", details: parsed.error.flatten() });

  const data = parsed.data;
  const now = nowIso();
  const rule = await upsertRule({
    id: createId(`${data.title}-${data.departureCode}-${data.arrivalCode}-${data.dateFrom}-${data.dateTo}`),
    title: data.title,
    active: data.active,
    departureCode: data.departureCode,
    arrivalCode: data.arrivalCode,
    maxPrice: data.maxPrice,
    dateFrom: data.dateFrom,
    dateTo: data.dateTo,
    airlines: data.airlines,
    createdAt: now,
    updatedAt: now,
  });
  return res.status(201).json({ rule });
});

app.delete("/api/rules", async (req, res) => {
  const id = String(req.query.id ?? "");
  if (!id) return res.status(400).json({ error: "Missing rule id" });
  const removed = await deleteRule(id);
  if (!removed) return res.status(404).json({ error: "Rule not found" });
  return res.json({ ok: true });
});

app.get("/api/deals", async (req, res) => {
  const scope = String(req.query.scope ?? "");
  const deals = scope === "latest" ? await listLatestMatchedDeals() : await listDeals();
  return res.json({ deals });
});

app.post("/api/scan", async (_req, res) => {
  const result = await runScan();
  return res.json({ result });
});

app.post("/api/scan/cron", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: "CRON_SECRET is not configured" });
  if (req.header("authorization") !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  const result = await runScan();
  return res.json({ result });
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
