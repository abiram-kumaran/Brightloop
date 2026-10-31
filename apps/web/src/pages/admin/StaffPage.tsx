import React, { useEffect, useState } from "react";
import { fetchApi, ApiError } from "../../api/client.js";
import { Button } from "../../components/ui/Button.js";
import { Input } from "../../components/ui/Input.js";
import { Badge } from "../../components/ui/Badge.js";
import { Users, Plus, X, Shield, Check } from "lucide-react";

interface StaffUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  created_by_name?: string;
}

export function StaffPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "manager">("staff");
  const [password, setPassword] = useState("Brightloop@2026!");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string } | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchApi<StaffUser[] | { data: StaffUser[] }>("/users");
      const list = Array.isArray(res)
        ? res
        : res && typeof res === "object" && "data" in res && Array.isArray(res.data)
          ? res.data
          : [];
      setUsers(list.filter((u) => u.role !== "customer"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await fetchApi<{ data: { initialPassword: string } }>("/users", {
        method: "POST",
        body: JSON.stringify({ fullName, email, role, password }),
      });
      setCreatedInfo({ email, password: res.data?.initialPassword || password });
      setFullName(""); setEmail(""); setPassword("Brightloop@2026!");
      loadUsers();
    } catch (err: unknown) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create staff user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (userId: number, isActive: boolean) => {
    try {
      await fetchApi(`/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !isActive }),
      });
      loadUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  const roleColors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-800 border border-purple-200",
    manager: "bg-blue-100 text-blue-800 border border-blue-200",
    staff: "bg-green-100 text-green-800 border border-green-200",
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-medium text-text-primary">
              Staff Management
            </h1>
            <Badge variant="active">{users.length} Members</Badge>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Manage internal staff and manager accounts. Only admins can add or deactivate team members.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => { setIsModalOpen(true); setCreatedInfo(null); }}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add Staff Member
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-semantic-dangerBg border border-semantic-danger/20 rounded-md text-semantic-danger text-sm">{error}</div>
      )}

      {/* Role legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-surface-card border border-border-default">
          <Shield className="w-3.5 h-3.5 text-purple-600" />
          <span className="font-semibold text-purple-700">Admin</span>
          <span className="text-text-secondary">— Full system access, catalog, staff, reports</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-surface-card border border-border-default">
          <Shield className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-semibold text-blue-700">Manager</span>
          <span className="text-text-secondary">— Approvals, reports, audit; no catalog admin</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-surface-card border border-border-default">
          <Shield className="w-3.5 h-3.5 text-green-600" />
          <span className="font-semibold text-green-700">Staff</span>
          <span className="text-text-secondary">— Day-to-day: customers, subscriptions, invoices, payments</span>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-text-secondary animate-pulse">Loading team members...</div>
      ) : (
        <div className="bg-surface-card border border-border-default rounded-lg overflow-hidden shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-page border-b border-border-subtle text-xs uppercase tracking-wider text-text-secondary font-semibold">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Name</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Joined</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-brand-creamSoft/40 transition-colors">
                  <td className="py-4 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-forest text-text-inverse flex items-center justify-center font-bold text-xs uppercase shrink-0">
                        {u.full_name?.charAt(0) || "?"}
                      </div>
                      <span className="font-semibold text-text-primary">{u.full_name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-text-secondary text-xs font-mono">{u.email}</td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${roleColors[u.role] || "bg-gray-100 text-gray-700"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <Badge variant={u.is_active ? "active" : "draft"}>
                      {u.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="py-4 px-4 text-xs text-text-secondary font-mono">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-right">
                    {u.role !== "admin" && (
                      <button
                        onClick={() => handleToggleActive(u.id, u.is_active)}
                        className={`text-xs font-semibold px-3 py-1 rounded-sm border transition-colors ${
                          u.is_active
                            ? "text-semantic-danger border-semantic-danger/30 hover:bg-semantic-dangerBg/40"
                            : "text-semantic-success border-semantic-success/30 hover:bg-semantic-successBg/40"
                        }`}
                      >
                        {u.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-surface-card border border-border-default rounded-lg max-w-md w-full p-6 shadow-modal flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-forest" />
                <h3 className="font-display text-xl font-medium text-text-primary">Add Staff Member</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            {createdInfo ? (
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-semantic-successBg border border-semantic-success/30 rounded-sm text-sm text-semantic-success flex items-start gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Staff member created successfully.</p>
                    <p className="mt-1 text-xs">Share these credentials securely. The user should change their password on first login.</p>
                  </div>
                </div>
                <div className="p-3 bg-surface-page border border-border-default rounded-sm text-xs font-mono space-y-1">
                  <div><span className="text-text-secondary">Email:</span> <span className="text-text-primary font-semibold">{createdInfo.email}</span></div>
                  <div><span className="text-text-secondary">Password:</span> <span className="text-text-primary font-semibold">{createdInfo.password}</span></div>
                </div>
                <Button variant="primary" size="md" onClick={() => { setIsModalOpen(false); setCreatedInfo(null); }}>
                  Done
                </Button>
              </div>
            ) : (
              <>
                {formError && (
                  <div className="p-3 bg-semantic-dangerBg border border-semantic-danger/30 text-semantic-danger text-xs rounded-sm">{formError}</div>
                )}
                <form onSubmit={handleCreate} className="flex flex-col gap-4">
                  <Input label="Full Name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" />
                  <Input label="Work Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@brightloop.com" />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as "staff" | "manager")}
                      className="w-full px-3 py-2 text-sm bg-surface-card border border-border-default rounded-sm text-text-primary focus:outline-none focus:border-brand-forest"
                    >
                      <option value="staff">Staff — Day-to-day operations</option>
                      <option value="manager">Manager — Approvals and reports</option>
                    </select>
                  </div>
                  <Input
                    label="Initial Password"
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    helperText="User should change this on first login"
                  />
                  <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="secondary" size="md" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>Create Staff Account</Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
