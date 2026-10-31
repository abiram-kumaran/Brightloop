import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { Input } from "../../components/ui/Input.js";
import { Button } from "../../components/ui/Button.js";
import { Check, X, ShieldCheck } from "lucide-react";
import { ApiError } from "../../api/client.js";

export function CustomerSignupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Live password validation checklist
  const hasMinLength = password.length > 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!termsAccepted) {
      setError("Please accept the terms of service to continue.");
      return;
    }

    if (!isPasswordValid) {
      setError("Please satisfy all password security requirements.");
      return;
    }

    setIsLoading(true);
    try {
      await register({ fullName, email, password, companyName });
      navigate("/portal");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.fields) {
          setFieldErrors(err.fields);
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-surface-card border border-border-default rounded-lg p-8 shadow-card flex flex-col gap-6">
        <div className="text-center flex flex-col gap-2">
          <h1 className="font-display text-3xl font-normal text-text-primary">
            Create Customer Account
          </h1>
          <p className="text-sm text-text-secondary">
            Manage your subscriptions, view invoices, and track payments.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-semantic-dangerBg border border-semantic-danger/30 text-semantic-danger text-sm rounded-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Full Name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alice Chen"
            error={fieldErrors["fullName"]?.[0]}
          />

          <Input
            label="Business Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alice@company.com"
            error={fieldErrors["email"]?.[0]}
          />

          <Input
            label="Company Name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Innovations Pvt Ltd"
            helperText="Optional legal business name for invoices"
          />

          <div className="flex flex-col gap-2">
            <Input
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              error={fieldErrors["password"]?.[0]}
            />

            {/* Live Password Strength Checklist */}
            <div className="p-3 bg-surface-page border border-border-subtle rounded-sm flex flex-col gap-2 text-xs">
              <span className="font-semibold text-text-secondary">Password Requirements:</span>
              <div className="grid grid-cols-2 gap-1.5">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-semantic-success" : "text-text-muted"}`}>
                  {hasMinLength ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  <span>Over 8 characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasUpper ? "text-semantic-success" : "text-text-muted"}`}>
                  {hasUpper ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  <span>Uppercase letter</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasLower ? "text-semantic-success" : "text-text-muted"}`}>
                  {hasLower ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  <span>Lowercase letter</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasSpecial ? "text-semantic-success" : "text-text-muted"}`}>
                  {hasSpecial ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                  <span>Special character</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-1">
            <input
              type="checkbox"
              id="terms"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 rounded text-brand-forest focus:ring-brand-forest"
            />
            <label htmlFor="terms" className="text-xs text-text-secondary leading-normal">
              I agree to the Terms of Service and acknowledge the privacy policy.
            </label>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            className="w-full mt-2"
          >
            Create Customer Account
          </Button>
        </form>

        <div className="text-center text-xs text-text-secondary border-t border-border-subtle pt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-forest font-semibold hover:underline">
            Customer Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
