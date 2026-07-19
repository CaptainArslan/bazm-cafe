import { z } from 'zod';

const emailSchema = z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .email('Enter a valid email address.')
    .max(191, 'Email must not exceed 191 characters.')
    .transform((email) => email.toLowerCase());

const loginPasswordSchema = z
    .string()
    .min(1, 'Password is required.')
    .max(200, 'Password is too long.');

const newPasswordSchema = z
    .string()
    .min(8, 'Password must contain at least 8 characters.')
    .max(72, 'Password must not exceed 72 characters.')
    .regex(
        /[a-z]/,
        'Password must contain at least one lowercase letter.',
    )
    .regex(
        /[A-Z]/,
        'Password must contain at least one uppercase letter.',
    )
    .regex(
        /[0-9]/,
        'Password must contain at least one number.',
    );

export const loginSchema = z
    .object({
        email: emailSchema,
        password: loginPasswordSchema,

        deviceName: z
            .string()
            .trim()
            .min(1)
            .max(150)
            .optional(),
    })
    .strict();

export const changePasswordSchema = z
    .object({
        currentPassword: loginPasswordSchema,
        newPassword: newPasswordSchema,
        newPasswordConfirmation: z.string(),
    })
    .strict()
    .refine(
        (data) =>
            data.newPassword === data.newPasswordConfirmation,
        {
            message: 'New password confirmation does not match.',
            path: ['newPasswordConfirmation'],
        },
    )
    .refine(
        (data) =>
            data.currentPassword !== data.newPassword,
        {
            message:
                'New password must be different from the current password.',
            path: ['newPassword'],
        },
    );

export const forgotPasswordSchema = z
    .object({
        email: emailSchema,
    })
    .strict();

export const resetPasswordSchema = z
    .object({
        token: z
            .string()
            .trim()
            .min(32, 'Reset token is invalid.')
            .max(256, 'Reset token is invalid.'),

        newPassword: newPasswordSchema,

        newPasswordConfirmation: z.string(),
    })
    .strict()
    .refine(
        (data) =>
            data.newPassword === data.newPasswordConfirmation,
        {
            message: 'New password confirmation does not match.',
            path: ['newPasswordConfirmation'],
        },
    );

export type LoginInput = z.infer<typeof loginSchema>;

export type ChangePasswordInput =
    z.infer<typeof changePasswordSchema>;

export type ForgotPasswordInput =
    z.infer<typeof forgotPasswordSchema>;

export type ResetPasswordInput =
    z.infer<typeof resetPasswordSchema>;