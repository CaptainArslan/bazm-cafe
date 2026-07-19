import { randomBytes } from "node:crypto";

import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import {
  CustomerType,
  OrderPaymentStatus,
  OrderStatus,
  PaymentStatus,
  StockMovementType,
} from "../../generated/prisma/enums.js";
import { AUDIT_ACTIONS, writeAuditLog } from "../audit/audit.service.js";

export const orderInclude = {
  restaurantTable: {
    select: { uuid: true, tableNumber: true },
  },
  customer: {
    select: { uuid: true, name: true, phone: true },
  },
  guestSession: {
    select: { id: true, uuid: true },
  },
  items: {
    select: {
      productName: true,
      productPrice: true,
      quantity: true,
      lineSubtotal: true,
      customerNotes: true,
      estimatedMinutes: true,
      productId: true,
      id: true,
      product: {
        select: { uuid: true },
      },
    },
  },
  payments: {
    where: {
      status: PaymentStatus.COMPLETED,
      voidedAt: null,
    },
    select: { amount: true, status: true, voidedAt: true },
  },
} as const;

function generateCode(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}

export function findOrderByUuid(uuid: string) {
  return prisma.order.findFirst({
    where: { uuid, deletedAt: null },
    include: orderInclude,
  });
}

export function listOrders(filters: {
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  guestSessionId?: bigint;
}) {
  return prisma.order.findMany({
    where: {
      deletedAt: null,
      ...(filters.status !== undefined && { status: filters.status }),
      ...(filters.paymentStatus !== undefined && {
        paymentStatus: filters.paymentStatus,
      }),
      ...(filters.guestSessionId !== undefined && {
        guestSessionId: filters.guestSessionId,
      }),
    },
    orderBy: [{ createdAt: "desc" }],
    include: orderInclude,
  });
}

export async function createGuestOrderTransaction(input: {
  guestSessionId: bigint;
  restaurantTableId: bigint | null;
  customerId: bigint | null;
  customerType: CustomerType;
  customerName: string | null;
  customerPhone: string | null;
  customerNotes: string | null;
  estimatedReadyAt: Date | null;
  items: Array<{
    productId: bigint;
    productName: string;
    productPrice: Prisma.Decimal;
    quantity: number;
    lineSubtotal: Prisma.Decimal;
    customerNotes?: string;
    estimatedMinutes: number;
  }>;
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  serviceChargeAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
}) {
  return prisma.$transaction(async (tx) => {
    const lockedProducts = [];

    for (const item of input.items) {
      const product = await tx.product.findUniqueOrThrow({
        where: { id: item.productId },
      });

      const available = product.stockQuantity - product.reservedQuantity;

      if (
        !product.isAvailable ||
        product.deletedAt !== null ||
        (product.trackStock && available < item.quantity)
      ) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      lockedProducts.push({ product, item });
    }

    const order = await tx.order.create({
      data: {
        orderNumber: generateCode("ORD"),
        billNumber: generateCode("BILL"),
        guestSessionId: input.guestSessionId,
        restaurantTableId: input.restaurantTableId,
        customerId: input.customerId,
        customerType: input.customerType,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerNotes: input.customerNotes,
        estimatedReadyAt: input.estimatedReadyAt,
        subtotal: input.subtotal,
        taxAmount: input.taxAmount,
        serviceChargeAmount: input.serviceChargeAmount,
        totalAmount: input.totalAmount,
        status: OrderStatus.PENDING,
        paymentStatus: OrderPaymentStatus.UNPAID,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            productPrice: item.productPrice,
            quantity: item.quantity,
            lineSubtotal: item.lineSubtotal,
            customerNotes: item.customerNotes,
            estimatedMinutes: item.estimatedMinutes,
          })),
        },
        statusHistories: {
          create: {
            toStatus: OrderStatus.PENDING,
            reason: "Order submitted by guest.",
          },
        },
      },
      include: orderInclude,
    });

    if (input.customerId !== null) {
      await tx.guestSession.update({
        where: { id: input.guestSessionId },
        data: { customerId: input.customerId },
      });
    }

    for (const createdItem of order.items) {
      if (createdItem.productId === null) {
        continue;
      }

      const matched = lockedProducts.find(
        (entry) => entry.product.id === createdItem.productId,
      );

      if (matched === undefined) {
        continue;
      }

      const reservedAfter =
        matched.product.reservedQuantity + createdItem.quantity;

      await tx.product.update({
        where: { id: matched.product.id },
        data: { reservedQuantity: reservedAfter },
      });

      await tx.stockMovement.create({
        data: {
          productId: matched.product.id,
          orderId: order.id,
          orderItemId: createdItem.id,
          type: StockMovementType.RESERVED,
          quantity: createdItem.quantity,
          stockBefore: matched.product.stockQuantity,
          stockAfter: matched.product.stockQuantity,
          reservedBefore: matched.product.reservedQuantity,
          reservedAfter,
        },
      });

      matched.product.reservedQuantity = reservedAfter;
    }

    return order;
  });
}

export async function transitionOrderTransaction(options: {
  orderId: bigint;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  changedByUserId: bigint;
  reason?: string;
  customerId?: bigint;
  customerName?: string | null;
  customerPhone?: string | null;
  releaseReservation?: boolean;
  consumeReservation?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: options.orderId },
      include: { items: true, guestSession: true },
    });

    if (order.status !== options.fromStatus) {
      throw new Error("INVALID_TRANSITION");
    }

    if (options.consumeReservation === true) {
      for (const item of order.items) {
        if (item.productId === null) {
          continue;
        }

        const product = await tx.product.findUniqueOrThrow({
          where: { id: item.productId },
        });

        if (
          product.reservedQuantity < item.quantity ||
          product.stockQuantity < item.quantity
        ) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        const stockAfter = product.stockQuantity - item.quantity;
        const reservedAfter = product.reservedQuantity - item.quantity;

        await tx.product.update({
          where: { id: product.id },
          data: {
            stockQuantity: stockAfter,
            reservedQuantity: reservedAfter,
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            orderId: order.id,
            orderItemId: item.id,
            createdByUserId: options.changedByUserId,
            type: StockMovementType.CONSUMED,
            quantity: item.quantity,
            stockBefore: product.stockQuantity,
            stockAfter,
            reservedBefore: product.reservedQuantity,
            reservedAfter,
          },
        });
      }
    }

    if (options.releaseReservation === true) {
      for (const item of order.items) {
        if (item.productId === null) {
          continue;
        }

        const product = await tx.product.findUniqueOrThrow({
          where: { id: item.productId },
        });

        const reservedAfter = Math.max(
          0,
          product.reservedQuantity - item.quantity,
        );

        await tx.product.update({
          where: { id: product.id },
          data: { reservedQuantity: reservedAfter },
        });

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            orderId: order.id,
            orderItemId: item.id,
            createdByUserId: options.changedByUserId,
            type: StockMovementType.RESERVATION_RELEASED,
            quantity: item.quantity,
            stockBefore: product.stockQuantity,
            stockAfter: product.stockQuantity,
            reservedBefore: product.reservedQuantity,
            reservedAfter,
            notes: options.reason,
          },
        });
      }
    }

    const now = new Date();

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: options.toStatus,
        ...(options.customerId !== undefined && {
          customerId: options.customerId,
        }),
        ...(options.customerName !== undefined && {
          customerName: options.customerName,
        }),
        ...(options.customerPhone !== undefined && {
          customerPhone: options.customerPhone,
        }),
        ...(options.toStatus === OrderStatus.ACCEPTED && { acceptedAt: now }),
        ...(options.toStatus === OrderStatus.PREPARING && { preparingAt: now }),
        ...(options.toStatus === OrderStatus.READY && { readyAt: now }),
        ...(options.toStatus === OrderStatus.SERVED && { servedAt: now }),
        ...(options.toStatus === OrderStatus.COMPLETED && { completedAt: now }),
        ...(options.toStatus === OrderStatus.REJECTED && {
          rejectedAt: now,
          rejectionReason: options.reason,
        }),
        ...(options.toStatus === OrderStatus.CANCELLED && {
          cancelledAt: now,
          cancellationReason: options.reason,
        }),
      },
      include: orderInclude,
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        changedByUserId: options.changedByUserId,
        fromStatus: options.fromStatus,
        toStatus: options.toStatus,
        reason: options.reason,
      },
    });

    return updated;
  });
}

export async function attachCustomerToOrderTransaction(options: {
  orderId: bigint;
  guestSessionId: bigint;
  customerId: bigint;
  customerName: string;
  customerPhone: string | null;
  actorUserId: bigint;
  orderUuid: string;
}) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: options.orderId },
      data: {
        customerId: options.customerId,
        customerName: options.customerName,
        customerPhone: options.customerPhone,
      },
      include: orderInclude,
    });

    await tx.guestSession.update({
      where: { id: options.guestSessionId },
      data: { customerId: options.customerId },
    });

    await writeAuditLog({
      tx,
      action: AUDIT_ACTIONS.CUSTOMER_ATTACHED,
      actorUserId: options.actorUserId,
      entityType: "order",
      entityId: options.orderUuid,
      newValues: {
        customerId: updated.customer?.uuid ?? null,
        customerName: options.customerName,
        customerPhone: options.customerPhone,
        guestSessionId: updated.guestSession.uuid,
      },
    });

    return updated;
  });
}

export function updateOrderReceiptPath(
  orderId: bigint,
  receiptImagePath: string,
) {
  return prisma.order.update({
    where: { id: orderId },
    data: { receiptImagePath },
    include: orderInclude,
  });
}
