import { z } from "zod";

import { optionalMediaImagePathSchema } from "../../utils/media-path.js";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.")
  .max(191, "Email must not exceed 191 characters.")
  .transform((email) => email.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters.")
  .max(72, "Password must not exceed 72 characters.")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
  .regex(/[0-9]/, "Password must contain at least one number.");

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(100, "Name must not exceed 100 characters.");

const phoneSchema = z
  .string()
  .trim()
  .min(5, "Phone number is too short.")
  .max(30, "Phone number must not exceed 30 characters.")
  .optional()
  .nullable();

export const createStaffSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    imagePath: optionalMediaImagePathSchema,
  })
  .strict();

export const updateStaffSchema = z
  .object({
    name: nameSchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema,
    imagePath: optionalMediaImagePathSchema,
  })
  .strict()
  .refine(
    (data) =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.phone !== undefined ||
      data.imagePath !== undefined,
    {
      message: "At least one field must be provided.",
    },
  );

export const updateStaffPasswordSchema = z
  .object({
    password: passwordSchema,
  })
  .strict();

export const updateStaffStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export const staffIdParamsSchema = z
  .object({
    staffId: z.string().uuid("Staff id must be a valid UUID."),
  })
  .strict();

export const listStaffQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(100).optional(),
    isActive: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => {
        if (value === undefined) {
          return undefined;
        }

        return value === "true";
      }),
  })
  .strict();

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type UpdateStaffPasswordInput = z.infer<typeof updateStaffPasswordSchema>;
export type UpdateStaffStatusInput = z.infer<typeof updateStaffStatusSchema>;
export type ListStaffQuery = z.infer<typeof listStaffQuerySchema>;
