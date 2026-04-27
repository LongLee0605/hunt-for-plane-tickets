import nodemailer from "nodemailer";
import type { AlertRule, FlightDeal, NotificationLog } from "./types";
import { createId, nowIso } from "./utils";

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendDealsEmail(rule: AlertRule, deals: FlightDeal[]) {
  const recipient = process.env.NOTIFY_TO_EMAIL;
  const transporter = getTransporter();
  if (!recipient || !transporter || deals.length === 0) return [];

  const formatTime = (value: string) =>
    new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

  const subject = `Cảnh báo giá vé: ${rule.departureCode} -> ${rule.arrivalCode} (${deals.length} kết quả)`;
  const lines = deals.map((deal) =>
    [
      `${deal.airline.toUpperCase()} ${deal.flightNumber}`,
      `${formatTime(deal.departureTime)} -> ${formatTime(deal.arrivalTime)}`,
      `Giá: ${deal.price.toLocaleString("vi-VN")} ${deal.currency}`,
      `Link: ${deal.deeplink}`,
    ].join("\n"),
  );

  const rows = deals
    .map(
      (deal) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${deal.airline.toUpperCase()}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${deal.flightNumber}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${deal.departureCode} -> ${deal.arrivalCode}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${formatTime(deal.departureTime)}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${formatTime(deal.arrivalTime)}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#1d4ed8;">${deal.price.toLocaleString("vi-VN")} ${deal.currency}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;"><a href="${deal.deeplink}" target="_blank" rel="noreferrer">Xem vé</a></td>
      </tr>`,
    )
    .join("");

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:20px;">
    <div style="max-width:860px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="padding:18px 20px;background:linear-gradient(120deg,#0f172a,#1d4ed8);color:#ffffff;">
        <h2 style="margin:0 0 6px 0;">Cảnh báo giá vé mới</h2>
        <p style="margin:0;opacity:0.9;">Bộ lọc: ${rule.title}</p>
      </div>
      <div style="padding:18px 20px;">
        <p style="margin:0 0 12px 0;">Tìm thấy <strong>${deals.length}</strong> kết quả phù hợp cho tuyến <strong>${rule.departureCode} -> ${rule.arrivalCode}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f1f5f9;color:#334155;">
              <th style="text-align:left;padding:10px;">Hãng bay</th>
              <th style="text-align:left;padding:10px;">Mã chuyến</th>
              <th style="text-align:left;padding:10px;">Tuyến bay</th>
              <th style="text-align:left;padding:10px;">Khởi hành</th>
              <th style="text-align:left;padding:10px;">Đến nơi</th>
              <th style="text-align:left;padding:10px;">Giá</th>
              <th style="text-align:left;padding:10px;">Link</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:14px 0 0;color:#64748b;font-size:12px;">Email này được gửi tự động từ Flight Deal Watcher.</p>
      </div>
    </div>
  </div>`;

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: recipient,
    subject,
    text: `${rule.title}\n\n${lines.join("\n\n")}`,
    html,
  });

  const sentAt = nowIso();
  return deals.map<NotificationLog>((deal) => ({
    id: createId(`${deal.id}-${recipient}-${sentAt}`),
    ruleId: rule.id,
    dealId: deal.id,
    recipientEmail: recipient,
    sentAt,
  }));
}
