import { z } from "zod";

export const createTableSchema = z
  .object({
    tableNumber: z.string().trim().min(1).max(30),
    name: z.string().trim().min(1).max(100).optional().nullable(),
    capacity: z.coerce.number().int().positive().max(100).default(1),
  })
  .strict();

export const updateTableSchema = z
  .object({
    tableNumber: z.string().trim().min(1).max(30).optional(),
    name: z.string().trim().min(1).max(100).optional().nullable(),
    capacity: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.tableNumber !== undefined ||
      data.name !== undefined ||
      data.capacity !== undefined,
    { message: "At least one field must be provided." },
  );

export const updateTableStatusSchema = z
  .object({
    operationalStatus: z.enum(["AVAILABLE", "OUT_OF_SERVICE"]),
    isActive: z.boolean().optional(),
  })
  .strict();

export const tableIdParamsSchema = z
  .object({
    tableId: z.string().uuid("Table id must be a valid UUID."),
  })
  .strict();

export const forceReleaseTableSchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
export type UpdateTableStatusInput = z.infer<typeof updateTableStatusSchema>;
export type ForceReleaseTableInput = z.infer<typeof forceReleaseTableSchema>;
