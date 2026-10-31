import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@brightloop/shared";
import * as authService from "./service.js";
import { setAuthCookies, clearAuthCookies, authenticate } from "../../common/auth.js";

const loginQuerySchema = z.object({
  isCompany: z.enum(["true", "false"]).optional(),
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Public customer registration
  fastify.post("/register", async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const user = await authService.registerCustomer(input);
    setAuthCookies(reply, user);
    return reply.status(201).send({
      data: {
        user,
        message: "Registration successful. Welcome to Brightloop!",
      },
    });
  });

  // Login (supports both customer portal and company workspace)
  fastify.post("/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const query = loginQuerySchema.parse(request.query);
    const isCompanyLogin = query.isCompany === "true";
    const user = await authService.login(input, isCompanyLogin);
    setAuthCookies(reply, user);
    return reply.status(200).send({
      data: {
        user,
        redirectTo:
          user.role === "admin"
            ? "/admin"
            : user.role === "staff" || user.role === "manager"
              ? "/staff"
              : "/portal",
      },
    });
  });

  // Logout
  fastify.post("/logout", async (_request, reply) => {
    clearAuthCookies(reply);
    return reply.status(200).send({ data: { message: "Logged out successfully" } });
  });

  // Forgot password
  fastify.post("/forgot-password", async (request, reply) => {
    const input = forgotPasswordSchema.parse(request.body);
    const result = await authService.forgotPassword(input.email);
    return reply.status(202).send({
      data: {
        message: "If an account exists with that email, a password reset link has been sent.",
        devResetToken: result.resetToken, // for demo convenience
      },
    });
  });

  // Reset password
  fastify.post("/reset-password", async (request, reply) => {
    const input = resetPasswordSchema.parse(request.body);
    await authService.resetPassword(input.token, input.newPassword);
    return reply.status(200).send({
      data: { message: "Password has been reset successfully. You may now log in." },
    });
  });

  // Current session inspection
  fastify.get("/me", { preHandler: [authenticate] }, async (request, reply) => {
    if (!request.user) {
      return reply
        .status(401)
        .send({ error: { code: "UNAUTHENTICATED", message: "Not authenticated" } });
    }
    const freshUser = await authService.getMe(request.user.id);
    return reply.status(200).send({ data: { user: freshUser } });
  });
}
