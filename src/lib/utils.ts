import crypto from "node:crypto";

export function nowIso() {
  return new Date().toISOString();
}

export function toDateIso(input: string) {
  return new Date(input).toISOString().slice(0, 10);
}

/** Calendar dates yyyy-mm-dd from `from` through `to`, using UTC midnight (no local TZ shift). */
export function buildUtcDateRangeInclusive(fromYmd: string, toYmd: string, maxDays = 31): string[] {
  const parts = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
    if (!m) return null;
    return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
  };
  const a = parts(fromYmd);
  const b = parts(toYmd);
  if (!a || !b) return [fromYmd];
  const start = Date.UTC(a.y, a.mo - 1, a.d);
  const end = Date.UTC(b.y, b.mo - 1, b.d);
  if (start > end) return [fromYmd];

  const out: string[] = [];
  for (let t = start, i = 0; t <= end && i < maxDays; t += 86400000, i++) {
    const d = new Date(t);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${mo}-${day}`);
  }
  return out;
}

export function createId(seed?: string) {
  if (!seed) return crypto.randomUUID();
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 24);
}
