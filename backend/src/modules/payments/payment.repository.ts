import { randomBytes } from "node:crypto";

import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import {
  GuestSessionClosureType,
  OrderPaymentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "../../generated/prisma/enums.js";
import { AUDIT_ACTIONS, writeAuditLog } from "../audit/audit.service.js";
import { closeGuestSessionIfSafeInTx } from "../guest-sessions/session-close.js";
import {
  derivePaymentStatus,
  paidAmountFromPayments,
} from "../guest-sessions/session-lifecycle.js";
import { orderInclude } from "../orders/order.repository.js";

function generatePaymentNumber(): string {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `PAY-${stamp}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function findPaymentByUuid(uuid: string) {
  return prisma.payment.findUnique({
    where: { uuid },
    include: {
      order: {
        select: { uuid: true },
      },
    },
  });
}

export function findPaymentByIdempotencyKey(idempotencyKey: string) {
  return prisma.payment.findUnique({
    where: { idempotencyKey },
    include: {
      order: {
        select: { uuid: true },
      },
    },
  });
}

export function listPayments() {
  return prisma.payment.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      order: {
        select: { uuid: true },
      },
    },
  });
}

export function listPaymentsForOrder(orderId: bigint) {
  return prisma.payment.findMany({
    where: { orderId },
    orderBy: [{ createdAt: "desc" }],
    include: {
      order: {
        select: { uuid: true },
      },
    },
  });
}

export async function createPaymentTransaction(options: {
  orderId: bigint;
  amount: Prisma.Decimal;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  receivedByUserId: bigint;
  idempotencyKey: string | null;
}) {
  return prisma.$transaction(
    async (tx) => {
    if (options.idempotencyKey) {
      const existing = await tx.payment.findUnique({
        where: { idempotencyKey: options.idempotencyKey },
        include: {
          order: { include: orderInclude },
        },
      });

      if (existing !== null) {
        const fullOrder = await tx.order.findUniqueOrThrow({
          where: { id: existing.orderId },
          include: orderInclude,
        });

        return {
          payment: existing,
          order: fullOrder,
          sessionClosed: false,
          receiptRawToken: null as string | null,
          duplicated: true,
        };
      }
    }

    // Row lock via conditional update (FOR UPDATE is unreliable with the MariaDB adapter).
    const locked = await tx.order.updateMany({
      where: {
        id: options.orderId,
        status: OrderStatus.SERVED,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    if (locked.count !== 1) {
      throw new Error("ORDER_NOT_SERVED");
    }

    const order = await tx.order.findUniqueOrThrow({
      where: { id: options.orderId },
      include: {
        payments: true,
        guestSession: true,
      },
    });

    const paidSoFar = paidAmountFromPayments(order.payments);
    const remaining = order.totalAmount.minus(paidSoFar);

    if (options.amount.lte(0) || options.amount.gt(remaining)) {
      throw new Error("INVALID_AMOUNT");
    }

    const now = new Date();

    const payment = await tx.payment.create({
      data: {
        paymentNumber: generatePaymentNumber(),
        orderId: order.id,
        receivedByUserId: options.receivedByUserId,
        amount: options.amount,
        method: options.method,
        status: PaymentStatus.COMPLETED,
        reference: options.reference,
        notes: options.notes,
        idempotencyKey: options.idempotencyKey,
        paidAt: now,
      },
      include: {
        order: {
          select: { uuid: true },
        },
      },
    });

    const newPaid = paidSoFar.plus(options.amount);
    const paymentStatus = derivePaymentStatus(order.totalAmount, newPaid);
    let nextOrderStatus: OrderStatus = order.status;
    let completedAt: Date | undefined;

    if (
      paymentStatus === OrderPaymentStatus.PAID &&
      order.status === OrderStatus.SERVED
    ) {
      nextOrderStatus = OrderStatus.COMPLETED;
      completedAt = now;
    }

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus,
        status: nextOrderStatus,
        ...(completedAt !== undefined && { completedAt }),
      },
      include: orderInclude,
    });

    if (nextOrderStatus === OrderStatus.COMPLETED) {
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          changedByUserId: options.receivedByUserId,
          fromStatus: OrderStatus.SERVED,
          toStatus: OrderStatus.COMPLETED,
          reason: "Order fully paid.",
        },
      });
    }

    await writeAuditLog({
      tx,
      action: AUDIT_ACTIONS.PAYMENT_CREATED,
      actorUserId: options.receivedByUserId,
      entityType: "payment",
      entityId: payment.uuid,
      newValues: {
        orderId: order.uuid,
        amount: options.amount.toFixed(2),
        method: options.method,
        paymentStatus,
        orderStatus: nextOrderStatus,
      },
    });

    let sessionClosed = false;
    let receiptRawToken: string | null = null;

    if (paymentStatus === OrderPaymentStatus.PAID) {
      const closeResult = await closeGuestSessionIfSafeInTx(
        tx,
        order.guestSessionId,
        {
          closureType: GuestSessionClosureType.CLOSED,
          closedByUserId: options.receivedByUserId,
          reason: "All session orders settled.",
        },
      );
      sessionClosed = closeResult.closed;
      receiptRawToken = closeResult.receiptRawToken;

      if (sessionClosed) {
        await writeAuditLog({
          tx,
          action: AUDIT_ACTIONS.GUEST_SESSION_CLOSED,
          actorUserId: options.receivedByUserId,
          actorGuestSessionId: order.guestSessionId,
          entityType: "guest_session",
          entityId: order.guestSession.uuid,
          reason: "All session orders settled.",
        });
      }
    }

    return {
      payment,
      order: updatedOrder,
      sessionClosed,
      receiptRawToken,
      duplicated: false,
    };
  },
  {
    maxWait: 5_000,
    timeout: 15_000,
  },
  );
}

export async function reversePaymentTransaction(options: {
  paymentId: bigint;
  reason: string;
  voidedByUserId: bigint;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM payments WHERE id = ${options.paymentId} FOR UPDATE`;

    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: options.paymentId },
    });

    if (payment.voidedAt !== null || payment.status === PaymentStatus.REFUNDED) {
      throw new Error("PAYMENT_ALREADY_VOIDED");
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new Error("PAYMENT_NOT_REVERSIBLE");
    }

    await tx.$executeRaw`SELECT id FROM orders WHERE id = ${payment.orderId} FOR UPDATE`;

    const now = new Date();

    const voidedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.REFUNDED,
        voidedAt: now,
        refundedAt: now,
        voidReason: options.reason,
        voidedByUserId: options.voidedByUserId,
      },
      include: {
        order: { select: { uuid: true } },
      },
    });

    const order = await tx.order.findUniqueOrThrow({
      where: { id: payment.orderId },
      include: { payments: true, guestSession: true },
    });

    const paidAmount = paidAmountFromPayments(order.payments.map((p) =>
      p.id === payment.id
        ? { ...p, voidedAt: now, status: PaymentStatus.REFUNDED }
        : p,
    ));
    const paymentStatus = derivePaymentStatus(order.totalAmount, paidAmount);

    let nextStatus = order.status;
    let completedAt: Date | null | undefined = undefined;

    if (
      order.status === OrderStatus.COMPLETED &&
      paymentStatus !== OrderPaymentStatus.PAID
    ) {
      nextStatus = OrderStatus.SERVED;
      completedAt = null;

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          changedByUserId: options.voidedByUserId,
          fromStatus: OrderStatus.COMPLETED,
          toStatus: OrderStatus.SERVED,
          reason: `Payment reversed: ${options.reason}`,
        },
      });
    }

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus,
        status: nextStatus,
        ...(completedAt === null && { completedAt: null }),
      },
      include: orderInclude,
    });

    await writeAuditLog({
      tx,
      action: AUDIT_ACTIONS.PAYMENT_REVERSED,
      actorUserId: options.voidedByUserId,
      entityType: "payment",
      entityId: payment.uuid,
      reason: options.reason,
      previousValues: {
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
      },
      newValues: {
        orderStatus: nextStatus,
        paymentStatus,
      },
    });

    return { payment: voidedPayment, order: updatedOrder };
  });
}
