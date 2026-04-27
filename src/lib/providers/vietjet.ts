import type { FlightProvider, ProviderDeal, SearchParams } from "@/lib/providers/types";
import { fetchVjSourceDeals } from "@/lib/sources/vj";

type RemoteDeal = {
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
  currency?: string;
  deeplink?: string;
};

function mapDeals(params: SearchParams, rows: RemoteDeal[]): ProviderDeal[] {
  return rows.map((item) => ({
    airline: "vietjet",
    flightNumber: item.flightNumber,
    departureCode: params.departureCode,
    arrivalCode: params.arrivalCode,
    departureTime: item.departureTime,
    arrivalTime: item.arrivalTime,
    currency: item.currency ?? "VND",
    price: item.price,
    deeplink: item.deeplink ?? "https://www.vietjetair.com/",
  }));
}

export const vietjetProvider: FlightProvider = {
  key: "vietjet",
  async search(params) {
    const result = await fetchVjSourceDeals(
      params.departureCode,
      params.arrivalCode,
      params.dateFrom,
    );
    return mapDeals(params, result.deals);
  },
};
