import { NextResponse } from "next/server";
import { listDeals, listLatestMatchedDeals } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const deals = scope === "latest" ? await listLatestMatchedDeals() : await listDeals();
  return NextResponse.json({ deals });
}
