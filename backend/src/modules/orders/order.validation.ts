import { z } from "zod";
import {
  OrderPaymentStatus,
  OrderStatus,
} from "../../generated/prisma/enums.js";

export const createGuestOrderSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            productId: z.string().uuid(),
            quantity: z.coerce.number().int().positive().max(100),
            notes: z.string().trim().max(500).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    customerNotes: z.string().trim().max(1000).optional(),
    customerName: z.string().trim().min(1).max(100).optional(),
    customerPhone: z
      .string()
      .trim()
      .min(5)
      .max(30)
      .transform((phone) => phone.replace(/[\s\-()]/g, ""))
      .optional(),
  })
  .strict();

export const rejectOrderSchema = z
  .object({
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();

export const cancelOrderSchema = z
  .object({
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();

export const attachCustomerSchema = z
  .object({
    customerId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(100).optional(),
    phone: z
      .string()
      .trim()
      .min(5)
      .max(30)
      .transform((value) => value.replace(/[\s\-()]/g, ""))
      .optional()
      .nullable(),
  })
  .strict()
  .refine(
    (data) => data.customerId !== undefined || data.name !== undefined,
    { message: "Provide customerId or name to attach a customer." },
  );

export const orderIdParamsSchema = z
  .object({
    orderId: z.string().uuid(),
  })
  .strict();

export const orderPublicIdParamsSchema = z
  .object({
    orderPublicId: z.string().uuid(),
  })
  .strict();

export const listOrdersQuerySchema = z
  .object({
    status: z
      .enum([
        OrderStatus.PENDING,
        OrderStatus.ACCEPTED,
        OrderStatus.PREPARING,
        OrderStatus.READY,
        OrderStatus.SERVED,
        OrderStatus.COMPLETED,
        OrderStatus.REJECTED,
        OrderStatus.CANCELLED,
      ])
      .optional(),
    paymentStatus: z
      .enum([
        OrderPaymentStatus.UNPAID,
        OrderPaymentStatus.PARTIALLY_PAID,
        OrderPaymentStatus.PAID,
        OrderPaymentStatus.REFUNDED,
      ])
      .optional(),
  })
  .strict();

export type CreateGuestOrderInput = z.infer<typeof createGuestOrderSchema>;
export type RejectOrderInput = z.infer<typeof rejectOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type AttachCustomerInput = z.infer<typeof attachCustomerSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
