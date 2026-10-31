import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "@brightloop/shared";

export function errorHandler(
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId = request.id || Math.random().toString(36).substring(2, 10);

  // Zod schema validation errors
  if (error instanceof ZodError) {
    const fields: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const path = issue.path.join(".");
      if (!fields[path]) {
        fields[path] = [];
      }
      fields[path].push(issue.message);
    }

    reply.status(422).send({
      error: {
        code: "VALIDATION_FAILED",
        message: "Some fields are invalid.",
        fields,
        requestId,
      },
    });
    return;
  }

  // Application-defined errors
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        fields: error.fields,
        requestId,
      },
    });
    return;
  }

  // Fastify schema validation errors
  if ("validation" in error && error.validation) {
    reply.status(422).send({
      error: {
        code: "VALIDATION_FAILED",
        message: error.message,
        requestId,
      },
    });
    return;
  }

  // PostgreSQL unique constraint violations
  if ("code" in error && error.code === "23505") {
    reply.status(409).send({
      error: {
        code: "CONFLICT",
        message: "A record with this identifier or unique property already exists.",
        requestId,
      },
    });
    return;
  }

  // Internal errors
  console.error("INTERNAL ERROR CAUGHT:", error);
  reply.status(500).send({
    error: {
      code: "INTERNAL",
      message: "An internal server error occurred.",
      requestId,
    },
  });
}
