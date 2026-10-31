import React, { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  Layers,
  FileText,
  CreditCard,
  BarChart3,
  LogOut,
  Menu,
  X,
  ShieldAlert,
} from "lucide-react";
import { ErrorBoundary } from "../components/ErrorBoundary.js";
export function StaffLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Role Guard
  if (user && user.role === "customer") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-surface-page">
        <div className="max-w-md w-full bg-surface-card border border-semantic-danger/30 rounded-lg p-8 text-center flex flex-col gap-4">
          <ShieldAlert className="w-12 h-12 text-semantic-danger mx-auto" />
          <h2 className="font-display text-2xl text-text-primary">Staff Access Required</h2>
          <p className="text-sm text-text-secondary">
            Customer accounts cannot access the internal operations workspace.
          </p>
          <Link
            to="/portal"
            className="px-4 py-2 bg-brand-forest text-text-inverse rounded-sm text-sm font-medium"
          >
            Go to Customer Portal
          </Link>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    navigate("/company/login");
  };

  const navItems = [
    { to: "/staff", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/staff/customers", label: "Customers", icon: Users },
    { to: "/staff/quotations", label: "Quotations", icon: FileSpreadsheet },
    { to: "/staff/subscriptions", label: "Subscriptions", icon: Layers },
    { to: "/staff/invoices", label: "Invoices", icon: FileText },
    { to: "/staff/payments", label: "Payments", icon: CreditCard },
    ...(user?.role === "admin" || user?.permissions.includes("reports.view")
      ? [{ to: "/staff/reports", label: "Finance Reports", icon: BarChart3 }]
      : []),
  ];

  return (
    <div className="min-h-screen flex bg-surface-page text-text-primary">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface-card border-r border-border-default transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col justify-between p-4">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between px-2 pt-2">
              <Link to="/staff" className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-sm bg-brand-forest flex items-center justify-center text-text-inverse font-display text-lg font-bold">
                  B
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-lg font-semibold text-text-primary leading-tight">
                    Brightloop
                  </span>
                  <span className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">
                    Operations Portal
                  </span>
                </div>
              </Link>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="md:hidden text-text-secondary hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setIsSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-sm text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-brand-creamDeep text-brand-forest font-semibold"
                          : "text-text-secondary hover:bg-brand-creamDeep/60 hover:text-text-primary"
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-border-subtle pt-4 flex flex-col gap-3">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-brand-forest/20 text-brand-forest flex items-center justify-center font-bold text-xs uppercase">
                {user?.fullName?.charAt(0) || "S"}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-text-primary truncate">
                  {user?.fullName}
                </span>
                <span className="text-[10px] text-text-muted truncate capitalize">
                  {user?.role} Staff
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 px-3 py-2 rounded-sm text-xs font-medium text-semantic-danger hover:bg-semantic-dangerBg/40 transition-colors w-full text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-surface-page/90 backdrop-blur-md border-b border-border-subtle flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden text-text-secondary hover:text-text-primary"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-xs uppercase tracking-wider font-semibold text-text-secondary">
              Staff Operations Console
            </span>
          </div>

          {user?.role === "admin" && (
            <Link
              to="/admin"
              className="text-xs font-semibold text-brand-forest hover:underline px-2 py-1"
            >
              Switch to Admin View &rarr;
            </Link>
          )}
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <ErrorBoundary title="Staff View Error" message="Unable to load this operations section. Please retry.">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
