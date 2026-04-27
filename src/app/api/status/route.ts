import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    providers: {
      travelpayouts: Boolean(process.env.TRAVELPAYOUTS_TOKEN),
    },
    notifications: {
      gmailConfigured: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
      recipientConfigured: Boolean(process.env.NOTIFY_TO_EMAIL),
    },
  });
}
