import { prisma } from "../../config/database.js";
import {
  OrderStatus,
  PaymentStatus,
} from "../../generated/prisma/enums.js";

const customerSelect = {
  id: true,
  uuid: true,
  name: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

export function findCustomerByUuid(uuid: string) {
  return prisma.customer.findFirst({
    where: {
      uuid,
      deletedAt: null,
    },
    select: customerSelect,
  });
}

export function findCustomerById(id: bigint) {
  return prisma.customer.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: customerSelect,
  });
}

export function findCustomersByPhone(phone: string) {
  return prisma.customer.findMany({
    where: {
      phone,
      deletedAt: null,
    },
    orderBy: [{ createdAt: "desc" }],
    select: customerSelect,
  });
}

export function listCustomers(filters: {
  search?: string;
  phone?: string;
}) {
  return prisma.customer.findMany({
    where: {
      deletedAt: null,
      ...(filters.phone !== undefined && {
        phone: filters.phone,
      }),
      ...(filters.search !== undefined && {
        OR: [
          {
            name: {
              contains: filters.search,
            },
          },
          {
            phone: {
              contains: filters.search,
            },
          },
        ],
      }),
    },
    orderBy: [{ createdAt: "desc" }],
    select: customerSelect,
  });
}

export function createCustomer(data: {
  name: string;
  phone: string | null;
  createdByUserId?: bigint | null;
}) {
  return prisma.customer.create({
    data: {
      name: data.name,
      phone: data.phone,
      ...(data.createdByUserId !== undefined &&
        data.createdByUserId !== null && {
          createdByUserId: data.createdByUserId,
        }),
    },
    select: customerSelect,
  });
}

export function updateCustomer(
  customerId: bigint,
  data: {
    name?: string;
    phone?: string | null;
  },
) {
  return prisma.customer.update({
    where: {
      id: customerId,
    },
    data: {
      ...(data.name !== undefined && {
        name: data.name,
      }),
      ...(data.phone !== undefined && {
        phone: data.phone,
      }),
    },
    select: customerSelect,
  });
}

export function findCustomerOrdersForSummary(customerId: bigint) {
  return prisma.order.findMany({
    where: {
      customerId,
      deletedAt: null,
      status: {
        notIn: [OrderStatus.REJECTED, OrderStatus.CANCELLED],
      },
    },
    select: {
      id: true,
      totalAmount: true,
      paymentStatus: true,
      payments: {
        where: {
          status: PaymentStatus.COMPLETED,
        },
        select: {
          amount: true,
        },
      },
    },
  });
}
