import { ApiErrorResponse } from "@brightloop/shared";

export class ApiError extends Error {
  public code: string;
  public statusCode: number;
  public fields?: Record<string, string[]>;
  public requestId?: string;

  constructor(statusCode: number, errorData: ApiErrorResponse["error"]) {
    super(errorData.message);
    this.name = "ApiError";
    this.code = errorData.code;
    this.statusCode = statusCode;
    this.fields = errorData.fields;
    this.requestId = errorData.requestId;
  }
}

export async function fetchApi<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith("/api") ? endpoint : `/api/v1${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  headers.set("X-Requested-With", "brightloop");

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let errorData: ApiErrorResponse["error"] = {
      code: "INTERNAL",
      message: `Request failed with status ${response.status}`,
    };

    try {
      const json = await response.json();
      if (json.error) {
        errorData = json.error;
      }
    } catch {
      // JSON parse failed, use default message
    }

    throw new ApiError(response.status, errorData);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const rawJson = await response.json();
  if (rawJson && typeof rawJson === "object" && "data" in rawJson && rawJson.data !== undefined) {
    const payload = rawJson.data;
    if (Array.isArray(payload)) {
      Object.defineProperty(payload, "data", {
        get() {
          return this;
        },
        configurable: true,
        enumerable: false,
      });
    } else if (payload !== null && typeof payload === "object" && !("data" in payload)) {
      Object.defineProperty(payload, "data", {
        get() {
          return this;
        },
        configurable: true,
        enumerable: false,
      });
    }
    return payload as T;
  }

  return rawJson as T;
}