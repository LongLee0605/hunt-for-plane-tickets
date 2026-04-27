import {
  listNotificationLogs,
  listRules,
  saveDeals,
  saveNotificationLogs,
  updateScanState,
} from "@/lib/db";
import { sendDealsEmail } from "@/lib/notifier";
import { getProvider } from "@/lib/providers";
import type { AlertRule, FlightDeal } from "@/lib/types";
import { createId, nowIso } from "@/lib/utils";

function pickMatchedDeals(rule: AlertRule, deals: FlightDeal[]) {
  return deals.filter((deal) => deal.price <= rule.maxPrice);
}

function mapDealToEntity(rule: AlertRule, deal: Omit<FlightDeal, "id" | "ruleId" | "fetchedAt">): FlightDeal {
  const fetchedAt = nowIso();
  const id = createId(
    [rule.id, deal.airline, deal.flightNumber, deal.departureTime, String(deal.price)].join(":"),
  );

  return {
    ...deal,
    id,
    ruleId: rule.id,
    fetchedAt,
  };
}

export async function runScan() {
  const rules = (await listRules()).filter((rule) => rule.active);
  const notificationLogs = await listNotificationLogs();
  const notifiedDealIds = new Set(notificationLogs.map((item) => item.dealId));
  const report = {
    scannedRules: rules.length,
    matchedDeals: 0,
    sentEmails: 0,
  };
  const latestMatchedDealIds: string[] = [];

  for (const rule of rules) {
    const allDeals: FlightDeal[] = [];

    for (const airline of rule.airlines) {
      const provider = getProvider(airline);
      if (!provider) continue;

      const providerDeals = await provider.search({
        departureCode: rule.departureCode,
        arrivalCode: rule.arrivalCode,
        dateFrom: rule.dateFrom,
        dateTo: rule.dateTo,
      });

      for (const deal of providerDeals) {
        allDeals.push(mapDealToEntity(rule, deal));
      }
    }

    const inserted = await saveDeals(allDeals);
    const matched = pickMatchedDeals(rule, inserted);
    const freshMatched = matched.filter((deal) => !notifiedDealIds.has(deal.id));
    report.matchedDeals += freshMatched.length;
    latestMatchedDealIds.push(...freshMatched.map((deal) => deal.id));

    const logs = await sendDealsEmail(rule, freshMatched);
    report.sentEmails += logs.length > 0 ? 1 : 0;
    logs.forEach((item) => notifiedDealIds.add(item.dealId));
    await saveNotificationLogs(logs);
  }

  await updateScanState({
    lastScanAt: nowIso(),
    lastMatchedDealIds: latestMatchedDealIds,
    matchedDealsCount: report.matchedDeals,
    scannedRulesCount: report.scannedRules,
  });

  return report;
}
