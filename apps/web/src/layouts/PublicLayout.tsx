import React from "react";
import { Link, Outlet } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
      {/* Public Header */}
      <header className="sticky top-0 z-40 bg-surface-page/90 backdrop-blur-md border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-sm bg-brand-forest flex items-center justify-center text-text-inverse font-display text-xl font-bold shadow-sm transition-transform group-hover:scale-105">
              B
            </div>
            <div className="flex flex-col">
              <span className="font-display text-2xl font-semibold tracking-tight text-text-primary">
                Brightloop
              </span>
              <span className="text-[10px] uppercase tracking-widest text-text-secondary font-medium -mt-1">
                Subscription Engine
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-text-secondary">
            <a href="#features" className="hover:text-text-primary transition-colors">
              Features
            </a>
            <a href="#pricing" className="hover:text-text-primary transition-colors">
              Pricing Plans
            </a>
            <a href="#workflow" className="hover:text-text-primary transition-colors">
              How It Works
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="text-sm font-medium text-text-primary hover:text-brand-forest transition-colors px-3 py-2"
            >
              Customer Login
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-sm bg-brand-forest text-text-inverse hover:bg-brand-forestDark transition-all shadow-card"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Public Footer */}
      <footer className="bg-surface-card border-t border-border-default py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-sm bg-brand-forest flex items-center justify-center text-text-inverse font-display text-sm font-bold">
              B
            </div>
            <p className="text-sm text-text-secondary">
              &copy; {new Date().getFullYear()} Brightloop Software. All rights reserved.
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm text-text-secondary">
            <a href="#privacy" className="hover:text-text-primary transition-colors">
              Privacy Policy
            </a>
            <a href="#terms" className="hover:text-text-primary transition-colors">
              Terms of Service
            </a>
            <Link to="/company/login" className="text-text-muted hover:text-text-secondary text-xs">
              Staff Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
