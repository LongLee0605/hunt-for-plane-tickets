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

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  sent_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scan_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_scan_at TEXT,
  last_matched_deal_ids_json TEXT NOT NULL,
  matched_deals_count INTEGER NOT NULL,
  scanned_rules_count INTEGER NOT NULL
);

INSERT OR IGNORE INTO scan_state (
  id, last_scan_at, last_matched_deal_ids_json, matched_deals_count, scanned_rules_count
) VALUES (
  1, NULL, '[]', 0, 0
);
