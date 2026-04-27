import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import { listDeals, listLatestMatchedDeals, listRules, upsertRule, deleteRule } from "../lib/db";
import { listDealsMatchingActiveRules } from "../lib/matchingDeals";
import { createRuleSchema } from "../lib/schema";
import { runScan } from "../lib/scanner";
import { createId, nowIso } from "../lib/utils";

const app = express();
const PORT = Number(process.env.PORT ?? 8787);

// Prefer local developer config, then fall back to default .env.
dotenv.config({ path: ".env.local" });
dotenv.config();

app.use(cors());
app.use(express.json());

const asyncHandler =
  (fn: express.RequestHandler): express.RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/** Trình duyệt mở `http://localhost:8787/` không có trang HTML — chỉ có REST API. */
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "hunt-for-plane-tickets-api",
    message: "Đây là API backend. Giao diện web chạy qua Vite (thường http://localhost:5173).",
    endpoints: {
      "GET /api/status": "Cấu hình token / Gmail",
      "GET /api/rules": "Danh sách bộ lọc",
      "POST /api/rules": "Tạo bộ lọc (JSON body)",
      "DELETE /api/rules?id=": "Xóa bộ lọc",
      "GET /api/deals": "Deals (query: scope=matching | latest | mặc định)",
      "POST /api/scan": "Chạy quét (POST, không phải GET)",
      "POST /api/scan/cron": "Cron (Bearer CRON_SECRET)",
    },
  });
});

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

app.get("/api/rules", asyncHandler(async (_req, res) => {
  res.json({ rules: await listRules() });
}));

app.post("/api/rules", asyncHandler(async (req, res) => {
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
}));

app.delete("/api/rules", asyncHandler(async (req, res) => {
  const id = String(req.query.id ?? "");
  if (!id) return res.status(400).json({ error: "Missing rule id" });
  const removed = await deleteRule(id);
  if (!removed) return res.status(404).json({ error: "Rule not found" });
  return res.json({ ok: true });
}));

app.get("/api/deals", asyncHandler(async (req, res) => {
  const scope = String(req.query.scope ?? "");
  let deals;
  if (scope === "latest") deals = await listLatestMatchedDeals();
  else if (scope === "matching") deals = await listDealsMatchingActiveRules();
  else deals = await listDeals();
  return res.json({ deals });
}));

app.post("/api/scan", asyncHandler(async (_req, res) => {
  const result = await runScan();
  return res.json({ result });
}));

app.post("/api/scan/cron", asyncHandler(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: "CRON_SECRET is not configured" });
  if (req.header("authorization") !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  const result = await runScan();
  return res.json({ result });
}));

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    method: req.method,
    path: req.path,
    hint:
      req.method === "GET" && req.path === "/api/scan"
        ? "Dùng POST /api/scan, không phải GET."
        : req.path.startsWith("/api")
          ? "Kiểm tra đường dẫn và method (GET vs POST)."
          : "API chỉ phục vụ dưới /api/*. Mở GET / hoặc GET /api/status để kiểm tra.",
  });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Internal Server Error";
  console.error(error);
  res.status(500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
