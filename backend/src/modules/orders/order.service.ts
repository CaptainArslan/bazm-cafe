import { env } from "../../config/environment.js";
import { HTTP_STATUS } from "../../constants/http-status.js";
import { AppError } from "../../errors/app-error.js";
import { Prisma } from "../../generated/prisma/client.js";
import {
  CustomerType,
  OrderPaymentStatus,
  OrderStatus,
  PaymentStatus,
} from "../../generated/prisma/enums.js";
import {
  publishOrderAccepted,
  publishOrderCancelled,
  publishOrderCreated,
  publishOrderRejected,
  publishOrderStatusUpdated,
} from "../../realtime/realtime.publisher.js";
import type { OrderSocketPayload } from "../../realtime/socket.constants.js";
import { money, percentOf, sumMoney, toMoneyString } from "../../utils/money.js";
import { generateReceiptImage } from "../../utils/receipt-image.js";
import { AUDIT_ACTIONS, writeAuditLog } from "../audit/audit.service.js";
import {
  createCustomer,
  findCustomerById,
  findCustomerByUuid,
  findCustomersByPhone,
} from "../customers/customer.repository.js";
import type { GuestSessionContext } from "../guest-sessions/guest-session.types.js";
import {
  formatOutstanding,
  paidAmountFromPayments,
  type SessionOrderSnapshot,
} from "../guest-sessions/session-lifecycle.js";
import { findProductByUuid } from "../products/product.repository.js";
import { getCafeChargeRates } from "../settings/settings.service.js";
import { ORDER_MESSAGES } from "./order.constants.js";
import {
  attachCustomerToOrderTransaction,
  createGuestOrderTransaction,
  findOrderByUuid,
  listOrders,
  transitionOrderTransaction,
  updateOrderReceiptPath,
} from "./order.repository.js";
import type { SafeOrder } from "./order.types.js";
import type {
  AttachCustomerInput,
  CancelOrderInput,
  CreateGuestOrderInput,
  ListOrdersQuery,
  RejectOrderInput,
} from "./order.validation.js";

export { formatOutstanding };

function maxEstimatedMinutes(
  items: Array<{ estimatedMinutes: number }>,
): number {
  if (items.length === 0) {
    return 0;
  }

  return Math.max(...items.map((item) => item.estimatedMinutes));
}

export function toSafeOrder(order: {
  uuid: string;
  orderNumber: string;
  billNumber: string;
  customerType: CustomerType;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  customerName: string | null;
  customerPhone: string | null;
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  serviceChargeAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  estimatedReadyAt: Date | null;
  customerNotes: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  receiptImagePath: string | null;
  acceptedAt: Date | null;
  preparingAt: Date | null;
  readyAt: Date | null;
  servedAt: Date | null;
  completedAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  restaurantTable: { uuid: string; tableNumber: string } | null;
  customer: { uuid: string } | null;
  guestSession?: { uuid: string };
  items: Array<{
    productName: string;
    productPrice: Prisma.Decimal;
    quantity: number;
    lineSubtotal: Prisma.Decimal;
    customerNotes: string | null;
    estimatedMinutes: number;
    product: { uuid: string } | null;
  }>;
  payments: Array<{
    amount: Prisma.Decimal;
    status: PaymentStatus;
    voidedAt: Date | null;
  }>;
}): SafeOrder {
  const paidAmount = paidAmountFromPayments(order.payments);
  const remainingAmount = order.totalAmount.minus(paidAmount);
  const estimatedPreparationMinutes = maxEstimatedMinutes(order.items);

  return {
    id: order.uuid,
    orderNumber: order.orderNumber,
    billNumber: order.billNumber,
    orderType: order.customerType,
    orderStatus: order.status,
    paymentStatus: order.paymentStatus,
    tableId: order.restaurantTable?.uuid ?? null,
    tableNumber: order.restaurantTable?.tableNumber ?? null,
    customerId: order.customer?.uuid ?? null,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    subtotal: toMoneyString(order.subtotal),
    taxAmount: toMoneyString(order.taxAmount),
    serviceChargeAmount: toMoneyString(order.serviceChargeAmount),
    discountAmount: toMoneyString(order.discountAmount),
    totalAmount: toMoneyString(order.totalAmount),
    paidAmount: toMoneyString(paidAmount),
    remainingAmount: toMoneyString(remainingAmount),
    estimatedPreparationMinutes,
    estimatedReadyAt: order.estimatedReadyAt,
    customerNotes: order.customerNotes,
    rejectionReason: order.rejectionReason,
    cancellationReason: order.cancellationReason,
    receiptImagePath: order.receiptImagePath,
    receiptImageUrl:
      order.receiptImagePath === null
        ? null
        : `${env.APP_URL}${order.receiptImagePath}`,
    items: order.items.map((item) => {
      const productNameSnapshot = item.productName;
      const unitPriceSnapshot = toMoneyString(item.productPrice);

      return {
        productId: item.product?.uuid ?? null,
        productNameSnapshot,
        name: productNameSnapshot,
        unitPriceSnapshot,
        unitPrice: unitPriceSnapshot,
        preparationTimeMinutesSnapshot: item.estimatedMinutes,
        quantity: item.quantity,
        lineTotal: toMoneyString(item.lineSubtotal),
        notes: item.customerNotes,
      };
    }),
    acceptedAt: order.acceptedAt,
    preparingAt: order.preparingAt,
    readyAt: order.readyAt,
    servedAt: order.servedAt,
    completedAt: order.completedAt,
    rejectedAt: order.rejectedAt,
    cancelledAt: order.cancelledAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function toOrderSocketPayload(
  safe: SafeOrder,
  extras?: Partial<OrderSocketPayload>,
): OrderSocketPayload {
  return {
    orderId: safe.id,
    orderNumber: safe.orderNumber,
    status: safe.orderStatus,
    orderStatus: safe.orderStatus,
    paymentStatus: safe.paymentStatus,
    paidAmount: safe.paidAmount,
    remainingAmount: safe.remainingAmount,
    changedAt: new Date().toISOString(),
    ...extras,
  };
}

async function generateReceiptAfterCommit(orderUuid: string): Promise<void> {
  try {
    const order = await findOrderByUuid(orderUuid);

    if (order === null) {
      return;
    }

    const safe = toSafeOrder(order);
    const receiptImagePath = await generateReceiptImage({
      orderUuid: order.uuid,
      orderNumber: order.orderNumber,
      orderType: order.customerType,
      tableNumber: order.restaurantTable?.tableNumber,
      customerName: order.customerName,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      items: safe.items.map((item) => ({
        name: item.productNameSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPriceSnapshot,
        lineTotal: item.lineTotal,
      })),
      totalAmount: safe.totalAmount,
      paidAmount: safe.paidAmount,
      remainingAmount: safe.remainingAmount,
    });

    await updateOrderReceiptPath(order.id, receiptImagePath);
  } catch {
    // Receipt failure must not roll back a valid order.
  }
}

function assertOrder(order: Awaited<ReturnType<typeof findOrderByUuid>>) {
  if (order === null) {
    throw new AppError(
      ORDER_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "ORDER_NOT_FOUND",
    );
  }

  return order;
}

async function writeOrderTransitionAudit(options: {
  action: string;
  actorUserId: bigint;
  orderUuid: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  reason?: string;
}) {
  await writeAuditLog({
    action: options.action,
    actorUserId: options.actorUserId,
    entityType: "order",
    entityId: options.orderUuid,
    previousValues: { orderStatus: options.fromStatus },
    newValues: { orderStatus: options.toStatus },
    reason: options.reason ?? null,
  });
}

export async function createGuestOrder(
  guestSession: GuestSessionContext,
  input: CreateGuestOrderInput,
): Promise<SafeOrder> {
  if (guestSession.closedAt !== null || guestSession.expiresAt <= new Date()) {
    throw new AppError(
      ORDER_MESSAGES.SESSION_INACTIVE,
      HTTP_STATUS.UNAUTHORIZED,
      "GUEST_SESSION_INACTIVE",
    );
  }

  let customerId = guestSession.customerDatabaseId;
  let customerName: string | null = null;
  let customerPhone: string | null = null;

  if (customerId !== null) {
    const existingCustomer = await findCustomerById(customerId);

    if (existingCustomer !== null) {
      customerName = existingCustomer.name;
      customerPhone = existingCustomer.phone;
    } else {
      customerId = null;
    }
  }

  if (guestSession.orderType === CustomerType.TAKEAWAY) {
    if (
      input.customerName === undefined ||
      input.customerPhone === undefined
    ) {
      throw new AppError(
        "Takeaway orders require customer name and phone.",
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        "TAKEAWAY_CUSTOMER_REQUIRED",
      );
    }

    const matched = await findCustomersByPhone(input.customerPhone);
    const customer =
      matched[0] ??
      (await createCustomer({
        name: input.customerName,
        phone: input.customerPhone,
      }));

    customerId = customer.id;
    customerName = customer.name;
    customerPhone = customer.phone;
  }

  const lineItems = [];

  for (const item of input.items) {
    const product = await findProductByUuid(item.productId);

    if (
      product === null ||
      !product.isAvailable ||
      product.category.deletedAt !== null ||
      !product.category.isVisible
    ) {
      throw new AppError(
        ORDER_MESSAGES.PRODUCT_UNAVAILABLE,
        HTTP_STATUS.CONFLICT,
        "PRODUCT_UNAVAILABLE",
      );
    }

    const available = product.stockQuantity - product.reservedQuantity;

    if (product.trackStock && available < item.quantity) {
      throw new AppError(
        ORDER_MESSAGES.INSUFFICIENT_STOCK,
        HTTP_STATUS.CONFLICT,
        "INSUFFICIENT_STOCK",
      );
    }

    lineItems.push({
      productId: product.id,
      productName: product.name,
      productPrice: money(product.price),
      quantity: item.quantity,
      lineSubtotal: money(product.price).mul(item.quantity),
      customerNotes: item.notes,
      estimatedMinutes: product.preparationMinutes,
    });
  }

  const prepMinutes = maxEstimatedMinutes(lineItems);
  const now = new Date();
  const estimatedReadyAt =
    prepMinutes > 0
      ? new Date(now.getTime() + prepMinutes * 60 * 1000)
      : now;

  const subtotal = sumMoney(lineItems.map((item) => item.lineSubtotal));
  const { taxRatePercent, serviceChargePercent } = await getCafeChargeRates();
  const taxAmount = percentOf(subtotal, taxRatePercent);
  const serviceChargeAmount = percentOf(subtotal, serviceChargePercent);
  const totalAmount = sumMoney([subtotal, taxAmount, serviceChargeAmount]);

  let order;

  try {
    order = await createGuestOrderTransaction({
      guestSessionId: guestSession.databaseId,
      restaurantTableId: guestSession.restaurantTableDatabaseId,
      customerId,
      customerType: guestSession.orderType,
      customerName,
      customerPhone,
      customerNotes: input.customerNotes ?? null,
      estimatedReadyAt,
      items: lineItems,
      subtotal,
      taxAmount,
      serviceChargeAmount,
      totalAmount,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      throw new AppError(
        ORDER_MESSAGES.INSUFFICIENT_STOCK,
        HTTP_STATUS.CONFLICT,
        "INSUFFICIENT_STOCK",
      );
    }

    throw error;
  }

  const safe = toSafeOrder(order);

  publishOrderCreated(
    toOrderSocketPayload(safe, {
      summary: `${safe.items.length} item(s)`,
    }),
  );

  void generateReceiptAfterCommit(order.uuid);

  return safe;
}

export async function listGuestOrders(guestSessionId: bigint) {
  const orders = await listOrders({ guestSessionId });
  return orders.map(toSafeOrder);
}

export async function getGuestSessionOutstanding(
  guestSessionId: bigint,
): Promise<string> {
  const orders = await listOrders({ guestSessionId });
  const snapshots: SessionOrderSnapshot[] = orders.map((order) => ({
    status: order.status,
    paymentStatus: order.paymentStatus,
    totalAmount: order.totalAmount,
    payments: order.payments,
  }));

  return formatOutstanding(snapshots);
}

export async function getGuestOrder(
  guestSessionId: bigint,
  orderPublicId: string,
) {
  const order = assertOrder(await findOrderByUuid(orderPublicId));

  if (order.guestSessionId !== guestSessionId) {
    throw new AppError(
      ORDER_MESSAGES.FORBIDDEN_GUEST_ORDER,
      HTTP_STATUS.FORBIDDEN,
      "FORBIDDEN_GUEST_ORDER",
    );
  }

  return toSafeOrder(order);
}

export async function listStaffOrders(query: ListOrdersQuery) {
  const orders = await listOrders({
    ...(query.status !== undefined && { status: query.status }),
    ...(query.paymentStatus !== undefined && {
      paymentStatus: query.paymentStatus,
    }),
  });

  return orders.map(toSafeOrder);
}

export async function getStaffOrder(orderId: string) {
  return toSafeOrder(assertOrder(await findOrderByUuid(orderId)));
}

async function transitionOrderStatus(
  orderId: string,
  toStatus: OrderStatus,
  changedByUserId: bigint,
  options?: {
    reason?: string;
    releaseReservation?: boolean;
    consumeReservation?: boolean;
    auditAction?: string;
  },
) {
  const order = assertOrder(await findOrderByUuid(orderId));

  const transitions: Partial<Record<OrderStatus, OrderStatus>> = {
    [OrderStatus.PENDING]: OrderStatus.ACCEPTED,
    [OrderStatus.ACCEPTED]: OrderStatus.PREPARING,
    [OrderStatus.PREPARING]: OrderStatus.READY,
    [OrderStatus.READY]: OrderStatus.SERVED,
  };

  const expected = transitions[order.status];

  if (expected !== toStatus) {
    throw new AppError(
      ORDER_MESSAGES.INVALID_TRANSITION,
      HTTP_STATUS.CONFLICT,
      "INVALID_ORDER_TRANSITION",
    );
  }

  if (toStatus === OrderStatus.SERVED) {
    const hasCustomer =
      order.customerId !== null ||
      (order.customerName !== null && order.customerName.length > 0);

    if (order.customerType === CustomerType.DINE_IN && !hasCustomer) {
      throw new AppError(
        ORDER_MESSAGES.CUSTOMER_REQUIRED,
        HTTP_STATUS.CONFLICT,
        "CUSTOMER_REQUIRED_BEFORE_SERVED",
      );
    }
  }

  let updated;

  try {
    updated = await transitionOrderTransaction({
      orderId: order.id,
      fromStatus: order.status,
      toStatus,
      changedByUserId,
      reason: options?.reason,
      consumeReservation: options?.consumeReservation === true,
      releaseReservation: options?.releaseReservation === true,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_TRANSITION") {
      throw new AppError(
        ORDER_MESSAGES.INVALID_TRANSITION,
        HTTP_STATUS.CONFLICT,
        "INVALID_ORDER_TRANSITION",
      );
    }

    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      throw new AppError(
        ORDER_MESSAGES.INSUFFICIENT_STOCK,
        HTTP_STATUS.CONFLICT,
        "INSUFFICIENT_STOCK",
      );
    }

    throw error;
  }

  await writeOrderTransitionAudit({
    action:
      options?.auditAction ??
      (toStatus === OrderStatus.ACCEPTED
        ? AUDIT_ACTIONS.ORDER_ACCEPTED
        : AUDIT_ACTIONS.ORDER_STATUS_TRANSITION),
    actorUserId: changedByUserId,
    orderUuid: order.uuid,
    fromStatus: order.status,
    toStatus,
    reason: options?.reason,
  });

  const safe = toSafeOrder(updated);
  const payload = toOrderSocketPayload(safe);

  if (toStatus === OrderStatus.ACCEPTED) {
    publishOrderAccepted(updated.guestSession.uuid, payload);
  } else {
    publishOrderStatusUpdated(updated.guestSession.uuid, payload);
  }

  return safe;
}

export async function acceptOrder(orderId: string, changedByUserId: bigint) {
  return transitionOrderStatus(orderId, OrderStatus.ACCEPTED, changedByUserId, {
    consumeReservation: true,
    auditAction: AUDIT_ACTIONS.ORDER_ACCEPTED,
  });
}

export async function startPreparingOrder(
  orderId: string,
  changedByUserId: bigint,
) {
  return transitionOrderStatus(
    orderId,
    OrderStatus.PREPARING,
    changedByUserId,
    { auditAction: AUDIT_ACTIONS.ORDER_STATUS_TRANSITION },
  );
}

export async function markOrderReady(
  orderId: string,
  changedByUserId: bigint,
) {
  return transitionOrderStatus(orderId, OrderStatus.READY, changedByUserId, {
    auditAction: AUDIT_ACTIONS.ORDER_STATUS_TRANSITION,
  });
}

export async function markOrderServed(
  orderId: string,
  changedByUserId: bigint,
) {
  return transitionOrderStatus(orderId, OrderStatus.SERVED, changedByUserId, {
    auditAction: AUDIT_ACTIONS.ORDER_STATUS_TRANSITION,
  });
}

export async function rejectOrder(
  orderId: string,
  input: RejectOrderInput,
  changedByUserId: bigint,
) {
  const order = assertOrder(await findOrderByUuid(orderId));

  if (order.status !== OrderStatus.PENDING) {
    throw new AppError(
      ORDER_MESSAGES.INVALID_TRANSITION,
      HTTP_STATUS.CONFLICT,
      "INVALID_ORDER_TRANSITION",
    );
  }

  const updated = await transitionOrderTransaction({
    orderId: order.id,
    fromStatus: OrderStatus.PENDING,
    toStatus: OrderStatus.REJECTED,
    changedByUserId,
    reason: input.reason,
    releaseReservation: true,
  });

  await writeOrderTransitionAudit({
    action: AUDIT_ACTIONS.ORDER_REJECTED,
    actorUserId: changedByUserId,
    orderUuid: order.uuid,
    fromStatus: OrderStatus.PENDING,
    toStatus: OrderStatus.REJECTED,
    reason: input.reason,
  });

  const safe = toSafeOrder(updated);

  publishOrderRejected(
    updated.guestSession.uuid,
    toOrderSocketPayload(safe, { summary: input.reason }),
  );

  return safe;
}

export async function cancelOrder(
  orderId: string,
  input: CancelOrderInput,
  changedByUserId: bigint,
) {
  const order = assertOrder(await findOrderByUuid(orderId));

  const cancellable: OrderStatus[] = [
    OrderStatus.ACCEPTED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
  ];

  if (!cancellable.includes(order.status)) {
    throw new AppError(
      ORDER_MESSAGES.INVALID_TRANSITION,
      HTTP_STATUS.CONFLICT,
      "INVALID_ORDER_TRANSITION",
    );
  }

  const fromStatus = order.status;

  const updated = await transitionOrderTransaction({
    orderId: order.id,
    fromStatus,
    toStatus: OrderStatus.CANCELLED,
    changedByUserId,
    reason: input.reason,
  });

  await writeOrderTransitionAudit({
    action: AUDIT_ACTIONS.ORDER_CANCELLED,
    actorUserId: changedByUserId,
    orderUuid: order.uuid,
    fromStatus,
    toStatus: OrderStatus.CANCELLED,
    reason: input.reason,
  });

  const safe = toSafeOrder(updated);

  publishOrderCancelled(
    updated.guestSession.uuid,
    toOrderSocketPayload(safe, { summary: input.reason }),
  );

  return safe;
}

export async function attachCustomerToOrder(
  orderId: string,
  input: AttachCustomerInput,
  createdByUserId: bigint,
) {
  const order = assertOrder(await findOrderByUuid(orderId));

  let customer;

  if (input.customerId !== undefined) {
    customer = await findCustomerByUuid(input.customerId);

    if (customer === null) {
      throw new AppError(
        "Customer not found.",
        HTTP_STATUS.NOT_FOUND,
        "CUSTOMER_NOT_FOUND",
      );
    }
  } else {
    customer = await createCustomer({
      name: input.name!,
      phone: input.phone ?? null,
      createdByUserId,
    });
  }

  const updated = await attachCustomerToOrderTransaction({
    orderId: order.id,
    guestSessionId: order.guestSessionId,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    actorUserId: createdByUserId,
    orderUuid: order.uuid,
  });

  return toSafeOrder(updated);
}

export function buildReceiptHtml(order: SafeOrder): string {
  const itemRows = order.items
    .map(
      (item) =>
        `<tr><td>${item.productNameSnapshot}</td><td>${item.quantity}</td><td>Rs. ${item.unitPriceSnapshot}</td><td>Rs. ${item.lineTotal}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>Receipt ${order.orderNumber}</title>
<style>
body{font-family:Arial,sans-serif;max-width:420px;margin:24px auto;color:#111}
table{width:100%;border-collapse:collapse;margin-top:16px}
td,th{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left}
.meta{color:#4b5563;font-size:14px}
</style></head><body>
<h1>${env.APP_NAME}</h1>
<p class="meta">Order ${order.orderNumber}<br/>${order.createdAt.toISOString()}<br/>${order.orderType}${order.tableNumber ? ` · Table ${order.tableNumber}` : ""}${order.customerName ? ` · ${order.customerName}` : ""}</p>
<table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${itemRows}</tbody></table>
<p><strong>Subtotal:</strong> Rs. ${order.subtotal}<br/>
<strong>Tax:</strong> Rs. ${order.taxAmount}<br/>
<strong>Service charge:</strong> Rs. ${order.serviceChargeAmount}<br/>
<strong>Total:</strong> Rs. ${order.totalAmount}<br/>
<strong>Paid:</strong> Rs. ${order.paidAmount}<br/>
<strong>Remaining:</strong> Rs. ${order.remainingAmount}<br/>
${order.orderStatus} / ${order.paymentStatus}</p>
</body></html>`;
}

export async function getOrderReceiptHtml(
  orderId: string,
  guestSessionId?: bigint,
) {
  const order = assertOrder(await findOrderByUuid(orderId));

  if (
    guestSessionId !== undefined &&
    order.guestSessionId !== guestSessionId
  ) {
    throw new AppError(
      ORDER_MESSAGES.FORBIDDEN_GUEST_ORDER,
      HTTP_STATUS.FORBIDDEN,
      "FORBIDDEN_GUEST_ORDER",
    );
  }

  return buildReceiptHtml(toSafeOrder(order));
}

export async function getOrderReceiptImagePath(
  orderId: string,
  guestSessionId?: bigint,
) {
  let order = assertOrder(await findOrderByUuid(orderId));

  if (
    guestSessionId !== undefined &&
    order.guestSessionId !== guestSessionId
  ) {
    throw new AppError(
      ORDER_MESSAGES.FORBIDDEN_GUEST_ORDER,
      HTTP_STATUS.FORBIDDEN,
      "FORBIDDEN_GUEST_ORDER",
    );
  }

  if (order.receiptImagePath === null) {
    await generateReceiptAfterCommit(order.uuid);
    order = assertOrder(await findOrderByUuid(orderId));
  }

  return toSafeOrder(order);
}

export { findOrderByUuid };
