import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { AppError } from "../../errors/app-error.js";
import { AUTH_MESSAGES } from "../auth/auth.constants.js";
import { sendSuccess } from "../../utils/api-response.js";
import { orderIdParamsSchema } from "../orders/order.validation.js";
import {
  createOrderPayment,
  getPaymentRecord,
  listOrderPaymentRecords,
  listPaymentRecords,
  reverseOrderPayment,
} from "./payment.service.js";
import type {
  CreatePaymentInput,
  ReversePaymentInput,
} from "./payment.validation.js";

export async function list(_request: Request, response: Response) {
  const payments = await listPaymentRecords();
  return sendSuccess(response, {
    message: "Payments retrieved successfully.",
    data: { payments },
  });
}

export async function getById(request: Request, response: Response) {
  const { paymentId } = request.params as { paymentId: string };
  const payment = await getPaymentRecord(paymentId);
  return sendSuccess(response, {
    message: "Payment retrieved successfully.",
    data: { payment },
  });
}

export async function listForOrder(request: Request, response: Response) {
  const { orderId } = request.params as { orderId: string };
  orderIdParamsSchema.parse({ orderId });
  const payments = await listOrderPaymentRecords(orderId);
  return sendSuccess(response, {
    message: "Order payments retrieved successfully.",
    data: { payments },
  });
}

export async function createForOrder(request: Request, response: Response) {
  if (request.user === undefined) {
    throw new AppError(
      AUTH_MESSAGES.AUTHENTICATION_REQUIRED,
      HTTP_STATUS.UNAUTHORIZED,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { orderId } = request.params as { orderId: string };
  const result = await createOrderPayment(
    orderId,
    request.body as CreatePaymentInput,
    request.user.databaseId,
  );

  return sendSuccess(response, {
    statusCode: result.duplicated ? HTTP_STATUS.OK : HTTP_STATUS.CREATED,
    message: result.duplicated
      ? "Idempotent payment replayed successfully."
      : "Payment recorded successfully.",
    data: result,
  });
}

export async function reverse(request: Request, response: Response) {
  if (request.user === undefined) {
    throw new AppError(
      AUTH_MESSAGES.AUTHENTICATION_REQUIRED,
      HTTP_STATUS.UNAUTHORIZED,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { paymentId } = request.params as { paymentId: string };
  const result = await reverseOrderPayment(
    paymentId,
    request.body as ReversePaymentInput,
    request.user.databaseId,
  );

  return sendSuccess(response, {
    message: "Payment reversed successfully.",
    data: result,
  });
}
