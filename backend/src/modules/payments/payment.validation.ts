import { z } from "zod";
import { PaymentMethod } from "../../generated/prisma/enums.js";

export const createPaymentSchema = z
  .object({
    amount: z
      .union([z.string(), z.number()])
      .transform((value) => Number(value))
      .refine((value) => Number.isFinite(value) && value > 0, {
        message: "Amount must be greater than zero.",
      }),
    method: z.enum([
      PaymentMethod.CASH,
      PaymentMethod.CARD,
      PaymentMethod.EASYPAISA,
      PaymentMethod.JAZZCASH,
      PaymentMethod.BANK_TRANSFER,
      PaymentMethod.OTHER,
    ]),
    reference: z.string().trim().max(191).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
    idempotencyKey: z.string().trim().min(8).max(100).optional(),
  })
  .strict();

export const reversePaymentSchema = z
  .object({
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();

export const paymentIdParamsSchema = z
  .object({
    paymentId: z.string().uuid(),
  })
  .strict();

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;
