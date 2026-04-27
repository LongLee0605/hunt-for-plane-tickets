export type Airline = "vietnamairlines" | "vietjet";

export type AlertRule = {
  id: string;
  title: string;
  active: boolean;
  departureCode: string;
  arrivalCode: string;
  maxPrice: number;
  dateFrom: string;
  dateTo: string;
  airlines: Airline[];
  createdAt: string;
  updatedAt: string;
};

export type FlightDeal = {
  id: string;
  ruleId: string;
  airline: Airline;
  flightNumber: string;
  departureCode: string;
  arrivalCode: string;
  departureTime: string;
  arrivalTime: string;
  currency: string;
  price: number;
  deeplink: string;
  fetchedAt: string;
};

export type NotificationLog = {
  id: string;
  ruleId: string;
  dealId: string;
  recipientEmail: string;
  sentAt: string;
};

export type ScanState = {
  lastScanAt: string | null;
  lastMatchedDealIds: string[];
  matchedDealsCount: number;
  scannedRulesCount: number;
};

export type DataStore = {
  rules: AlertRule[];
  deals: FlightDeal[];
  notifications: NotificationLog[];
  scanState: ScanState;
};
