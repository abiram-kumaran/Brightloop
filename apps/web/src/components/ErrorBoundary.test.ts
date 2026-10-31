import { describe, it, expect, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary.js";

describe("ErrorBoundary component", () => {
  it("derives error state from caught error", () => {
    const error = new Error("Dashboard render failure");
    const derivedState = ErrorBoundary.getDerivedStateFromError(error);

    expect(derivedState.hasError).toBe(true);
    expect(derivedState.error).toBe(error);
  });

  it("handles reset action properly", () => {
    const onReset = vi.fn();
    const boundary = new ErrorBoundary({ children: "child content", onReset });
    boundary.state = { hasError: true, error: new Error("Test error") };
    boundary.setState = vi.fn((update) => {
      boundary.state = { ...boundary.state, ...(typeof update === "function" ? update(boundary.state) : update) };
    });

    boundary.handleReset();

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(boundary.setState).toHaveBeenCalledWith({ hasError: false, error: null });
    expect(boundary.state.hasError).toBe(false);
    expect(boundary.state.error).toBeNull();
  });
});
