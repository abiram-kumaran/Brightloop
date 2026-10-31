import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = "", id, ...props }, ref) => {
    const inputId = id || props.name || Math.random().toString(36).substring(2, 9);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
            {label}
            {props.required && <span className="text-semantic-danger ml-1">*</span>}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`w-full px-3.5 py-2.5 bg-surface-card text-text-primary border rounded-sm text-sm placeholder:text-text-muted transition-all focus:outline-none focus:ring-2 focus:ring-brand-forest focus:border-brand-forest disabled:bg-surface-muted disabled:text-text-muted ${
            error
              ? "border-semantic-danger focus:ring-semantic-danger focus:border-semantic-danger"
              : "border-border-default"
          } ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-semantic-danger font-medium">{error}</span>}
        {helperText && !error && (
          <span className="text-xs text-text-secondary">{helperText}</span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
