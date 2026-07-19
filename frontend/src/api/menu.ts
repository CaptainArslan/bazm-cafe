import { http } from "./http";
import type { SafeProduct } from "../types/product";

export function getGuestMenu() {
  return http.get<{ products: SafeProduct[] }>("/guest/menu");
}
