export type ErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "ILLEGAL_TRANSITION"
  | "VERSION_CONFLICT"
  | "CONSTRAINT_VIOLATION"
  | "RATE_LIMITED"
  | "INTERNAL";

export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string[]>;
    requestId?: string;
  };
}

const DEFAULT_STATUS_CODES: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ILLEGAL_TRANSITION: 409,
  VERSION_CONFLICT: 409,
  CONSTRAINT_VIOLATION: 400,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly fields?: Record<string, string[]>;

  constructor(
    codeOrParams:
      | ErrorCode
      | {
          code: ErrorCode;
          message: string;
          statusCode?: number;
          fields?: Record<string, string[]>;
        },
    message?: string,
    statusCode?: number,
    fields?: Record<string, string[]>
  ) {
    if (typeof codeOrParams === "string") {
      const code = codeOrParams;
      const msg = message || code;
      const status = statusCode || DEFAULT_STATUS_CODES[code] || 500;
      super(msg);
      this.name = "AppError";
      this.code = code;
      this.statusCode = status;
      this.fields = fields;
    } else {
      const { code, message: msg, statusCode: status, fields: f } = codeOrParams;
      super(msg);
      this.name = "AppError";
      this.code = code;
      this.statusCode = status || DEFAULT_STATUS_CODES[code] || 500;
      this.fields = f;
    }
  }
}
