import { z } from "zod";

const moneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => Number(value))
  .refine((value) => Number.isFinite(value) && value >= 0, {
    message: "Price cannot be negative.",
  });

export const createProductSchema = z
  .object({
    categoryId: z.string().uuid(),
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().max(2000).optional().nullable(),
    imagePath: z.string().trim().max(500).optional().nullable(),
    price: moneySchema,
    preparationMinutes: z.coerce.number().int().min(0).max(600).default(0),
    stockQuantity: z.coerce.number().int().min(0).default(0),
    lowStockThreshold: z.coerce.number().int().min(0).default(0),
    trackStock: z.boolean().default(true),
    isAvailable: z.boolean().default(true),
    displayOrder: z.coerce.number().int().min(0).max(9999).default(0),
  })
  .strict();

export const updateProductSchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(150).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    imagePath: z.string().trim().max(500).optional().nullable(),
    price: moneySchema.optional(),
    preparationMinutes: z.coerce.number().int().min(0).max(600).optional(),
    lowStockThreshold: z.coerce.number().int().min(0).optional(),
    trackStock: z.boolean().optional(),
    displayOrder: z.coerce.number().int().min(0).max(9999).optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "At least one field must be provided." },
  );

export const updateProductStatusSchema = z
  .object({
    isAvailable: z.boolean(),
  })
  .strict();

export const adjustProductStockSchema = z
  .object({
    quantityDelta: z.coerce.number().int(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict()
  .refine((data) => data.quantityDelta !== 0, {
    message: "quantityDelta cannot be zero.",
    path: ["quantityDelta"],
  });

export const productIdParamsSchema = z
  .object({
    productId: z.string().uuid(),
  })
  .strict();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateProductStatusInput = z.infer<typeof updateProductStatusSchema>;
export type AdjustProductStockInput = z.infer<typeof adjustProductStockSchema>;
