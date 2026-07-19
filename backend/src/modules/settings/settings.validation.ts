import { z } from "zod";

const percentSchema = z.coerce
  .number()
  .min(0, "Must be at least 0.")
  .max(100, "Must be at most 100.");

export const updateCafeSettingsSchema = z
  .object({
    taxRatePercent: percentSchema.optional(),
    serviceChargePercent: percentSchema.optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.taxRatePercent !== undefined ||
      data.serviceChargePercent !== undefined,
    { message: "At least one field must be provided." },
  );

export type UpdateCafeSettingsInput = z.infer<typeof updateCafeSettingsSchema>;
