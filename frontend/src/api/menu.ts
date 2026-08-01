import { endpoints } from "./endpoints";
import { http } from "./http";
import type { SafeProduct } from "../types/product";

export function getGuestMenu() {
  return http.get<{ products: SafeProduct[] }>(endpoints.guestMenu);
}
