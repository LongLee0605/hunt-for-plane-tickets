"use client";

import { FormEvent, useMemo, useState } from "react";
import styles from "./page.module.css";
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

type DashboardClientProps = {
  initialRules: Rule[];
  initialDeals: Deal[];
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const time = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const day = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  return `${time} - ${day}`;
}

function formatDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("vi-VN").format(amount) + ` ${currency}`;
}

function parseVietnamCurrency(input: string) {
  const numeric = Number(input.replace(/[^\d]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function getAirportLabel(code: string) {
  const airport = AIRPORT_OPTIONS.find((item) => item.code === code);
  if (!airport) return code;
  return `${airport.code} - ${airport.city} (${airport.name})`;
}

export default function DashboardClient({ initialRules, initialDeals }: DashboardClientProps) {
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(initialForm);
  const [priceFocused, setPriceFocused] = useState(false);

  const selectedAirlines = useMemo(() => {
    return ["vietnamairlines", "vietjet"].filter((airline) => form[airline as "vietnamairlines"]);
  }, [form]);

  async function loadData() {
    const [rulesRes, dealsRes] = await Promise.all([fetch("/api/rules"), fetch("/api/deals?scope=latest")]);
    const rulesJson = (await rulesRes.json()) as { rules: Rule[] };
    const dealsJson = (await dealsRes.json()) as { deals: Deal[] };
    setRules(rulesJson.rules ?? []);
    setDeals(dealsJson.deals ?? []);
  }

  async function handleCreateRule(event: FormEvent) {
    event.preventDefault();
    if (form.dateFrom > form.dateTo) {
      setMessage("Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.");
      return;
    }
    if (form.departureCode === form.arrivalCode) {
      setMessage("Nơi đi và nơi đến không được trùng nhau.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const maxPriceValue = parseVietnamCurrency(form.maxPrice);
      if (maxPriceValue <= 0) {
        setMessage("Giá trần phải lớn hơn 0.");
        return;
      }

      const payload = {
        title: form.title,
        departureCode: form.departureCode.toUpperCase(),
        arrivalCode: form.arrivalCode.toUpperCase(),
        maxPrice: maxPriceValue,
        dateFrom: form.dateFrom,
        dateTo: form.dateTo,
        airlines: selectedAirlines,
        active: true,
      };

      const response = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setMessage("Tạo rule thất bại. Vui lòng kiểm tra dữ liệu đầu vào.");
        return;
      }

      setMessage("Đã tạo rule thành công.");
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
        setMessage("Chạy scan thất bại. Vui lòng thử lại sau.");
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
      setMessage("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteRule(ruleId: string, ruleTitle: string) {
    const confirmed = window.confirm(`Bạn có chắc muốn xóa bộ lọc "${ruleTitle}" không?`);
    if (!confirmed) return;

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/rules?id=${encodeURIComponent(ruleId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setMessage("Không thể xóa bộ lọc. Vui lòng thử lại.");
        return;
      }

      setMessage("Đã xóa bộ lọc thành công.");
      await loadData();
    } catch {
      setMessage("Không thể kết nối máy chủ. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div>
            <p className={styles.badge}>Bảng Theo Dõi Giá Vé</p>
            <h1 className={styles.title}>Flight Deal Watcher</h1>
            <p className={styles.subtitle}>
              Theo dõi giá vé theo bộ lọc, quét định kỳ và gửi cảnh báo qua Gmail. Giao diện được tối ưu để thao tác nhanh và theo dõi liên tục.
            </p>
          </div>
          <div className={styles.statGrid}>
            <article className={styles.statCard}>
              <p>Số bộ lọc</p>
              <strong>{rules.length}</strong>
            </article>
            <article className={styles.statCard}>
              <p>Ưu đãi đã lưu</p>
              <strong>{deals.length}</strong>
            </article>
          </div>
        </section>

        <section className={styles.layoutGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHead}>
              <h2>Tạo Bộ Lọc Mới</h2>
              <span>Kiểm tra dữ liệu đầu vào trước khi lưu</span>
            </div>
            <form onSubmit={handleCreateRule} className={styles.form}>
              <label className={styles.field}>
                <span>Tên bộ lọc</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                  placeholder="Ví dụ: SGN - HAN dưới 2 triệu"
                  required
                />
              </label>
              <div className={styles.grid2}>
                <label className={styles.field}>
                  <span>Nơi đi</span>
                  <select
                    value={form.departureCode}
                    onChange={(e) => setForm((s) => ({ ...s, departureCode: e.target.value }))}
                  >
                    {AIRPORT_OPTIONS.map((airport) => (
                      <option key={airport.code} value={airport.code}>
                        {airport.code} - {airport.city} ({airport.name})
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Nơi đến</span>
                  <select
                    value={form.arrivalCode}
                    onChange={(e) => setForm((s) => ({ ...s, arrivalCode: e.target.value }))}
                  >
                    {AIRPORT_OPTIONS.map((airport) => (
                      <option key={airport.code} value={airport.code}>
                        {airport.code} - {airport.city} ({airport.name})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={styles.field}>
                <span>Giá trần (VND)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={
                    priceFocused
                      ? form.maxPrice
                      : form.maxPrice
                        ? new Intl.NumberFormat("vi-VN").format(parseVietnamCurrency(form.maxPrice))
                        : ""
                  }
                  onChange={(e) =>
                    setForm((s) => ({ ...s, maxPrice: e.target.value.replace(/[^\d]/g, "") }))
                  }
                  onFocus={() => setPriceFocused(true)}
                  onBlur={() => setPriceFocused(false)}
                  placeholder="2.000.000"
                  required
                />
                <small className={styles.fieldHint}>
                  Mức giá hiện tại: {formatPrice(parseVietnamCurrency(form.maxPrice || "0"), "VND")}
                </small>
              </label>
              <div className={styles.grid2}>
                <label className={styles.field}>
                  <span>Ngày bắt đầu</span>
                  <input
                    type="date"
                    value={form.dateFrom}
                    onChange={(e) => setForm((s) => ({ ...s, dateFrom: e.target.value }))}
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Ngày kết thúc</span>
                  <input
                    type="date"
                    value={form.dateTo}
                    onChange={(e) => setForm((s) => ({ ...s, dateTo: e.target.value }))}
                    required
                  />
                </label>
              </div>
              <div className={styles.inlineChecks}>
                <label>
                  <input
                    type="checkbox"
                    checked={form.vietnamairlines}
                    onChange={(e) => setForm((s) => ({ ...s, vietnamairlines: e.target.checked }))}
                  />
                  Vietnam Airlines
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.vietjet}
                    onChange={(e) => setForm((s) => ({ ...s, vietjet: e.target.checked }))}
                  />
                  Vietjet
                </label>
              </div>
              <button className={styles.primaryButton} type="submit" disabled={busy || selectedAirlines.length === 0}>
                {busy ? "Đang xử lý..." : "Lưu bộ lọc"}
              </button>
            </form>
          </article>

          <aside className={styles.sidePanel}>
            <div className={styles.panelHead}>
              <h2>Scan và thông báo</h2>
              <span>Chạy thủ công</span>
            </div>
            <button className={styles.primaryButton} type="button" onClick={handleRunScan} disabled={busy}>
              {busy ? "Đang quét..." : "Quét ngay"}
            </button>
            <p className={styles.sideHelp}>
              Hệ thống sẽ đọc tất cả bộ lọc đang bật, đối chiếu giá vé và gửi thông báo Gmail nếu có kết quả phù hợp.
            </p>
            {message ? <p className={styles.message}>{message}</p> : null}
          </aside>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Bộ lọc ({rules.length})</h2>
            <span>Danh sách điều kiện theo dõi</span>
          </div>
          {rules.length === 0 ? (
            <p className={styles.empty}>Chưa có bộ lọc nào. Hãy tạo bộ lọc đầu tiên để bắt đầu quét.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Tên bộ lọc</th>
                    <th>Tuyến bay</th>
                    <th>Khoảng ngày</th>
                    <th>Giá trần</th>
                    <th>Hãng bay</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id}>
                      <td>{rule.title}</td>
                      <td>
                        {getAirportLabel(rule.departureCode)} {"->"} {getAirportLabel(rule.arrivalCode)}
                      </td>
                      <td>
                        {formatDateOnly(rule.dateFrom)} {"->"} {formatDateOnly(rule.dateTo)}
                      </td>
                      <td>{formatPrice(rule.maxPrice, "VND")}</td>
                      <td>{rule.airlines.join(", ").toUpperCase()}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.dangerButton}
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
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Ưu đãi mới ({deals.length})</h2>
            <span>Chỉ hiển thị theo lần scan gần nhất</span>
          </div>
          {deals.length === 0 ? (
            <p className={styles.empty}>
              Lần quét gần nhất không có ưu đãi mới phù hợp. Danh sách được để trống để tránh gây hiểu nhầm.
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Hãng bay</th>
                    <th>Mã chuyến</th>
                    <th>Tuyến bay</th>
                    <th>Khởi hành</th>
                    <th>Đến nơi</th>
                    <th>Giá</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((deal) => (
                    <tr key={deal.id}>
                      <td>{deal.airline.toUpperCase()}</td>
                      <td>{deal.flightNumber}</td>
                      <td>
                        {getAirportLabel(deal.departureCode)} {"->"} {getAirportLabel(deal.arrivalCode)}
                      </td>
                      <td>{formatDateTime(deal.departureTime)}</td>
                      <td>{formatDateTime(deal.arrivalTime)}</td>
                      <td>{formatPrice(deal.price, deal.currency)}</td>
                      <td>
                        <a className={styles.linkButton} href={deal.deeplink} target="_blank" rel="noreferrer">
                          Xem vé
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
