import { authHttp } from "./http";
import type { CafeSettings } from "../types/settings";

export function getSettings() {
  return authHttp.get<{ settings: CafeSettings }>("/settings");
}
