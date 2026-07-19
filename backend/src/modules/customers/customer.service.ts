import { HTTP_STATUS } from "../../constants/http-status.js";
import { AppError } from "../../errors/app-error.js";
import { Prisma } from "../../generated/prisma/client.js";
import { OrderPaymentStatus } from "../../generated/prisma/enums.js";
import { CUSTOMER_MESSAGES } from "./customer.constants.js";
import {
  createCustomer,
  findCustomerByUuid,
  findCustomerOrdersForSummary,
  findCustomersByPhone,
  listCustomers,
  updateCustomer,
} from "./customer.repository.js";
import type {
  CustomerDetail,
  CustomerFinancialSummary,
  SafeCustomer,
} from "./customer.types.js";
import type {
  CreateCustomerInput,
  ListCustomersQuery,
  UpdateCustomerInput,
} from "./customer.validation.js";

function toSafeCustomer(customer: {
  uuid: string;
  name: string;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SafeCustomer {
  return {
    id: customer.uuid,
    name: customer.name,
    phone: customer.phone,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

function buildFinancialSummary(
  orders: Array<{
    totalAmount: Prisma.Decimal;
    paymentStatus: OrderPaymentStatus;
    payments: Array<{ amount: Prisma.Decimal }>;
  }>,
): CustomerFinancialSummary {
  let unpaidOrderCount = 0;
  let partiallyPaidOrderCount = 0;
  let outstandingBalance = new Prisma.Decimal(0);

  for (const order of orders) {
    if (order.paymentStatus === OrderPaymentStatus.UNPAID) {
      unpaidOrderCount += 1;
    }

    if (order.paymentStatus === OrderPaymentStatus.PARTIALLY_PAID) {
      partiallyPaidOrderCount += 1;
    }

    if (
      order.paymentStatus === OrderPaymentStatus.UNPAID ||
      order.paymentStatus === OrderPaymentStatus.PARTIALLY_PAID
    ) {
      const paidAmount = order.payments.reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Prisma.Decimal(0),
      );

      outstandingBalance = outstandingBalance.plus(
        order.totalAmount.minus(paidAmount),
      );
    }
  }

  return {
    orderCount: orders.length,
    unpaidOrderCount,
    partiallyPaidOrderCount,
    outstandingBalance: outstandingBalance.toFixed(2),
  };
}

export async function listCustomerRecords(
  query: ListCustomersQuery,
): Promise<SafeCustomer[]> {
  if (query.phone !== undefined) {
    const matched = await findCustomersByPhone(query.phone);
    return matched.map(toSafeCustomer);
  }

  const customers = await listCustomers({
    ...(query.search !== undefined && {
      search: query.search,
    }),
  });

  return customers.map(toSafeCustomer);
}

export async function getCustomerRecord(
  customerId: string,
): Promise<CustomerDetail> {
  const customer = await findCustomerByUuid(customerId);

  if (customer === null) {
    throw new AppError(
      CUSTOMER_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "CUSTOMER_NOT_FOUND",
    );
  }

  const orders = await findCustomerOrdersForSummary(customer.id);

  return {
    ...toSafeCustomer(customer),
    summary: buildFinancialSummary(orders),
  };
}

export async function createCustomerRecord(
  input: CreateCustomerInput,
  createdByUserId: bigint,
): Promise<SafeCustomer & { matchedByPhone: SafeCustomer[] }> {
  const phone = input.phone ?? null;

  const matchedByPhone =
    phone === null
      ? []
      : (await findCustomersByPhone(phone)).map(toSafeCustomer);

  const customer = await createCustomer({
    name: input.name,
    phone,
    createdByUserId,
  });

  return {
    ...toSafeCustomer(customer),
    matchedByPhone,
  };
}

export async function updateCustomerRecord(
  customerId: string,
  input: UpdateCustomerInput,
): Promise<SafeCustomer> {
  const customer = await findCustomerByUuid(customerId);

  if (customer === null) {
    throw new AppError(
      CUSTOMER_MESSAGES.NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      "CUSTOMER_NOT_FOUND",
    );
  }

  const updated = await updateCustomer(customer.id, {
    ...(input.name !== undefined && {
      name: input.name,
    }),
    ...(input.phone !== undefined && {
      phone: input.phone,
    }),
  });

  return toSafeCustomer(updated);
}
