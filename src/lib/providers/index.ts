import type { FlightProvider } from "./types";
import { vietnamAirlinesProvider } from "./vietnamAirlines";
import { vietjetProvider } from "./vietjet";

const registry: Record<string, FlightProvider> = {
  vietnamairlines: vietnamAirlinesProvider,
  vietjet: vietjetProvider,
};

export function getProvider(key: string) {
  return registry[key];
}
