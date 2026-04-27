import { NextResponse } from "next/server";
import { deleteRule, listRules, upsertRule } from "@/lib/db";
import { createRuleSchema } from "@/lib/schema";
import { createId, nowIso } from "@/lib/utils";

export async function GET() {
  const rules = await listRules();
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = createRuleSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid rule payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const now = nowIso();
  const data = parsed.data;
  const id = createId(`${data.title}-${data.departureCode}-${data.arrivalCode}-${data.dateFrom}-${data.dateTo}`);

  const rule = await upsertRule({
    id,
    title: data.title,
    active: data.active,
    departureCode: data.departureCode,
    arrivalCode: data.arrivalCode,
    maxPrice: data.maxPrice,
    dateFrom: data.dateFrom,
    dateTo: data.dateTo,
    airlines: data.airlines,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ rule }, { status: 201 });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing rule id" }, { status: 400 });
  }

  const deleted = await deleteRule(id);
  if (!deleted) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
