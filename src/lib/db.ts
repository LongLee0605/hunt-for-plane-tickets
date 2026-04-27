import type { AlertRule, Airline, FlightDeal, NotificationLog, ScanState } from "./types";

type D1QueryResult<T = Record<string, unknown>> = {
  results?: T[];
  success?: boolean;
  error?: string;
};

type D1ApiResponse<T = Record<string, unknown>> = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: Array<D1QueryResult<T>>;
};

let initPromise: Promise<void> | null = null;

function env(name: string) {
  return process.env[name] ?? "";
}

function getD1Config() {
  const accountId = env("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = env("CLOUDFLARE_API_TOKEN");
  const databaseId = env("CLOUDFLARE_D1_DATABASE_ID") || env("D1_DATABASE_ID");

  if (!accountId || !apiToken || !databaseId) {
    throw new Error(
      "Missing D1 config. Please set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_D1_DATABASE_ID.",
    );
  }

  return { accountId, apiToken, databaseId };
}

function sqlValue(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function d1Query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const { accountId, apiToken, databaseId } = getD1Config();
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`D1 query failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as D1ApiResponse<T>;
  if (!payload.success) {
    const message = payload.errors?.map((item) => item.message).filter(Boolean).join("; ");
    throw new Error(`D1 query error: ${message || "Unknown D1 error"}`);
  }

  return payload.result?.[0]?.results ?? [];
}

async function ensureSchema() {
  await d1Query(`
    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      active INTEGER NOT NULL,
      departure_code TEXT NOT NULL,
      arrival_code TEXT NOT NULL,
      max_price REAL NOT NULL,
      date_from TEXT NOT NULL,
      date_to TEXT NOT NULL,
      airlines_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await d1Query(`
    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      airline TEXT NOT NULL,
      flight_number TEXT NOT NULL,
      departure_code TEXT NOT NULL,
      arrival_code TEXT NOT NULL,
      departure_time TEXT NOT NULL,
      arrival_time TEXT NOT NULL,
      currency TEXT NOT NULL,
      price REAL NOT NULL,
      deeplink TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
  `);

  await d1Query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      deal_id TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      sent_at TEXT NOT NULL
    );
  `);

  await d1Query(`
    CREATE TABLE IF NOT EXISTS scan_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_scan_at TEXT,
      last_matched_deal_ids_json TEXT NOT NULL,
      matched_deals_count INTEGER NOT NULL,
      scanned_rules_count INTEGER NOT NULL
    );
  `);

  await d1Query(`
    INSERT OR IGNORE INTO scan_state (
      id, last_scan_at, last_matched_deal_ids_json, matched_deals_count, scanned_rules_count
    ) VALUES (
      1, NULL, '[]', 0, 0
    );
  `);
}

async function ensureReady() {
  if (!initPromise) {
    initPromise = ensureSchema();
  }
  await initPromise;
}

type RuleRow = {
  id: string;
  title: string;
  active: number;
  departure_code: string;
  arrival_code: string;
  max_price: number;
  date_from: string;
  date_to: string;
  airlines_json: string;
  created_at: string;
  updated_at: string;
};

type DealRow = {
  id: string;
  rule_id: string;
  airline: string;
  flight_number: string;
  departure_code: string;
  arrival_code: string;
  departure_time: string;
  arrival_time: string;
  currency: string;
  price: number;
  deeplink: string;
  fetched_at: string;
};

type NotificationRow = {
  id: string;
  rule_id: string;
  deal_id: string;
  recipient_email: string;
  sent_at: string;
};

function mapRuleRow(row: RuleRow): AlertRule {
  return {
    id: row.id,
    title: row.title,
    active: Boolean(row.active),
    departureCode: row.departure_code,
    arrivalCode: row.arrival_code,
    maxPrice: Number(row.max_price),
    dateFrom: row.date_from,
    dateTo: row.date_to,
    airlines: JSON.parse(row.airlines_json) as Airline[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDealRow(row: DealRow): FlightDeal {
  return {
    id: row.id,
    ruleId: row.rule_id,
    airline: row.airline as Airline,
    flightNumber: row.flight_number,
    departureCode: row.departure_code,
    arrivalCode: row.arrival_code,
    departureTime: row.departure_time,
    arrivalTime: row.arrival_time,
    currency: row.currency,
    price: Number(row.price),
    deeplink: row.deeplink,
    fetchedAt: row.fetched_at,
  };
}

function mapNotificationRow(row: NotificationRow): NotificationLog {
  return {
    id: row.id,
    ruleId: row.rule_id,
    dealId: row.deal_id,
    recipientEmail: row.recipient_email,
    sentAt: row.sent_at,
  };
}

export async function listRules() {
  await ensureReady();
  const rows = await d1Query<RuleRow>(`SELECT * FROM rules ORDER BY updated_at DESC;`);
  return rows.map(mapRuleRow);
}

export async function upsertRule(rule: AlertRule) {
  await ensureReady();
  await d1Query(`
    INSERT OR REPLACE INTO rules (
      id, title, active, departure_code, arrival_code, max_price, date_from, date_to, airlines_json, created_at, updated_at
    ) VALUES (
      ${sqlValue(rule.id)},
      ${sqlValue(rule.title)},
      ${sqlValue(rule.active)},
      ${sqlValue(rule.departureCode)},
      ${sqlValue(rule.arrivalCode)},
      ${sqlValue(rule.maxPrice)},
      ${sqlValue(rule.dateFrom)},
      ${sqlValue(rule.dateTo)},
      ${sqlValue(JSON.stringify(rule.airlines))},
      ${sqlValue(rule.createdAt)},
      ${sqlValue(rule.updatedAt)}
    );
  `);
  return rule;
}

export async function deleteRule(ruleId: string) {
  await ensureReady();
  const existing = await d1Query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM rules WHERE id = ${sqlValue(ruleId)};`,
  );
  if (!Number(existing[0]?.count)) return false;

  const dealRows = await d1Query<{ id: string }>(
    `SELECT id FROM deals WHERE rule_id = ${sqlValue(ruleId)};`,
  );
  const deletedDealIds = new Set(dealRows.map((row) => row.id));

  await d1Query(`DELETE FROM notifications WHERE rule_id = ${sqlValue(ruleId)};`);
  await d1Query(`DELETE FROM deals WHERE rule_id = ${sqlValue(ruleId)};`);
  await d1Query(`DELETE FROM rules WHERE id = ${sqlValue(ruleId)};`);

  const state = await getScanState();
  const filteredIds = state.lastMatchedDealIds.filter((id) => !deletedDealIds.has(id));
  const activeRules = await d1Query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM rules WHERE active = 1;`,
  );

  await updateScanState({
    lastScanAt: state.lastScanAt,
    lastMatchedDealIds: filteredIds,
    matchedDealsCount: filteredIds.length,
    scannedRulesCount: Number(activeRules[0]?.count ?? 0),
  });

  return true;
}

export async function listDeals(limit = 100) {
  await ensureReady();
  const rows = await d1Query<DealRow>(
    `SELECT * FROM deals ORDER BY fetched_at DESC LIMIT ${sqlValue(limit)};`,
  );
  return rows.map(mapDealRow);
}

export async function listLatestMatchedDeals(limit = 100) {
  await ensureReady();
  const state = await getScanState();
  if (state.lastMatchedDealIds.length === 0) return [];
  const idList = state.lastMatchedDealIds.map((id) => sqlValue(id)).join(",");
  const rows = await d1Query<DealRow>(
    `SELECT * FROM deals WHERE id IN (${idList}) ORDER BY fetched_at DESC LIMIT ${sqlValue(limit)};`,
  );
  return rows.map(mapDealRow);
}

export async function saveDeals(deals: FlightDeal[]) {
  await ensureReady();
  if (deals.length === 0) return [];

  const inserted: FlightDeal[] = [];
  for (const deal of deals) {
    const existing = await d1Query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM deals WHERE id = ${sqlValue(deal.id)};`,
    );
    if (Number(existing[0]?.count)) continue;

    await d1Query(`
      INSERT INTO deals (
        id, rule_id, airline, flight_number, departure_code, arrival_code, departure_time, arrival_time, currency, price, deeplink, fetched_at
      ) VALUES (
        ${sqlValue(deal.id)},
        ${sqlValue(deal.ruleId)},
        ${sqlValue(deal.airline)},
        ${sqlValue(deal.flightNumber)},
        ${sqlValue(deal.departureCode)},
        ${sqlValue(deal.arrivalCode)},
        ${sqlValue(deal.departureTime)},
        ${sqlValue(deal.arrivalTime)},
        ${sqlValue(deal.currency)},
        ${sqlValue(deal.price)},
        ${sqlValue(deal.deeplink)},
        ${sqlValue(deal.fetchedAt)}
      );
    `);
    inserted.push(deal);
  }

  return inserted;
}

export async function saveNotificationLogs(records: NotificationLog[]) {
  await ensureReady();
  for (const item of records) {
    await d1Query(`
      INSERT OR REPLACE INTO notifications (
        id, rule_id, deal_id, recipient_email, sent_at
      ) VALUES (
        ${sqlValue(item.id)},
        ${sqlValue(item.ruleId)},
        ${sqlValue(item.dealId)},
        ${sqlValue(item.recipientEmail)},
        ${sqlValue(item.sentAt)}
      );
    `);
  }
}

export async function listNotificationLogs() {
  await ensureReady();
  const rows = await d1Query<NotificationRow>(`SELECT * FROM notifications ORDER BY sent_at DESC;`);
  return rows.map(mapNotificationRow);
}

export async function updateScanState(state: ScanState) {
  await ensureReady();
  await d1Query(`
    INSERT OR REPLACE INTO scan_state (
      id, last_scan_at, last_matched_deal_ids_json, matched_deals_count, scanned_rules_count
    ) VALUES (
      1,
      ${sqlValue(state.lastScanAt)},
      ${sqlValue(JSON.stringify(state.lastMatchedDealIds))},
      ${sqlValue(state.matchedDealsCount)},
      ${sqlValue(state.scannedRulesCount)}
    );
  `);
}

export async function getScanState() {
  await ensureReady();
  const rows = await d1Query<{
    last_scan_at: string | null;
    last_matched_deal_ids_json: string;
    matched_deals_count: number;
    scanned_rules_count: number;
  }>(`SELECT * FROM scan_state WHERE id = 1 LIMIT 1;`);

  const row = rows[0];
  if (!row) {
    return {
      lastScanAt: null,
      lastMatchedDealIds: [],
      matchedDealsCount: 0,
      scannedRulesCount: 0,
    } satisfies ScanState;
  }

  return {
    lastScanAt: row.last_scan_at,
    lastMatchedDealIds: JSON.parse(row.last_matched_deal_ids_json ?? "[]") as string[],
    matchedDealsCount: Number(row.matched_deals_count ?? 0),
    scannedRulesCount: Number(row.scanned_rules_count ?? 0),
  } satisfies ScanState;
}
