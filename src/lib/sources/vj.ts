import type { SourceResult } from "./types";
import { searchTravelpayoutsDeals } from "../travelpayouts";

export async function fetchVjSourceDeals(from: string, to: string, dateFrom: string): Promise<SourceResult> {
  const fromTravelpayouts = await searchTravelpayoutsDeals({
    from,
    to,
    dateFrom,
    airlineCode: "VJ",
  });
  if (fromTravelpayouts.length > 0) {
    return { source: "travelpayouts", deals: fromTravelpayouts };
  }

  return { source: "none", deals: [] };
}
