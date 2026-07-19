import { z } from "zod";

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
  .transform((phone) => phone.replace(/[\s\-()]/g, ""));

export const createCustomerSchema = z
  .object({
    name: nameSchema,
    phone: phoneSchema.optional(),
  })
  .strict();

export const updateCustomerSchema = z
  .object({
    name: nameSchema.optional(),
    phone: phoneSchema.optional().nullable(),
  })
  .strict()
  .refine(
    (data) => data.name !== undefined || data.phone !== undefined,
    {
      message: "At least one field must be provided.",
    },
  );

export const customerIdParamsSchema = z
  .object({
    customerId: z.string().uuid("Customer id must be a valid UUID."),
  })
  .strict();

export const listCustomersQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(100).optional(),
    phone: phoneSchema.optional(),
  })
  .strict();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
