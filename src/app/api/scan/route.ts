import { NextResponse } from "next/server";
import { runScan } from "@/lib/scanner";

export async function POST() {
  const result = await runScan();
  return NextResponse.json({ result });
}
