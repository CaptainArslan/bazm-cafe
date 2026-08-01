import { endpoints } from "./endpoints";
import { authHttp } from "./http";
import type { CafeSettings } from "../types/settings";

export function getSettings() {
  return authHttp.get<{ settings: CafeSettings }>(endpoints.settings);
}

export function updateSettings(input: { taxRatePercent?: number; serviceChargePercent?: number }) {
  return authHttp.patch<{ settings: CafeSettings }>(endpoints.settings, input);
}
