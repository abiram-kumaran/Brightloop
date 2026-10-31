import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { AppError, AuthUser, UserRole } from "@brightloop/shared";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      customerId: user.customerId,
      permissions: user.permissions,
    },
    config.JWT_SECRET,
    { expiresIn: "15m" }
  );
}

export function signRefreshToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, role: user.role },
    config.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function setAuthCookies(reply: FastifyReply, user: AuthUser): void {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  reply.setCookie("access_token", accessToken, {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: config.NODE_ENV === "production",
    maxAge: 15 * 60, // 15 mins
  });

  reply.setCookie("refresh_token", refreshToken, {
    path: "/api/v1/auth",
    httpOnly: true,
    sameSite: "strict",
    secure: config.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie("access_token", { path: "/" });
  reply.clearCookie("refresh_token", { path: "/api/v1/auth" });
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token =
    request.cookies["access_token"] ||
    request.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Authentication is required to access this resource.",
      statusCode: 401,
    });
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as AuthUser;
    request.user = payload;
  } catch {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Your session has expired. Please sign in again.",
      statusCode: 401,
    });
  }
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.user) {
      throw new AppError({
        code: "UNAUTHENTICATED",
        message: "Authentication required",
        statusCode: 401,
      });
    }

    if (!roles.includes(request.user.role)) {
      throw new AppError({
        code: "FORBIDDEN",
        message: "You do not have access to this portal.",
        statusCode: 403,
      });
    }
  };
}

export function requirePermission(permissionCode: string) {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.user) {
      throw new AppError({
        code: "UNAUTHENTICATED",
        message: "Authentication required",
        statusCode: 401,
      });
    }

    if (request.user.role === "admin") {
      return; // Admin possesses all permissions
    }

    if (!request.user.permissions.includes(permissionCode)) {
      throw new AppError({
        code: "FORBIDDEN",
        message: `Missing required permission: ${permissionCode}`,
        statusCode: 403,
      });
    }
  };
}
