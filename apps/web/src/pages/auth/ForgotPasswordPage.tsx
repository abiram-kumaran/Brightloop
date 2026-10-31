import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "../../components/ui/Input.js";
import { Button } from "../../components/ui/Button.js";
import { fetchApi } from "../../api/client.js";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const data = await fetchApi<{ message: string; devResetToken?: string }>(
        "/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        }
      );
      setMessage(data.message);
      if (data.devResetToken) {
        setDevToken(data.devResetToken);
      }
    } catch {
      setMessage("If an account exists with that email, a password reset link has been sent.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-surface-card border border-border-default rounded-lg p-8 shadow-card flex flex-col gap-6">
        <div className="text-center flex flex-col gap-2">
          <h1 className="font-display text-3xl font-normal text-text-primary">
            Password Recovery
          </h1>
          <p className="text-sm text-text-secondary">
            Enter your email to receive a password reset link.
          </p>
        </div>

        {message && (
          <div className="p-4 bg-brand-creamDeep border border-brand-taupe text-brand-ink text-sm rounded-sm flex flex-col gap-2">
            <span>{message}</span>
            {devToken && (
              <div className="mt-2 pt-2 border-t border-brand-taupe/40 text-xs">
                <span className="font-semibold block text-brand-forest">Demo Environment Token:</span>
                <Link
                  to={`/reset-password?token=${devToken}`}
                  className="text-brand-forest underline font-mono break-all"
                >
                  Click here to Reset Password directly
                </Link>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email Address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />

          <Button type="submit" variant="primary" size="md" isLoading={isLoading} className="w-full">
            Send Reset Instructions
          </Button>
        </form>

        <div className="text-center text-xs text-text-secondary border-t border-border-subtle pt-4">
          Remembered your password?{" "}
          <Link to="/login" className="text-brand-forest font-semibold hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
