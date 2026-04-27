import {
  listNotificationLogs,
  listRules,
  saveDeals,
  saveNotificationLogs,
  updateScanState,
} from "./db";
import { sendDealsEmail } from "./notifier";
import { getProvider } from "./providers";
import type { AlertRule, FlightDeal } from "./types";
import { createId, nowIso } from "./utils";

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

    await saveDeals(allDeals);
    // So khop gia tren toan bo ket qua vua fetch — khong chi deal "insert moi"
    // (deal da ton tai trong DB van phai duoc tinh la phu hop de UI hien thi dung).
    const matched = pickMatchedDeals(rule, allDeals);
    const freshMatched = matched.filter((deal) => !notifiedDealIds.has(deal.id));
    report.matchedDeals += freshMatched.length;
    latestMatchedDealIds.push(...matched.map((deal) => deal.id));

    try {
      const logs = await sendDealsEmail(rule, freshMatched);
      report.sentEmails += logs.length > 0 ? 1 : 0;
      logs.forEach((item) => notifiedDealIds.add(item.dealId));
      await saveNotificationLogs(logs);
    } catch (error) {
      console.error("[scan] sendDealsEmail failed for rule", rule.id, error);
    }
  }

  await updateScanState({
    lastScanAt: nowIso(),
    lastMatchedDealIds: latestMatchedDealIds,
    matchedDealsCount: report.matchedDeals,
    scannedRulesCount: report.scannedRules,
  });

  return report;
}
