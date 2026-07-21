import { authHttp } from "./http";
import type { SafeProduct } from "../types/product";

export function listAdminProducts() {
  return authHttp.get<{ products: SafeProduct[] }>("/products");
}
