import React, { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import {
  Home,
  Layers,
  FileText,
  CreditCard,
  MessageSquare,
  LogOut,
  Menu,
  X,
  UserCheck,
} from "lucide-react";
import { ErrorBoundary } from "../components/ErrorBoundary.js";
export function CustomerPortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems = [
    { to: "/portal", label: "Overview", icon: Home, end: true },
    { to: "/portal/subscriptions", label: "My Subscriptions", icon: Layers },
    { to: "/portal/invoices", label: "Invoices & Receipts", icon: FileText },
    { to: "/portal/payments", label: "Payment History", icon: CreditCard },
    { to: "/portal/support", label: "Support & Chat", icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-surface-card border-b border-border-default shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/portal" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-sm bg-brand-forest flex items-center justify-center text-text-inverse font-display text-lg font-bold">
                B
              </div>
              <div className="flex flex-col">
                <span className="font-display text-xl font-medium tracking-tight text-text-primary">
                  Brightloop
                </span>
                <span className="text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                  Subscriber Portal
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1 pl-6 border-l border-border-subtle">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3.5 py-2 rounded-sm text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-brand-creamDeep text-brand-forest font-semibold"
                          : "text-text-secondary hover:text-text-primary hover:bg-brand-creamDeep/50"
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2.5 text-right">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-text-primary">
                  {user?.fullName}
                </span>
                <span className="text-[11px] text-text-secondary truncate max-w-[140px]">
                  {user?.email}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-brand-forest/20 text-brand-forest flex items-center justify-center font-bold text-xs uppercase">
                {user?.fullName?.charAt(0) || "C"}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-semantic-danger px-2 py-1 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>

            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden p-2 text-text-secondary hover:text-text-primary"
            >
              {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Dropdown */}
        {isSidebarOpen && (
          <div className="md:hidden border-t border-border-subtle bg-surface-card p-4 flex flex-col gap-2">
            <div className="pb-3 border-b border-border-subtle mb-1">
              <div className="text-sm font-bold text-text-primary">{user?.fullName}</div>
              <div className="text-xs text-text-muted">{user?.email}</div>
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setIsSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium ${
                      isActive
                        ? "bg-brand-creamDeep text-brand-forest font-semibold"
                        : "text-text-secondary"
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium text-semantic-danger border-t border-border-subtle mt-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <ErrorBoundary title="Portal View Error" message="Unable to load this portal section. Please retry or navigate to another view.">
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
