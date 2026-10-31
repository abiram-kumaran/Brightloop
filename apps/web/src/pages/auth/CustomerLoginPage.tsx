import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { Input } from "../../components/ui/Input.js";
import { Button } from "../../components/ui/Button.js";
import { ApiError } from "../../api/client.js";

export function CustomerLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const redirectUrl = await login({ email, password }, false);
      navigate(redirectUrl || "/portal");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Invalid email or password.");
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
            Customer Portal Sign In
          </h1>
          <p className="text-sm text-text-secondary">
            Access your subscriptions, invoices, and payments.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-semantic-dangerBg border border-semantic-danger/30 text-semantic-danger text-sm rounded-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email Address"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alice@customer.com"
          />

          <div className="flex flex-col gap-1">
            <Input
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-xs text-brand-forest hover:underline font-medium"
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isLoading}
            className="w-full mt-2"
          >
            Sign In to Customer Portal
          </Button>
        </form>

        <div className="text-center text-xs text-text-secondary border-t border-border-subtle pt-4">
          Need a customer account?{" "}
          <Link to="/signup" className="text-brand-forest font-semibold hover:underline">
            Register for Free
          </Link>
        </div>
      </div>
    </div>
  );
}
