import { z } from "zod";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{9,}$/;

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(120),
  email: z.string().trim().email("Please enter a valid email address").toLowerCase(),
  password: z
    .string()
    .min(9, "Password must be at least 9 characters long")
    .regex(
      passwordRegex,
      "Password must include at least one uppercase letter, one lowercase letter, and one special character"
    ),
  companyName: z.string().trim().max(160).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address").toLowerCase(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z
    .string()
    .min(9, "Password must be at least 9 characters long")
    .regex(
      passwordRegex,
      "Password must include at least one uppercase letter, one lowercase letter, and one special character"
    ),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const createStaffSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  role: z.enum(["staff", "manager"]),
  permissions: z.array(z.string()).optional(),
  password: z
    .string()
    .min(9)
    .regex(passwordRegex, "Must be >8 characters with upper, lower, and special character")
    .optional(), // If provided directly by admin or via invite token
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
