import { promises as fs } from "node:fs";
import path from "node:path";
import type { AlertRule, DataStore, FlightDeal, NotificationLog, ScanState } from "@/lib/types";

const STORE_PATH = path.join(process.cwd(), "data", "store.json");

const defaultStore: DataStore = {
  rules: [],
  deals: [],
  notifications: [],
  scanState: {
    lastScanAt: null,
    lastMatchedDealIds: [],
    matchedDealsCount: 0,
    scannedRulesCount: 0,
  },
};

async function ensureStoreFile() {
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(defaultStore, null, 2), "utf8");
  }
}

export async function readStore(): Promise<DataStore> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<DataStore>;
  return {
    ...defaultStore,
    ...parsed,
    scanState: {
      ...defaultStore.scanState,
      ...(parsed.scanState ?? {}),
    },
  };
}

export async function writeStore(data: DataStore) {
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function listRules() {
  const db = await readStore();
  return db.rules.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function upsertRule(rule: AlertRule) {
  const db = await readStore();
  const index = db.rules.findIndex((item) => item.id === rule.id);

  if (index >= 0) {
    db.rules[index] = rule;
  } else {
    db.rules.push(rule);
  }

  await writeStore(db);
  return rule;
}

export async function deleteRule(ruleId: string) {
  const db = await readStore();
  const beforeLength = db.rules.length;
  db.rules = db.rules.filter((rule) => rule.id !== ruleId);

  if (db.rules.length === beforeLength) {
    return false;
  }

  const deletedDealIds = new Set(db.deals.filter((deal) => deal.ruleId === ruleId).map((deal) => deal.id));
  db.deals = db.deals.filter((deal) => deal.ruleId !== ruleId);
  db.notifications = db.notifications.filter((item) => item.ruleId !== ruleId);
  db.scanState.lastMatchedDealIds = db.scanState.lastMatchedDealIds.filter((id) => !deletedDealIds.has(id));
  db.scanState.matchedDealsCount = db.scanState.lastMatchedDealIds.length;
  db.scanState.scannedRulesCount = db.rules.filter((rule) => rule.active).length;

  await writeStore(db);
  return true;
}

export async function listDeals(limit = 100) {
  const db = await readStore();
  return db.deals.sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt)).slice(0, limit);
}

export async function listLatestMatchedDeals(limit = 100) {
  const db = await readStore();
  const ids = new Set(db.scanState.lastMatchedDealIds);
  const latestDeals = db.deals
    .filter((deal) => ids.has(deal.id))
    .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))
    .slice(0, limit);
  return latestDeals;
}

export async function saveDeals(deals: FlightDeal[]) {
  if (deals.length === 0) return [];
  const db = await readStore();
  const existingIds = new Set(db.deals.map((deal) => deal.id));
  const inserted: FlightDeal[] = [];

  for (const deal of deals) {
    if (existingIds.has(deal.id)) continue;
    db.deals.push(deal);
    inserted.push(deal);
    existingIds.add(deal.id);
  }

  await writeStore(db);
  return inserted;
}

export async function saveNotificationLogs(records: NotificationLog[]) {
  if (records.length === 0) return;
  const db = await readStore();
  db.notifications.push(...records);
  await writeStore(db);
}

export async function listNotificationLogs() {
  const db = await readStore();
  return db.notifications;
}

export async function updateScanState(state: ScanState) {
  const db = await readStore();
  db.scanState = state;
  await writeStore(db);
}

export async function getScanState() {
  const db = await readStore();
  return db.scanState;
}
