import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../constants/http-status.js";
import { AppError } from "../../errors/app-error.js";
import { AUTH_MESSAGES } from "../auth/auth.constants.js";
import { sendSuccess } from "../../utils/api-response.js";
import {
  createCustomerRecord,
  getCustomerRecord,
  listCustomerRecords,
  updateCustomerRecord,
} from "./customer.service.js";
import type {
  CreateCustomerInput,
  ListCustomersQuery,
  UpdateCustomerInput,
} from "./customer.validation.js";

export async function list(request: Request, response: Response) {
  const query = request.query as unknown as ListCustomersQuery;
  const customers = await listCustomerRecords(query);

  return sendSuccess(response, {
    message: "Customers retrieved successfully.",
    data: {
      customers,
    },
  });
}

export async function getById(request: Request, response: Response) {
  const { customerId } = request.params as { customerId: string };
  const customer = await getCustomerRecord(customerId);

  return sendSuccess(response, {
    message: "Customer retrieved successfully.",
    data: {
      customer,
    },
  });
}

export async function create(request: Request, response: Response) {
  if (request.user === undefined) {
    throw new AppError(
      AUTH_MESSAGES.AUTHENTICATION_REQUIRED,
      HTTP_STATUS.UNAUTHORIZED,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const input = request.body as CreateCustomerInput;
  const result = await createCustomerRecord(
    input,
    request.user.databaseId,
  );

  const { matchedByPhone, ...customer } = result;

  return sendSuccess(response, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Customer created successfully.",
    data: {
      customer,
      matchedByPhone,
    },
  });
}

export async function update(request: Request, response: Response) {
  const { customerId } = request.params as { customerId: string };
  const input = request.body as UpdateCustomerInput;
  const customer = await updateCustomerRecord(customerId, input);

  return sendSuccess(response, {
    message: "Customer updated successfully.",
    data: {
      customer,
    },
  });
}
