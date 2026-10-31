import React, { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Input } from "../../components/ui/Input.js";
import { Button } from "../../components/ui/Button.js";
import { fetchApi, ApiError } from "../../api/client.js";
import { Check, X } from "lucide-react";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Live validation
  const hasMinLength = newPassword.length > 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Reset token is missing or invalid.");
      return;
    }

    if (!isPasswordValid) {
      setError("Password does not meet complexity requirements.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await fetchApi("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to reset password. The link may have expired.");
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
            Set New Password
          </h1>
          <p className="text-sm text-text-secondary">
            Enter your new secure password below.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-semantic-dangerBg border border-semantic-danger/30 text-semantic-danger text-sm rounded-sm">
            {error}
          </div>
        )}

        {success ? (
          <div className="flex flex-col gap-4 text-center py-4">
            <div className="p-4 bg-semantic-successBg border border-semantic-success/30 text-semantic-success rounded-sm text-sm font-medium">
              Your password has been reset successfully!
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate("/login")}
              className="w-full"
            >
              Sign In with New Password
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Input
                label="New Password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
              />

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

            <Input
              label="Confirm Password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="w-full mt-2"
            >
              Update Password
            </Button>
          </form>
        )}

        <div className="text-center text-xs text-text-secondary border-t border-border-subtle pt-4">
          <Link to="/login" className="text-brand-forest font-semibold hover:underline">
            Return to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
