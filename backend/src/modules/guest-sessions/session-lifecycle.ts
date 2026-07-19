import { Prisma } from "../../generated/prisma/client.js";
import {
  GuestSessionClosureType,
  OrderPaymentStatus,
  OrderStatus,
  PaymentStatus,
} from "../../generated/prisma/enums.js";
import { money, sumMoney, toMoneyString } from "../../utils/money.js";

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.SERVED,
];

export const TERMINAL_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.COMPLETED,
  OrderStatus.REJECTED,
  OrderStatus.CANCELLED,
];

export const EMPTY_SESSION_INACTIVITY_MINUTES = 30;
export const RECOVERY_CODE_TTL_MINUTES = 5;
export const RECEIPT_ACCESS_TTL_HOURS = 24;

export type SessionOrderSnapshot = {
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  totalAmount: Prisma.Decimal;
  payments: Array<{ amount: Prisma.Decimal; status: PaymentStatus; voidedAt: Date | null }>;
};

export function paidAmountFromPayments(
  payments: Array<{ amount: Prisma.Decimal; status: PaymentStatus; voidedAt: Date | null }>,
): Prisma.Decimal {
  return sumMoney(
    payments
      .filter(
        (payment) =>
          payment.status === PaymentStatus.COMPLETED && payment.voidedAt === null,
      )
      .map((payment) => payment.amount),
  );
}

export function derivePaymentStatus(
  totalAmount: Prisma.Decimal,
  paidAmount: Prisma.Decimal,
): OrderPaymentStatus {
  if (paidAmount.lte(0)) {
    return OrderPaymentStatus.UNPAID;
  }

  if (paidAmount.lt(totalAmount)) {
    return OrderPaymentStatus.PARTIALLY_PAID;
  }

  return OrderPaymentStatus.PAID;
}

export function orderOutstanding(order: SessionOrderSnapshot): Prisma.Decimal {
  if (
    order.status === OrderStatus.REJECTED ||
    order.status === OrderStatus.CANCELLED
  ) {
    return money(0);
  }

  const paid = paidAmountFromPayments(order.payments);
  const remaining = order.totalAmount.minus(paid);
  return remaining.gt(0) ? remaining : money(0);
}

export function sessionOutstandingTotal(
  orders: SessionOrderSnapshot[],
): Prisma.Decimal {
  return sumMoney(orders.map(orderOutstanding));
}

export function isSessionSafelyCloseable(orders: SessionOrderSnapshot[]): boolean {
  if (orders.length === 0) {
    return true;
  }

  const allTerminal = orders.every((order) =>
    TERMINAL_ORDER_STATUSES.includes(order.status),
  );

  if (!allTerminal) {
    return false;
  }

  return sessionOutstandingTotal(orders).eq(0);
}

export function formatOutstanding(orders: SessionOrderSnapshot[]): string {
  return toMoneyString(sessionOutstandingTotal(orders));
}

export type CloseSessionResult = {
  closureType: GuestSessionClosureType;
  closedAt: Date;
};
