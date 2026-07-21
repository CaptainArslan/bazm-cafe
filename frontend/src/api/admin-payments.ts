import { authHttp } from "./http";
import type { SafePayment } from "../types/payment";

export function listAdminPayments() {
  return authHttp.get<{ payments: SafePayment[] }>("/payments");
}
