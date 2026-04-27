import type { SourceResult } from "./types";
import { searchTravelpayoutsDeals } from "../travelpayouts";

export async function fetchVnaSourceDeals(from: string, to: string, dateFrom: string): Promise<SourceResult> {
  const fromTravelpayouts = await searchTravelpayoutsDeals({
    from,
    to,
    dateFrom,
    airlineCode: "VN",
  });
  if (fromTravelpayouts.length > 0) {
    return { source: "travelpayouts", deals: fromTravelpayouts };
  }

  return { source: "none", deals: [] };
}
