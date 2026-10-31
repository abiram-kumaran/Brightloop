import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-sans font-medium rounded-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-forest focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs h-8",
    md: "px-4 py-2 text-sm h-10",
    lg: "px-6 py-3 text-base h-12",
  }[size];

  const variantClasses = {
    primary:
      "bg-brand-forest text-text-inverse hover:bg-brand-forestDark active:bg-brand-forestDark shadow-card",
    secondary:
      "bg-surface-card text-text-primary border border-brand-taupe hover:bg-brand-creamDeep active:bg-brand-taupe/40",
    ghost:
      "bg-transparent text-text-primary hover:bg-brand-creamDeep active:bg-brand-taupe/30",
    danger:
      "bg-semantic-danger text-text-inverse hover:opacity-90 active:opacity-100 shadow-card",
  }[variant];

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <span>Loading...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
