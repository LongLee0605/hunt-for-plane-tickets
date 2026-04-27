import crypto from "node:crypto";

export function nowIso() {
  return new Date().toISOString();
}

export function toDateIso(input: string) {
  return new Date(input).toISOString().slice(0, 10);
}

export function createId(seed?: string) {
  if (!seed) return crypto.randomUUID();
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 24);
}
