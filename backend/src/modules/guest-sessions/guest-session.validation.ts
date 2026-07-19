import { z } from "zod";
import { CustomerType } from "../../generated/prisma/enums.js";

export const createGuestSessionSchema = z
  .object({
    orderType: z.enum([CustomerType.DINE_IN, CustomerType.TAKEAWAY]),
    tableToken: z.string().trim().min(32).max(256).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.orderType === CustomerType.DINE_IN && !data.tableToken) {
      ctx.addIssue({
        code: "custom",
        message: "tableToken is required for dine-in sessions.",
        path: ["tableToken"],
      });
    }

    if (data.orderType === CustomerType.TAKEAWAY && data.tableToken) {
      ctx.addIssue({
        code: "custom",
        message: "tableToken must not be provided for takeaway sessions.",
        path: ["tableToken"],
      });
    }
  });

export const resolveTableSchema = z
  .object({
    tableToken: z.string().trim().min(32).max(256),
  })
  .strict();

export const guestSessionIdParamsSchema = z
  .object({
    sessionId: z.string().uuid("Session id must be a valid UUID."),
  })
  .strict();

export const redeemRecoveryCodeSchema = z
  .object({
    recoveryCode: z.string().trim().min(6).max(32),
  })
  .strict();

export type CreateGuestSessionInput = z.infer<typeof createGuestSessionSchema>;
export type ResolveTableInput = z.infer<typeof resolveTableSchema>;
export type RedeemRecoveryCodeInput = z.infer<typeof redeemRecoveryCodeSchema>;
