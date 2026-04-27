import type { SourceDeal } from "@/lib/sources/types";

type CheapPriceRecord = {
  value?: number;
  price?: number;
  airline?: string;
  flight_number?: string;
  departure_at?: string;
  return_at?: string;
  expires_at?: string;
};

type CheapPriceResponse = {
  data?: Record<string, CheapPriceRecord>;
};

function getBaseUrl() {
  return process.env.TRAVELPAYOUTS_BASE_URL ?? "https://api.travelpayouts.com";
}

function normalizeDateToIso(date: string) {
  // API usually returns yyyy-mm-dd; this converts to ISO-like datetime for project schema.
  return `${date}T00:00:00+07:00`;
}

function parseDealFromRecord(
  record: CheapPriceRecord,
  from: string,
  to: string,
  requestedDate: string,
): SourceDeal | null {
  const rawPrice = typeof record.value === "number" ? record.value : record.price;
  if (!rawPrice || rawPrice <= 0) return null;

  const departure = record.departure_at ? normalizeDateToIso(record.departure_at.slice(0, 10)) : normalizeDateToIso(requestedDate);
  const returnAt = record.return_at ? normalizeDateToIso(record.return_at.slice(0, 10)) : departure;
  const airline = (record.airline ?? "").toUpperCase();
  const number = record.flight_number ?? "";

  return {
    flightNumber: `${airline}${number ? ` ${number}` : ""}`.trim() || "UNKNOWN",
    departureTime: departure,
    arrivalTime: returnAt,
    price: Math.round(rawPrice),
    currency: "VND",
    deeplink: `https://www.aviasales.com/search/${from}${requestedDate}${to}1`,
  };
}

export async function searchTravelpayoutsDeals(params: {
  from: string;
  to: string;
  dateFrom: string;
  airlineCode: "VN" | "VJ";
}): Promise<SourceDeal[]> {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) return [];

  const query = new URLSearchParams({
    origin: params.from,
    destination: params.to,
    depart_date: params.dateFrom,
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
  for (const record of Object.values(payload.data ?? {})) {
    if ((record.airline ?? "").toUpperCase() !== params.airlineCode) continue;
    const deal = parseDealFromRecord(record, params.from, params.to, params.dateFrom);
    if (!deal) continue;
    deals.push(deal);
  }

  return deals;
}
