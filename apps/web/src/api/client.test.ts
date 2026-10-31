import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchApi, ApiError } from "./client.js";

describe("fetchApi client utility", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns unwrapped array payload and permits both direct access and .data access", async () => {
    const mockList = [
      { id: 1, number: "SUB-001", planName: "Starter" },
      { id: 2, number: "SUB-002", planName: "Pro" },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: mockList }),
    } as unknown as Response);

    const res = await fetchApi<typeof mockList>("/subscriptions");

    // Direct access (used by e.g. PlansPage, ProductsPage)
    expect(Array.isArray(res)).toBe(true);
    expect(res).toHaveLength(2);
    expect(res[0].number).toBe("SUB-001");

    // .data access (used by PortalDashboardPage, CustomerInvoicesPage, etc.)
    const wrappedRes = res as unknown as { data: typeof mockList };
    expect(wrappedRes.data).toBeDefined();
    expect(Array.isArray(wrappedRes.data)).toBe(true);
    expect(wrappedRes.data).toHaveLength(2);
    expect(wrappedRes.data[0].number).toBe("SUB-001");
  });

  it("handles object payload and permits both direct access and .data access", async () => {
    const mockDetail = { id: 10, number: "INV-100", totalPaise: 50000 };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: mockDetail }),
    } as unknown as Response);

    const res = await fetchApi<typeof mockDetail>("/invoices/10");

    // Direct access
    expect(res.id).toBe(10);
    expect(res.number).toBe("INV-100");

    // .data access
    const wrappedRes = res as unknown as { data: typeof mockDetail };
    expect(wrappedRes.data).toBeDefined();
    expect(wrappedRes.data.id).toBe(10);
  });

  it("throws ApiError when response is not ok", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        error: { code: "NOT_FOUND", message: "Resource not found" },
      }),
    } as unknown as Response);

    await expect(fetchApi("/unknown")).rejects.toThrow(ApiError);
  });
});
