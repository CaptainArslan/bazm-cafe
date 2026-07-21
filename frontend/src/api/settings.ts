import { authHttp } from "./http";
import type { CafeSettings } from "../types/settings";

export function getSettings() {
  return authHttp.get<{ settings: CafeSettings }>("/settings");
}

export function updateSettings(input: { taxRatePercent?: number; serviceChargePercent?: number }) {
  return authHttp.patch<{ settings: CafeSettings }>("/settings", input);
}
