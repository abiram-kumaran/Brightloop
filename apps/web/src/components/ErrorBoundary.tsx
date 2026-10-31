import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "./ui/Button.js";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  title?: string;
  message?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an unhandled rendering error:", error, errorInfo);
  }

  handleReset = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error || new Error("Unknown rendering error"), this.handleReset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const title = this.props.title || "Something went wrong";
      const message =
        this.props.message ||
        "An unexpected error occurred while loading this view. Your session and account data remain secure.";

      return (
        <div className="min-h-[360px] w-full flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-surface-card border border-border-default rounded-2xl p-6 sm:p-8 shadow-sm text-center space-y-5">
            <div className="w-12 h-12 rounded-full bg-semantic-dangerBg text-semantic-danger mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h2 className="font-serif text-2xl font-bold text-text-primary">{title}</h2>
              <p className="text-sm text-text-secondary leading-relaxed">{message}</p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-brand-cream/60 rounded-lg border border-brand-taupe/30 text-left font-mono text-xs text-text-secondary overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                onClick={this.handleReset}
                className="w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </Button>
              <a
                href="/portal"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border-default hover:bg-brand-cream text-text-primary transition"
              >
                <Home className="w-4 h-4" />
                Return to Overview
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
