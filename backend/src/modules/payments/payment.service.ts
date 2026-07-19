import { HTTP_STATUS } from "../../constants/http-status.js";
import { AppError } from "../../errors/app-error.js";
import { OrderStatus } from "../../generated/prisma/enums.js";
import {
  publishGuestSessionClosed,
  publishOrderCompleted,
  publishOrderPaymentUpdated,
  publishOrderStatusUpdated,
  publishTableReleased,
} from "../../realtime/realtime.publisher.js";
import { money, toMoneyString } from "../../utils/money.js";
import { findOrderByUuid } from "../orders/order.repository.js";
import { toSafeOrder } from "../orders/order.service.js";
import { PAYMENT_MESSAGES } from "./payment.constants.js";
import {
  createPaymentTransaction,
  findPaymentByUuid,
  listPayments,
  listPaymentsForOrder,
  reversePaymentTransaction,
} from "./payment.repository.js";
import type { SafePayment } from "./payment.types.js";
import type {
  CreatePaymentInput,
  ReversePaymentInput,
} from "./payment.validation.js";

function toSafePayment(payment: {
  uuid: string;
  paymentNumber: string;
  amount: { toFixed: (digits: number) => string };
  method: string;
  status: string;
  reference: string | null;
  notes: string | null;
  paidAt: Date | null;
  voidedAt?: Date | null;
  voidReason?: string | null;
  createdAt: Date;
  order: { uuid: string };
}): SafePayment {
  return {
    id: payment.uuid,
    paymentNumber: payment.paymentNumber,
    orderId: payment.order.uuid,
    amount: toMoneyString(payment.amount as never),
    method: payment.method,
    status: payment.status,
    reference: payment.reference,
    notes: payment.notes,
    paidAt: payment.paidAt,
    voidedAt: payment.voidedAt ?? null,
    voidReason: payment.voidReason ?? null,
    createdAt: payment.createdAt,
  };
}

export async function listPaymentRecords() {
  return (await listPayments()).map(toSafePayment);
}

export async function getPaymentRecord(paymentId: string) {
  const payment = await findPaymentByUuid(paymentId);

  if (payment === null) {
    throw new AppError(
      PAYMENT_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "PAYMENT_NOT_FOUND",
    );
  }

  return toSafePayment(payment);
}

export async function listOrderPaymentRecords(orderId: string) {
  const order = await findOrderByUuid(orderId);

  if (order === null) {
    throw new AppError(
      "Order not found.",
      HTTP_STATUS.NOT_FOUND,
      "ORDER_NOT_FOUND",
    );
  }

  return (await listPaymentsForOrder(order.id)).map(toSafePayment);
}

export async function createOrderPayment(
  orderId: string,
  input: CreatePaymentInput,
  receivedByUserId: bigint,
) {
  const order = await findOrderByUuid(orderId);

  if (order === null) {
    throw new AppError(
      "Order not found.",
      HTTP_STATUS.NOT_FOUND,
      "ORDER_NOT_FOUND",
    );
  }

  if (order.status !== OrderStatus.SERVED) {
    throw new AppError(
      PAYMENT_MESSAGES.ORDER_NOT_SERVED,
      HTTP_STATUS.CONFLICT,
      "ORDER_NOT_SERVED",
    );
  }

  let result;

  try {
    result = await createPaymentTransaction({
      orderId: order.id,
      amount: money(input.amount),
      method: input.method,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      receivedByUserId,
      idempotencyKey: input.idempotencyKey ?? null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_SERVED") {
      throw new AppError(
        PAYMENT_MESSAGES.ORDER_NOT_SERVED,
        HTTP_STATUS.CONFLICT,
        "ORDER_NOT_SERVED",
      );
    }

    if (error instanceof Error && error.message === "INVALID_AMOUNT") {
      throw new AppError(
        PAYMENT_MESSAGES.INVALID_AMOUNT,
        HTTP_STATUS.CONFLICT,
        "INVALID_PAYMENT_AMOUNT",
      );
    }

    throw error;
  }

  const safeOrder = toSafeOrder(result.order);
  const payload = {
    orderId: safeOrder.id,
    orderNumber: safeOrder.orderNumber,
    status: safeOrder.orderStatus,
    orderStatus: safeOrder.orderStatus,
    paymentStatus: safeOrder.paymentStatus,
    paidAmount: safeOrder.paidAmount,
    remainingAmount: safeOrder.remainingAmount,
    changedAt: new Date().toISOString(),
  };

  if (!result.duplicated) {
    publishOrderPaymentUpdated(result.order.guestSession.uuid, payload);

    if (safeOrder.orderStatus === OrderStatus.COMPLETED) {
      publishOrderCompleted(result.order.guestSession.uuid, payload);
    }

    if (result.sessionClosed) {
      const changedAt = new Date().toISOString();
      publishGuestSessionClosed({
        guestSessionId: result.order.guestSession.uuid,
        tableId: result.order.restaurantTable?.uuid,
        changedAt,
      });

      if (result.order.restaurantTable) {
        publishTableReleased({
          tableId: result.order.restaurantTable.uuid,
          tableNumber: result.order.restaurantTable.tableNumber,
          guestSessionId: result.order.guestSession.uuid,
          changedAt,
        });
      }
    }
  }

  return {
    payment: toSafePayment(result.payment),
    order: safeOrder,
    duplicated: result.duplicated === true,
    sessionClosed: result.sessionClosed,
    receiptRawToken: result.receiptRawToken,
  };
}

export async function reverseOrderPayment(
  paymentId: string,
  input: ReversePaymentInput,
  voidedByUserId: bigint,
) {
  const payment = await findPaymentByUuid(paymentId);

  if (payment === null) {
    throw new AppError(
      PAYMENT_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "PAYMENT_NOT_FOUND",
    );
  }

  let result;

  try {
    result = await reversePaymentTransaction({
      paymentId: payment.id,
      reason: input.reason,
      voidedByUserId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYMENT_ALREADY_VOIDED") {
      throw new AppError(
        PAYMENT_MESSAGES.ALREADY_VOIDED,
        HTTP_STATUS.CONFLICT,
        "PAYMENT_ALREADY_VOIDED",
      );
    }

    if (error instanceof Error && error.message === "PAYMENT_NOT_REVERSIBLE") {
      throw new AppError(
        PAYMENT_MESSAGES.NOT_REVERSIBLE,
        HTTP_STATUS.CONFLICT,
        "PAYMENT_NOT_REVERSIBLE",
      );
    }

    throw error;
  }

  const safeOrder = toSafeOrder(result.order);
  const payload = {
    orderId: safeOrder.id,
    orderNumber: safeOrder.orderNumber,
    status: safeOrder.orderStatus,
    orderStatus: safeOrder.orderStatus,
    paymentStatus: safeOrder.paymentStatus,
    paidAmount: safeOrder.paidAmount,
    remainingAmount: safeOrder.remainingAmount,
    changedAt: new Date().toISOString(),
  };

  publishOrderPaymentUpdated(result.order.guestSession.uuid, payload);
  publishOrderStatusUpdated(result.order.guestSession.uuid, payload);

  return {
    payment: toSafePayment(result.payment),
    order: safeOrder,
  };
}
