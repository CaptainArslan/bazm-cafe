import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { AppError } from "../../errors/app-error.js";
import { AUTH_MESSAGES } from "../auth/auth.constants.js";
import { sendSuccess } from "../../utils/api-response.js";
import {
  acceptOrder,
  attachCustomerToOrder,
  cancelOrder,
  createGuestOrder,
  getGuestOrder,
  getOrderReceiptHtml,
  getOrderReceiptImagePath,
  getStaffOrder,
  listGuestOrders,
  listStaffOrders,
  markOrderReady,
  markOrderServed,
  rejectOrder,
  startPreparingOrder,
} from "./order.service.js";
import type {
  AttachCustomerInput,
  CancelOrderInput,
  CreateGuestOrderInput,
  ListOrdersQuery,
  RejectOrderInput,
} from "./order.validation.js";

function requireUser(request: Request) {
  if (request.user === undefined) {
    throw new AppError(
      AUTH_MESSAGES.AUTHENTICATION_REQUIRED,
      HTTP_STATUS.UNAUTHORIZED,
      "AUTHENTICATION_REQUIRED",
    );
  }

  return request.user;
}

function requireGuest(request: Request) {
  if (request.guestSession === undefined) {
    throw new AppError(
      "A guest session is required.",
      HTTP_STATUS.UNAUTHORIZED,
      "GUEST_SESSION_REQUIRED",
    );
  }

  return request.guestSession;
}

export async function guestCreate(request: Request, response: Response) {
  const guest = requireGuest(request);
  const order = await createGuestOrder(
    guest,
    request.body as CreateGuestOrderInput,
  );

  return sendSuccess(response, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Order created successfully.",
    data: { order },
  });
}

export async function guestList(request: Request, response: Response) {
  const guest = requireGuest(request);
  const orders = await listGuestOrders(guest.databaseId);

  return sendSuccess(response, {
    message: "Orders retrieved successfully.",
    data: { orders },
  });
}

export async function guestGetById(request: Request, response: Response) {
  const guest = requireGuest(request);
  const { orderPublicId } = request.params as { orderPublicId: string };
  const order = await getGuestOrder(guest.databaseId, orderPublicId);

  return sendSuccess(response, {
    message: "Order retrieved successfully.",
    data: { order },
  });
}

export async function guestReceiptHtml(request: Request, response: Response) {
  const guest = requireGuest(request);
  const { orderPublicId } = request.params as { orderPublicId: string };
  const html = await getOrderReceiptHtml(orderPublicId, guest.databaseId);
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  return response.status(200).send(html);
}

export async function guestReceiptImage(request: Request, response: Response) {
  const guest = requireGuest(request);
  const { orderPublicId } = request.params as { orderPublicId: string };
  const order = await getOrderReceiptImagePath(
    orderPublicId,
    guest.databaseId,
  );

  return sendSuccess(response, {
    message: "Receipt image retrieved successfully.",
    data: {
      receiptImagePath: order.receiptImagePath,
      receiptImageUrl: order.receiptImageUrl,
    },
  });
}

export async function staffList(request: Request, response: Response) {
  const orders = await listStaffOrders(
    request.query as unknown as ListOrdersQuery,
  );

  return sendSuccess(response, {
    message: "Orders retrieved successfully.",
    data: { orders },
  });
}

export async function staffGetById(request: Request, response: Response) {
  const { orderId } = request.params as { orderId: string };
  const order = await getStaffOrder(orderId);

  return sendSuccess(response, {
    message: "Order retrieved successfully.",
    data: { order },
  });
}

export async function staffAccept(request: Request, response: Response) {
  const user = requireUser(request);
  const { orderId } = request.params as { orderId: string };
  const order = await acceptOrder(orderId, user.databaseId);

  return sendSuccess(response, {
    message: "Order accepted successfully.",
    data: { order },
  });
}

export async function staffStartPreparing(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  const { orderId } = request.params as { orderId: string };
  const order = await startPreparingOrder(orderId, user.databaseId);

  return sendSuccess(response, {
    message: "Order marked as preparing successfully.",
    data: { order },
  });
}

export async function staffMarkReady(request: Request, response: Response) {
  const user = requireUser(request);
  const { orderId } = request.params as { orderId: string };
  const order = await markOrderReady(orderId, user.databaseId);

  return sendSuccess(response, {
    message: "Order marked as ready successfully.",
    data: { order },
  });
}

export async function staffMarkServed(request: Request, response: Response) {
  const user = requireUser(request);
  const { orderId } = request.params as { orderId: string };
  const order = await markOrderServed(orderId, user.databaseId);

  return sendSuccess(response, {
    message: "Order marked as served successfully.",
    data: { order },
  });
}

export async function staffReject(request: Request, response: Response) {
  const user = requireUser(request);
  const { orderId } = request.params as { orderId: string };
  const order = await rejectOrder(
    orderId,
    request.body as RejectOrderInput,
    user.databaseId,
  );

  return sendSuccess(response, {
    message: "Order rejected successfully.",
    data: { order },
  });
}

export async function staffCancel(request: Request, response: Response) {
  const user = requireUser(request);
  const { orderId } = request.params as { orderId: string };
  const order = await cancelOrder(
    orderId,
    request.body as CancelOrderInput,
    user.databaseId,
  );

  return sendSuccess(response, {
    message: "Order cancelled successfully.",
    data: { order },
  });
}

export async function staffAttachCustomer(
  request: Request,
  response: Response,
) {
  const user = requireUser(request);
  const { orderId } = request.params as { orderId: string };
  const order = await attachCustomerToOrder(
    orderId,
    request.body as AttachCustomerInput,
    user.databaseId,
  );

  return sendSuccess(response, {
    message: "Customer attached to order successfully.",
    data: { order },
  });
}

export async function staffReceiptHtml(request: Request, response: Response) {
  const { orderId } = request.params as { orderId: string };
  const html = await getOrderReceiptHtml(orderId);
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  return response.status(200).send(html);
}

export async function staffReceiptImage(request: Request, response: Response) {
  const { orderId } = request.params as { orderId: string };
  const order = await getOrderReceiptImagePath(orderId);

  return sendSuccess(response, {
    message: "Receipt image retrieved successfully.",
    data: {
      receiptImagePath: order.receiptImagePath,
      receiptImageUrl: order.receiptImageUrl,
    },
  });
}
