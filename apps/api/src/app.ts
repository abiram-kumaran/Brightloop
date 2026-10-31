import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { config } from "./config.js";
import { errorHandler } from "./common/errors.js";
import { authRoutes } from "./modules/auth/routes.js";
import { userRoutes } from "./modules/users/routes.js";
import { catalogRoutes } from "./modules/catalog/routes.js";
import { subscriptionRoutes } from "./modules/subscriptions/routes.js";
import { billingRoutes } from "./modules/billing/routes.js";
import { reportRoutes } from "./modules/reports/routes.js";
import { supportRoutes } from "./modules/support/routes.js";

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: {
      level: config.NODE_ENV === "test" ? "silent" : "info",
    },
  });

  // Security & Middleware
  app.register(helmet, {
    contentSecurityPolicy: false, // Allows Vite dev and Swagger UI
  });

  app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin || origin.startsWith("http://localhost")) {
        cb(null, true);
        return;
      }
      cb(null, true);
    },
    credentials: true,
  });

  app.register(cookie, {
    secret: config.COOKIE_SECRET,
  });

  // OpenAPI Documentation
  app.register(swagger, {
    openapi: {
      info: {
        title: "Brightloop Subscription Management API",
        description: "Official REST API for Brightloop Subscription Management System",
        version: "1.0.0",
      },
      servers: [{ url: `http://localhost:${config.PORT}` }],
    },
  });

  app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
  });

  // Global Error Handler
  app.setErrorHandler(errorHandler);

  // Health Checks
  app.get("/healthz", async () => ({ status: "ok", timestamp: new Date().toISOString() }));
  app.get("/readyz", async () => ({ status: "ready" }));

  // API v1 Routes
  app.register(
    async (v1) => {
      v1.register(authRoutes, { prefix: "/auth" });
      v1.register(userRoutes, { prefix: "/users" });
      v1.register(catalogRoutes);
      v1.register(subscriptionRoutes);
      v1.register(billingRoutes);
      v1.register(reportRoutes);
      v1.register(supportRoutes);
    },
    { prefix: "/api/v1" }
  );

  return app;
}
