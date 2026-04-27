import { FormEvent, useEffect, useMemo, useState } from "react";
import { AIRPORT_OPTIONS } from "@/lib/airports";

type Rule = {
  id: string;
  title: string;
  departureCode: string;
  arrivalCode: string;
  maxPrice: number;
  dateFrom: string;
  dateTo: string;
  airlines: string[];
};

type Deal = {
  id: string;
  ruleId: string;
  airline: string;
  flightNumber: string;
  departureCode: string;
  arrivalCode: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
  currency: string;
  deeplink: string;
};

const initialForm = {
  title: "",
  departureCode: "SGN",
  arrivalCode: "HAN",
  maxPrice: "2000000",
  dateFrom: new Date().toISOString().slice(0, 10),
  dateTo: new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10),
  vietnamairlines: true,
  vietjet: true,
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const time = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  const day = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  return `${time} - ${day}`;
}

function formatDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatPrice(amount: number, currency: string) {
  return `${new Intl.NumberFormat("vi-VN").format(amount)} ${currency}`;
}

function parseVietnamCurrency(input: string) {
  const numeric = Number(input.replace(/[^\d]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function getAirportLabel(code: string) {
  const airport = AIRPORT_OPTIONS.find((item) => item.code === code);
  return airport ? `${airport.code} - ${airport.city} (${airport.name})` : code;
}

export default function App() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(initialForm);
  const [priceFocused, setPriceFocused] = useState(false);

  const selectedAirlines = useMemo(
    () => ["vietnamairlines", "vietjet"].filter((airline) => form[airline as "vietnamairlines"]),
    [form],
  );

  async function loadData() {
    try {
      const [rulesRes, dealsRes] = await Promise.all([fetch("/api/rules"), fetch("/api/deals?scope=matching")]);
      if (!rulesRes.ok || !dealsRes.ok) {
        const ruleErr = !rulesRes.ok ? await rulesRes.text() : "";
        const dealErr = !dealsRes.ok ? await dealsRes.text() : "";
        throw new Error(ruleErr || dealErr || "Không thể tải dữ liệu từ máy chủ.");
      }

      const rulesJson = (await rulesRes.json()) as { rules: Rule[] };
      const dealsJson = (await dealsRes.json()) as { deals: Deal[] };
      setRules(rulesJson.rules ?? []);
      setDeals(dealsJson.deals ?? []);
    } catch (error) {
      setRules([]);
      setDeals([]);
      const message = error instanceof Error ? error.message : "Không thể tải dữ liệu từ máy chủ.";
      setMessage(`Lỗi tải dữ liệu: ${message}`);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleCreateRule(event: FormEvent) {
    event.preventDefault();
    if (form.dateFrom > form.dateTo) return setMessage("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");
    if (form.departureCode === form.arrivalCode) return setMessage("Nơi đi và nơi đến không được trùng nhau.");

    setBusy(true);
    setMessage("");
    try {
      const maxPriceValue = parseVietnamCurrency(form.maxPrice);
      if (maxPriceValue <= 0) return setMessage("Giá trần phải lớn hơn 0.");

      const response = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          departureCode: form.departureCode.toUpperCase(),
          arrivalCode: form.arrivalCode.toUpperCase(),
          maxPrice: maxPriceValue,
          dateFrom: form.dateFrom,
          dateTo: form.dateTo,
          airlines: selectedAirlines,
          active: true,
        }),
      });

      if (!response.ok) return setMessage("Tạo bộ lọc thất bại. Vui lòng kiểm tra dữ liệu đầu vào.");
      setMessage("Đã tạo bộ lọc thành công.");
      setForm(initialForm);
      await loadData();
    } catch {
      setMessage("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRunScan() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/scan", { method: "POST" });
      if (!response.ok) {
        let detail = "";
        try {
          const err = (await response.json()) as { error?: string };
          if (err.error) detail = ` (${err.error})`;
        } catch {
          detail = ` (HTTP ${response.status})`;
        }
        setMessage(`Chạy quét thất bại${detail}. Kiểm tra API đang chạy (npm run dev hoặc npm run dev:api trên cổng 8787).`);
        return;
      }
      const data = (await response.json()) as {
        result: { scannedRules: number; matchedDeals: number; sentEmails: number };
      };
      setMessage(
        `Quét hoàn tất: ${data.result.scannedRules} bộ lọc, ${data.result.matchedDeals} ưu đãi mới, ${data.result.sentEmails} email đã gửi.`,
      );
      await loadData();
    } catch {
      setMessage("Không thể kết nối máy chủ. Hãy chạy `npm run dev` (cả web + API) hoặc mở API tại http://localhost:8787.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteRule(ruleId: string, ruleTitle: string) {
    if (!window.confirm(`Bạn có chắc muốn xóa bộ lọc "${ruleTitle}" không?`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/rules?id=${encodeURIComponent(ruleId)}`, { method: "DELETE" });
      if (!response.ok) return setMessage("Không thể xóa bộ lọc. Vui lòng thử lại.");
      setMessage("Đã xóa bộ lọc thành công.");
      await loadData();
    } catch {
      setMessage("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <section className="mb-5 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-700 p-6 text-white">
        <p className="inline-flex rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold">
          Bảng Theo Dõi Giá Vé
        </p>
        <h1 className="mt-3 text-3xl font-bold">Flight Deal Watcher</h1>
        <p className="mt-3 max-w-3xl text-sm text-white/90">
          Theo dõi giá vé theo bộ lọc, quét định kỳ và gửi cảnh báo qua Gmail. Hệ thống chỉ dùng dữ liệu thật từ API.
        </p>
      </section>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Tạo Bộ Lọc Mới</h2>
          <form onSubmit={handleCreateRule} className="grid gap-3">
            <input
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={form.title}
              onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
              placeholder="Ví dụ: SGN - HAN dưới 2 triệu"
              required
            />
            <div className="grid gap-3 md:grid-cols-2">
              <select
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={form.departureCode}
                onChange={(e) => setForm((s) => ({ ...s, departureCode: e.target.value }))}
              >
                {AIRPORT_OPTIONS.map((airport) => (
                  <option key={airport.code} value={airport.code}>
                    {airport.code} - {airport.city} ({airport.name})
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={form.arrivalCode}
                onChange={(e) => setForm((s) => ({ ...s, arrivalCode: e.target.value }))}
              >
                {AIRPORT_OPTIONS.map((airport) => (
                  <option key={airport.code} value={airport.code}>
                    {airport.code} - {airport.city} ({airport.name})
                  </option>
                ))}
              </select>
            </div>
            <input
              className="rounded-lg border border-slate-300 px-3 py-2"
              type="text"
              inputMode="numeric"
              value={priceFocused ? form.maxPrice : new Intl.NumberFormat("vi-VN").format(parseVietnamCurrency(form.maxPrice))}
              onChange={(e) => setForm((s) => ({ ...s, maxPrice: e.target.value.replace(/[^\d]/g, "") }))}
              onFocus={() => setPriceFocused(true)}
              onBlur={() => setPriceFocused(false)}
              required
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                type="date"
                value={form.dateFrom}
                onChange={(e) => setForm((s) => ({ ...s, dateFrom: e.target.value }))}
                required
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                type="date"
                value={form.dateTo}
                onChange={(e) => setForm((s) => ({ ...s, dateTo: e.target.value }))}
                required
              />
            </div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.vietnamairlines}
                  onChange={(e) => setForm((s) => ({ ...s, vietnamairlines: e.target.checked }))}
                />
                Vietnam Airlines
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.vietjet}
                  onChange={(e) => setForm((s) => ({ ...s, vietjet: e.target.checked }))}
                />
                Vietjet
              </label>
            </div>
            <button
              className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-60"
              type="submit"
              disabled={busy || selectedAirlines.length === 0}
            >
              {busy ? "Đang xử lý..." : "Lưu bộ lọc"}
            </button>
          </form>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Scan và thông báo</h2>
          <button
            type="button"
            onClick={handleRunScan}
            disabled={busy}
            className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Đang quét..." : "Quét ngay"}
          </button>
          {message ? <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">{message}</p> : null}
        </div>
      </div>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Bộ lọc ({rules.length})</h2>
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2">Tên bộ lọc</th>
                <th className="px-3 py-2">Tuyến bay</th>
                <th className="px-3 py-2">Khoảng ngày</th>
                <th className="px-3 py-2">Giá trần</th>
                <th className="px-3 py-2">Hãng</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b">
                  <td className="px-3 py-2">{rule.title}</td>
                  <td className="px-3 py-2">
                    {getAirportLabel(rule.departureCode)} {"->"} {getAirportLabel(rule.arrivalCode)}
                  </td>
                  <td className="px-3 py-2">
                    {formatDateOnly(rule.dateFrom)} {"->"} {formatDateOnly(rule.dateTo)}
                  </td>
                  <td className="px-3 py-2">{formatPrice(rule.maxPrice, "VND")}</td>
                  <td className="px-3 py-2">{rule.airlines.join(", ").toUpperCase()}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="rounded border border-rose-300 bg-rose-50 px-3 py-1 text-rose-700"
                      onClick={() => void handleDeleteRule(rule.id, rule.title)}
                      disabled={busy}
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold">Chuyến bay phù hợp bộ lọc ({deals.length})</h2>
        <p className="mb-3 text-sm text-slate-600">
          Hiển thị mọi vé đã quét, còn khớp tuyến — ngày — hãng — giá trần của các bộ lọc đang bật (không chỉ lần quét cuối). Hãy bấm &quot;Quét ngay&quot; nếu chưa có dữ liệu.
        </p>
        {deals.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            Chưa có chuyến nào trong kho dữ liệu khớp bộ lọc. Thử tăng giá trần, nới khoảng ngày, hoặc chạy quét lại sau khi đổi rule.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1080px] w-full text-left text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2">Bộ lọc</th>
                  <th className="px-3 py-2">Hãng</th>
                  <th className="px-3 py-2">Mã chuyến</th>
                  <th className="px-3 py-2">Tuyến bay</th>
                  <th className="px-3 py-2">Khởi hành</th>
                  <th className="px-3 py-2">Đến nơi</th>
                  <th className="px-3 py-2">Giá</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => {
                  const ruleTitle = rules.find((r) => r.id === deal.ruleId)?.title ?? deal.ruleId.slice(0, 8);
                  return (
                    <tr key={deal.id} className="border-b">
                      <td className="px-3 py-2 font-medium text-slate-800">{ruleTitle}</td>
                      <td className="px-3 py-2">{deal.airline.toUpperCase()}</td>
                      <td className="px-3 py-2">{deal.flightNumber}</td>
                      <td className="px-3 py-2">
                        {getAirportLabel(deal.departureCode)} {"->"} {getAirportLabel(deal.arrivalCode)}
                      </td>
                      <td className="px-3 py-2">{formatDateTime(deal.departureTime)}</td>
                      <td className="px-3 py-2">{formatDateTime(deal.arrivalTime)}</td>
                      <td className="px-3 py-2">{formatPrice(deal.price, deal.currency)}</td>
                      <td className="px-3 py-2">
                        <a className="font-semibold text-blue-700" href={deal.deeplink} target="_blank" rel="noreferrer">
                          Xem vé
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
