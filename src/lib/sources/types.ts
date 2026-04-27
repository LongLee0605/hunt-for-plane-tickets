export type SourceDeal = {
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
  currency: string;
  deeplink: string;
};

export type SourceResult = {
  source: "travelpayouts" | "none";
  deals: SourceDeal[];
};
