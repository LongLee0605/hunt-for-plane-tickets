import DashboardClient from "@/app/DashboardClient";
import { listLatestMatchedDeals, listRules } from "@/lib/db";

export default async function Home() {
  const [rules, deals] = await Promise.all([listRules(), listLatestMatchedDeals()]);
  return <DashboardClient initialRules={rules} initialDeals={deals} />;
}
