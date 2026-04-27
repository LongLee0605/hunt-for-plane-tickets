import type { SourceDeal } from "./sources/types";
import { buildUtcDateRangeInclusive } from "./utils";

type PriceRecord = {
  value?: number;
  price?: number;
  airline?: string;
  flight_number?: string | number;
  departure_at?: string;
  return_at?: string;
  expires_at?: string;
};

type CheapPriceResponse = {
  data?: Record<string, Record<string, PriceRecord> | PriceRecord>;
};

type CalendarResponse = {
  success?: boolean;
  data?: Record<string, PriceRecord>;
};

type DirectResponse = {
  success?: boolean;
  data?: Record<string, Record<string, PriceRecord> | PriceRecord>;
};

function getBaseUrl() {
  return process.env.TRAVELPAYOUTS_BASE_URL ?? "https://api.travelpayouts.com";
}

function normalizeDateToIso(date: string) {
  return `${date}T00:00:00+07:00`;
}

function parseDealFromRecord(
  record: PriceRecord,
  from: string,
  to: string,
  requestedDateYmd: string,
): SourceDeal | null {
  const rawPrice = typeof record.value === "number" ? record.value : record.price;
  if (!rawPrice || rawPrice <= 0) return null;

  const departure = record.departure_at
    ? new Date(record.departure_at).toISOString()
    : normalizeDateToIso(requestedDateYmd);
  const returnAt = record.return_at ? new Date(record.return_at).toISOString() : departure;
  const airline = (record.airline ?? "").toUpperCase();
  const number = record.flight_number ?? "";

  return {
    flightNumber: `${airline}${number !== "" ? ` ${number}` : ""}`.trim() || "UNKNOWN",
    departureTime: departure,
    arrivalTime: returnAt,
    price: Math.round(rawPrice),
    currency: "VND",
    deeplink: `https://www.aviasales.com/search/${from}${requestedDateYmd}${to}1`,
  };
}

function flattenCheapData(data: CheapPriceResponse["data"]): PriceRecord[] {
  const out: PriceRecord[] = [];
  for (const destinationNode of Object.values(data ?? {})) {
    if (!destinationNode || typeof destinationNode !== "object") continue;
    const records =
      "airline" in destinationNode
        ? [destinationNode as PriceRecord]
        : (Object.values(destinationNode) as PriceRecord[]);
    for (const record of records) {
      if (record && typeof record === "object") out.push(record);
    }
  }
  return out;
}

/**
 * `/v1/prices/direct`: cheapest **non-stop** offers; response can list several indexed results per destination,
 * each with `airline`. Supplements `/v1/prices/calendar`, where each day is only **one** global cheapest row
 * (often another carrier), so VN/VJ rows can be missing even when the airline site shows a good fare.
 */
async function searchTravelpayoutsDirectForMonth(params: {
  from: string;
  to: string;
  monthYyyyMm: string;
  dateFrom: string;
  dateTo: string;
  airlineCode: "VN" | "VJ";
}): Promise<Array<{ deal: SourceDeal; dedupeKey: string }>> {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) return [];

  const query = new URLSearchParams({
    origin: params.from,
    destination: params.to,
    depart_date: params.monthYyyyMm,
    token,
    currency: "vnd",
    show_to_affiliates: "true",
  });

  const response = await fetch(`${getBaseUrl()}/v1/prices/direct?${query.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as DirectResponse;
  if (!payload.success || !payload.data) return [];

  const out: Array<{ deal: SourceDeal; dedupeKey: string }> = [];
  for (const record of flattenCheapData(payload.data)) {
    if ((record.airline ?? "").toUpperCase() !== params.airlineCode) continue;
    const dayYmd = record.departure_at
      ? new Date(record.departure_at).toISOString().slice(0, 10)
      : "";
    if (!dayYmd || dayYmd < params.dateFrom || dayYmd > params.dateTo) continue;
    const deal = parseDealFromRecord(record, params.from, params.to, dayYmd);
    if (!deal) continue;
    const dedupeKey = `${dayYmd}:${params.airlineCode}:${String(record.flight_number ?? "")}:${deal.price}`;
    out.push({ deal, dedupeKey });
  }
  return out;
}

/** `/v1/prices/cheap`: one cheapest offer per request; carrier is often not VN/VJ. Used as fallback only. */
export async function searchTravelpayoutsCheapSingleDay(params: {
  from: string;
  to: string;
  departDateYmd: string;
  airlineCode: "VN" | "VJ";
}): Promise<SourceDeal[]> {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) return [];

  const query = new URLSearchParams({
    origin: params.from,
    destination: params.to,
    depart_date: params.departDateYmd,
    one_way: "true",
    token,
    currency: "vnd",
    show_to_affiliates: "true",
  });

  const response = await fetch(`${getBaseUrl()}/v1/prices/cheap?${query.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as CheapPriceResponse;
  const deals: SourceDeal[] = [];
  for (const record of flattenCheapData(payload.data)) {
    if ((record.airline ?? "").toUpperCase() !== params.airlineCode) continue;
    const deal = parseDealFromRecord(record, params.from, params.to, params.departDateYmd);
    if (deal) deals.push(deal);
  }
  return deals;
}

/**
 * Uses `/v1/prices/calendar`: one cheapest offer **per calendar day** in the month, with `airline` set.
 * This matches VN/VJ much more often than `/v1/prices/cheap` alone.
 */
export async function searchTravelpayoutsDeals(params: {
  from: string;
  to: string;
  dateFrom: string;
  dateTo: string;
  airlineCode: "VN" | "VJ";
}): Promise<SourceDeal[]> {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) return [];

  const days = buildUtcDateRangeInclusive(params.dateFrom, params.dateTo, 366);
  const months = [...new Set(days.map((d) => d.slice(0, 7)))];
  const maxMonths = Math.min(
    24,
    Math.max(1, Number(process.env.TRAVELPAYOUTS_MAX_CALENDAR_MONTHS ?? 12) || 12),
  );
  const limitedMonths = months.slice(0, maxMonths);

  const deals: SourceDeal[] = [];
  const seen = new Set<string>();

  for (const month of limitedMonths) {
    const query = new URLSearchParams({
      depart_date: month,
      origin: params.from,
      destination: params.to,
      calendar_type: "departure_date",
      token,
      currency: "vnd",
      show_to_affiliates: "true",
    });

    const response = await fetch(`${getBaseUrl()}/v1/prices/calendar?${query.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) continue;

    const payload = (await response.json()) as CalendarResponse;
    if (!payload.success || !payload.data) continue;

    for (const [dayKey, record] of Object.entries(payload.data)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) continue;
      if (dayKey < params.dateFrom || dayKey > params.dateTo) continue;
      if ((record.airline ?? "").toUpperCase() !== params.airlineCode) continue;

      const deal = parseDealFromRecord(record, params.from, params.to, dayKey);
      if (!deal) continue;

      const dedupeKey = `${dayKey}:${params.airlineCode}:${String(record.flight_number ?? "")}:${deal.price}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      deals.push(deal);
    }
  }

  const useDirect = process.env.TRAVELPAYOUTS_USE_DIRECT !== "0";
  if (useDirect) {
    for (const month of limitedMonths) {
      const fromDirect = await searchTravelpayoutsDirectForMonth({
        from: params.from,
        to: params.to,
        monthYyyyMm: month,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        airlineCode: params.airlineCode,
      });
      for (const { deal, dedupeKey } of fromDirect) {
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        deals.push(deal);
      }
    }
  }

  if (deals.length > 0) return deals;

  // Fallback: single-day cheap for start date only (legacy behaviour).
  return searchTravelpayoutsCheapSingleDay({
    from: params.from,
    to: params.to,
    departDateYmd: params.dateFrom,
    airlineCode: params.airlineCode,
  });
}
