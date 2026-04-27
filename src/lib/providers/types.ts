import type { Airline } from "../types";

export type SearchParams = {
  departureCode: string;
  arrivalCode: string;
  dateFrom: string;
  dateTo: string;
};

export type ProviderDeal = {
  airline: Airline;
  flightNumber: string;
  departureCode: string;
  arrivalCode: string;
  departureTime: string;
  arrivalTime: string;
  currency: string;
  price: number;
  deeplink: string;
};

export interface FlightProvider {
  key: Airline;
  search(params: SearchParams): Promise<ProviderDeal[]>;
}
