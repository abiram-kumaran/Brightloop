import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { AppError, AuthUser, RegisterInput, LoginInput } from "@brightloop/shared";
import * as repo from "./repository.js";

export async function registerCustomer(input: RegisterInput): Promise<AuthUser> {
  const existing = await repo.findUserByEmail(input.email);
  if (existing) {
    throw new AppError({
      code: "CONFLICT",
      message: "An account with this email address already exists.",
      statusCode: 409,
      fields: { email: ["An account with this email address already exists"] },
    });
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const customerRoleId = await repo.getRoleIdByName("customer");
  const companyName = input.companyName?.trim() || `${input.fullName}'s Business`;

  const { userId, customerId } = await repo.createUserWithCustomer({
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    roleId: customerRoleId,
    companyName,
  });

  const permissions = await repo.getUserPermissions(userId, customerRoleId);

  return {
    id: userId,
    email: input.email,
    fullName: input.fullName,
    role: "customer",
    customerId,
    permissions,
  };
}

export async function login(input: LoginInput, isCompanyLogin = false): Promise<AuthUser> {
  const user = await repo.findUserByEmail(input.email);
  if (!user) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Invalid email or password.",
      statusCode: 401,
    });
  }

  // Check lockout
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw new AppError({
      code: "RATE_LIMITED",
      message: "Account is temporarily locked due to multiple failed login attempts. Please try again later.",
      statusCode: 429,
    });
  }

  if (!user.is_active) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "This account has been deactivated. Please contact support.",
      statusCode: 403,
    });
  }

  // Portal boundary separation
  if (isCompanyLogin && user.role_name === "customer") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "This account cannot access the company workspace. Please use customer login.",
      statusCode: 403,
    });
  }

  const validPassword = await bcrypt.compare(input.password, user.password_hash);
  if (!validPassword) {
    await repo.updateLoginAttempt(user.id, false);
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Invalid email or password.",
      statusCode: 401,
    });
  }

  // Reset failed login count
  await repo.updateLoginAttempt(user.id, true);

  const permissions = await repo.getUserPermissions(user.id, user.role_id);

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role_name,
    customerId: user.customer_id ?? undefined,
    permissions,
  };
}

export async function forgotPassword(email: string): Promise<{ resetToken?: string }> {
  const user = await repo.findUserByEmail(email);
  if (!user) {
    return {}; // Generic safe response to prevent email enumeration
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await repo.savePasswordResetToken(user.id, tokenHash, expiresAt);

  console.log(`[auth] Password reset requested for ${email}. Reset Token: ${rawToken}`);
  return { resetToken: rawToken };
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const record = await repo.findPasswordResetToken(tokenHash);

  if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "This password reset link is invalid or has expired.",
      statusCode: 400,
    });
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await repo.resetUserPassword(record.user_id, record.id, newPasswordHash);
}

export async function getMe(userId: number): Promise<AuthUser> {
  const user = await repo.findUserById(userId);
  if (!user) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "User not found",
      statusCode: 404,
    });
  }

  const permissions = await repo.getUserPermissions(user.id, user.role_id);
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role_name,
    customerId: user.customer_id ?? undefined,
    permissions,
  };
}
