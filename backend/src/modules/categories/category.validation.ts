import { z } from "zod";

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(2000).optional().nullable(),
    imagePath: z.string().trim().max(500).optional().nullable(),
    displayOrder: z.coerce.number().int().min(0).max(9999).default(0),
    isVisible: z.boolean().default(true),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    imagePath: z.string().trim().max(500).optional().nullable(),
    displayOrder: z.coerce.number().int().min(0).max(9999).optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "At least one field must be provided." },
  );

export const updateCategoryStatusSchema = z
  .object({
    isVisible: z.boolean(),
  })
  .strict();

export const categoryIdParamsSchema = z
  .object({
    categoryId: z.string().uuid(),
  })
  .strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type UpdateCategoryStatusInput = z.infer<typeof updateCategoryStatusSchema>;
