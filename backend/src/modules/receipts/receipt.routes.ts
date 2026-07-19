import { Router } from "express";
import type { Request, Response } from "express";

import { requireReceiptAccess } from "../../middleware/receipt-access.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { sendSuccess } from "../../utils/api-response.js";
import {
  getOrderReceiptHtml,
  getOrderReceiptImagePath,
  getStaffOrder,
} from "../orders/order.service.js";
import { orderPublicIdParamsSchema } from "../orders/order.validation.js";

export const receiptsRouter = Router();

receiptsRouter.use(requireReceiptAccess);

receiptsRouter.get(
  "/orders/:orderPublicId",
  validate(orderPublicIdParamsSchema, "params"),
  asyncHandler(async (request: Request, response: Response) => {
    const { orderPublicId } = request.params as { orderPublicId: string };
    const html = await getOrderReceiptHtml(
      orderPublicId,
      request.receiptAccess!.guestSessionDatabaseId,
    );
    response.type("html").send(html);
  }),
);

receiptsRouter.get(
  "/orders/:orderPublicId/image",
  validate(orderPublicIdParamsSchema, "params"),
  asyncHandler(async (request: Request, response: Response) => {
    const { orderPublicId } = request.params as { orderPublicId: string };
    const order = await getOrderReceiptImagePath(
      orderPublicId,
      request.receiptAccess!.guestSessionDatabaseId,
    );

    return sendSuccess(response, {
      message: "Receipt image retrieved successfully.",
      data: {
        order: {
          id: order.id,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          receiptImagePath: order.receiptImagePath,
          receiptImageUrl: order.receiptImageUrl,
        },
      },
    });
  }),
);

receiptsRouter.get(
  "/orders/:orderPublicId/summary",
  validate(orderPublicIdParamsSchema, "params"),
  asyncHandler(async (request: Request, response: Response) => {
    const { orderPublicId } = request.params as { orderPublicId: string };
    await getOrderReceiptHtml(
      orderPublicId,
      request.receiptAccess!.guestSessionDatabaseId,
    );
    const order = await getStaffOrder(orderPublicId);

    return sendSuccess(response, {
      message: "Receipt order summary retrieved successfully.",
      data: {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          billNumber: order.billNumber,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          subtotal: order.subtotal,
          taxAmount: order.taxAmount,
          serviceChargeAmount: order.serviceChargeAmount,
          totalAmount: order.totalAmount,
          paidAmount: order.paidAmount,
          remainingAmount: order.remainingAmount,
          items: order.items,
          createdAt: order.createdAt,
        },
      },
    });
  }),
);
