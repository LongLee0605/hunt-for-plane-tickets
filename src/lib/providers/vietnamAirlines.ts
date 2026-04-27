import type { FlightProvider, ProviderDeal, SearchParams } from "./types";
import { fetchVnaSourceDeals } from "../sources/vna";

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
    airline: "vietnamairlines",
    flightNumber: item.flightNumber,
    departureCode: params.departureCode,
    arrivalCode: params.arrivalCode,
    departureTime: item.departureTime,
    arrivalTime: item.arrivalTime,
    currency: item.currency ?? "VND",
    price: item.price,
    deeplink: item.deeplink ?? "https://www.vietnamairlines.com/",
  }));
}

export const vietnamAirlinesProvider: FlightProvider = {
  key: "vietnamairlines",
  async search(params) {
    const result = await fetchVnaSourceDeals(
      params.departureCode,
      params.arrivalCode,
      params.dateFrom,
    );
    return mapDeals(params, result.deals);
  },
};
