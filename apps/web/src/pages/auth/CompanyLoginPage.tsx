import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { Input } from "../../components/ui/Input.js";
import { Button } from "../../components/ui/Button.js";
import { Shield, Lock } from "lucide-react";
import { ApiError } from "../../api/client.js";

export function CompanyLoginPage() {
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
      const redirectUrl = await login({ email, password }, true);
      navigate(redirectUrl);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Invalid company credentials.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-creamDeep/50 flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-surface-card border border-border-default rounded-lg p-8 sm:p-10 shadow-card flex flex-col gap-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-sm bg-brand-forest flex items-center justify-center text-text-inverse shadow-sm">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-medium text-text-primary">
              Company Workspace Login
            </h1>
            <p className="text-xs text-text-secondary mt-1">
              Authorized internal administrative and operations portal.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-semantic-dangerBg border border-semantic-danger/30 text-semantic-danger text-sm rounded-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Internal Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@brightloop.com"
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
                className="text-xs text-text-secondary hover:text-text-primary font-medium"
              >
                Password recovery
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
            Authenticate Workspace
          </Button>
        </form>

        <div className="bg-surface-page border border-border-subtle rounded-sm p-3 text-center text-xs text-text-muted">
          <span>Are you a subscriber? </span>
          <Link to="/login" className="text-brand-forest font-semibold hover:underline">
            Go to Customer Login
          </Link>
        </div>
      </div>
    </div>
  );
}
