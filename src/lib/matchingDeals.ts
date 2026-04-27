import type { AlertRule, FlightDeal } from "./types";
import { listDeals, listRules } from "./db";

function departureDateYmd(deal: FlightDeal): string {
  const raw = deal.departureTime;
  if (raw.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

/** Deal đã gắn ruleId từ lần quét; kiểm tra vẫn khớp rule hiện tại (giá trần, ngày, tuyến, hãng). */
export function dealMatchesActiveRule(rule: AlertRule, deal: FlightDeal): boolean {
  if (!rule.active) return false;
  if (deal.ruleId !== rule.id) return false;
  if (deal.price > rule.maxPrice) return false;
  if (!rule.airlines.includes(deal.airline)) return false;
  if (deal.departureCode !== rule.departureCode || deal.arrivalCode !== rule.arrivalCode) return false;
  const dep = departureDateYmd(deal);
  if (!dep || dep < rule.dateFrom || dep > rule.dateTo) return false;
  return true;
}

/** Tất cả deal trong DB thỏa ít nhất một bộ lọc đang bật (theo rule hiện tại). */
export async function listDealsMatchingActiveRules(limit = 5000): Promise<FlightDeal[]> {
  const activeRules = (await listRules()).filter((r) => r.active);
  if (activeRules.length === 0) return [];

  const ruleById = new Map(activeRules.map((r) => [r.id, r]));
  const all = await listDeals(limit);

  return all
    .filter((deal) => {
      const rule = ruleById.get(deal.ruleId);
      return rule ? dealMatchesActiveRule(rule, deal) : false;
    })
    .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
}
