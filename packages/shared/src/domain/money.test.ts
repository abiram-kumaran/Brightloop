import { describe, it, expect } from "vitest";
import { formatINR } from "./money.js";

describe("formatINR money utility", () => {
  it("formats integer paise correctly", () => {
    expect(formatINR(150000)).toBe("₹1,500.00");
    expect(formatINR(0)).toBe("₹0.00");
    expect(formatINR(100)).toBe("₹1.00");
    expect(formatINR(50)).toBe("₹0.50");
  });
  it("handles string and bigint inputs safely", () => {
    expect(formatINR("250000")).toBe("₹2,500.00");
    expect(formatINR(500000n)).toBe("₹5,000.00");
  });

  it("safely handles null and undefined without throwing", () => {
    expect(formatINR(null as unknown as number)).toBe("₹0.00");
    expect(formatINR(undefined as unknown as number)).toBe("₹0.00");
  });

  it("safely handles float numbers without throwing RangeError", () => {
    expect(formatINR(1500.5)).toBe("₹15.01");
    expect(formatINR(1234.4)).toBe("₹12.34");
  });

  it("safely handles NaN and non-numeric strings without throwing", () => {
    expect(formatINR(NaN)).toBe("₹0.00");
    expect(formatINR("invalid")).toBe("₹0.00");
  });
});
