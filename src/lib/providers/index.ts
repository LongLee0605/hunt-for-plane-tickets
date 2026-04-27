import type { FlightProvider } from "@/lib/providers/types";
import { vietnamAirlinesProvider } from "@/lib/providers/vietnamAirlines";
import { vietjetProvider } from "@/lib/providers/vietjet";

const registry: Record<string, FlightProvider> = {
  vietnamairlines: vietnamAirlinesProvider,
  vietjet: vietjetProvider,
};

export function getProvider(key: string) {
  return registry[key];
}
