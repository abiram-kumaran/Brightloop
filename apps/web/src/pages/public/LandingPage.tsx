import React from "react";
import { Link } from "react-router-dom";
import {
  Check,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  FileText,
  CreditCard,
  BarChart3,
} from "lucide-react";

export function LandingPage() {
  return (
    <div className="flex flex-col gap-24 py-12 md:py-20">
      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 text-center flex flex-col items-center gap-8">
        <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-normal tracking-tight text-brand-ink leading-[1.05]">
          Subscriptions engineered with <span className="italic">quiet clarity</span>.
        </h1>

        <p className="max-w-2xl text-lg sm:text-xl text-text-secondary leading-relaxed font-sans font-normal">
          From product configurations to quotation templates, automated recurring billing runs, and reconciled ledger payments — all in one unified, audit-proof engine.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            to="/signup"
            className="px-6 py-3.5 rounded-sm bg-brand-forest text-text-inverse font-medium text-base hover:bg-brand-forestDark transition-all shadow-card inline-flex items-center gap-2"
          >
            <span>Start Free Trial</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#pricing"
            className="px-6 py-3.5 rounded-sm bg-surface-card text-text-primary border border-brand-taupe font-medium text-base hover:bg-brand-creamDeep transition-all"
          >
            View Pricing Plans
          </a>
        </div>
      </section>

      {/* Pricing Grid Section - Directly modeled from UI-reference-01.webp */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="bg-surface-card border border-border-default rounded-lg p-6 sm:p-12 shadow-card relative overflow-hidden">
          {/* Subtle Corner Markers matching UI Reference */}
          <div className="absolute top-3 left-3 w-2 h-2 border-t-2 border-l-2 border-brand-taupe/50" />
          <div className="absolute top-3 right-3 w-2 h-2 border-t-2 border-r-2 border-brand-taupe/50" />
          <div className="absolute bottom-3 left-3 w-2 h-2 border-b-2 border-l-2 border-brand-taupe/50" />
          <div className="absolute bottom-3 right-3 w-2 h-2 border-b-2 border-r-2 border-brand-taupe/50" />

          {/* Section Header */}
          <div className="flex flex-col items-center text-center gap-4 mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-creamDeep border border-border-subtle text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-forest"></span>
              <span>Our Pricing Plan</span>
            </div>
            <h2 className="font-display text-4xl sm:text-5xl font-normal text-text-primary tracking-tight">
              Get started for free
            </h2>
            <p className="text-text-secondary text-base max-w-lg">
              Transparent, predictable subscription tiers built for modern recurring revenue operations.
            </p>
          </div>

          {/* 3-Column Plan Card Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {/* Starter Plan Card */}
            <div className="bg-surface-page border border-border-subtle rounded-md p-8 flex flex-col justify-between transition-all hover:border-brand-taupe shadow-sm">
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="text-xl font-bold text-text-primary">Starter</h3>
                  <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                    Essential subscription tools for emerging businesses looking to automate recurring contracts.
                  </p>
                </div>

                <div className="py-2">
                  <div className="text-3xl font-display font-medium text-text-primary">
                    Free Plan
                  </div>
                  <div className="text-xs text-text-muted mt-1">Zero commitment to start</div>
                </div>

                <Link
                  to="/signup"
                  className="w-full py-2.5 px-4 rounded-sm bg-surface-card border border-brand-taupe text-text-primary font-medium text-sm text-center hover:bg-brand-creamDeep transition-all"
                >
                  Get Started Free
                </Link>

                <div className="border-t border-border-subtle pt-6 flex flex-col gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Get started with
                  </span>
                  <ul className="space-y-3 text-sm text-text-secondary">
                    <li className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-brand-forest/20 text-brand-forest flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>Self-service customer portal</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-brand-forest/20 text-brand-forest flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>Standard quotation creation</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-brand-forest/20 text-brand-forest flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>Automated email notifications</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-brand-forest/20 text-brand-forest flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>Basic invoice generation</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Pro Plan Card - Elevated Spotlight */}
            <div className="bg-surface-card border-2 border-brand-forest rounded-md p-8 flex flex-col justify-between shadow-card relative transform lg:-translate-y-2">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-brand-forest text-text-inverse text-[11px] uppercase tracking-wider font-semibold px-3 py-1 rounded-full shadow-sm">
                Most Popular
              </div>

              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="text-xl font-bold text-text-primary">Pro Plan</h3>
                  <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                    Full subscription automation with configurable Odoo brand variants and dynamic tax engines.
                  </p>
                </div>

                <div className="py-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-display font-medium text-text-primary">
                      ₹1,560.00
                    </span>
                    <span className="text-sm text-text-secondary font-medium">/Month</span>
                  </div>
                  <div className="text-xs text-text-muted mt-1">Billed monthly with anchor-date logic</div>
                </div>

                <Link
                  to="/signup"
                  className="w-full py-2.5 px-4 rounded-sm bg-brand-forest text-text-inverse font-medium text-sm text-center hover:bg-brand-forestDark transition-all shadow-sm"
                >
                  Go Pro Plan &rarr;
                </Link>

                <div className="border-t border-border-subtle pt-6 flex flex-col gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Everything in Starter, plus
                  </span>
                  <ul className="space-y-3 text-sm text-text-primary font-medium">
                    <li className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-brand-forest text-text-inverse flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>Configurable product price variants</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-brand-forest text-text-inverse flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>Idempotent automated recurring billing</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-brand-forest text-text-inverse flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>Automated GST intra/interstate tax splits</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-brand-forest text-text-inverse flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>Admin discount rules with usage limits</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-brand-forest text-text-inverse flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>Overdue tracking & payment reconciliation</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Team / Enterprise Plan Card */}
            <div className="bg-surface-page border border-border-subtle rounded-md p-8 flex flex-col justify-between transition-all hover:border-brand-taupe shadow-sm">
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="text-xl font-bold text-text-primary">Enterprise Annual</h3>
                  <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                    Scale-ready recurring billing infrastructure for high-volume corporate subscription fleets.
                  </p>
                </div>

                <div className="py-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-display font-medium text-text-primary">
                      ₹15,000.00
                    </span>
                    <span className="text-sm text-text-secondary font-medium">/Year</span>
                  </div>
                  <div className="text-xs text-text-muted mt-1">Includes 2 months free discount</div>
                </div>

                <Link
                  to="/signup"
                  className="w-full py-2.5 px-4 rounded-sm bg-surface-card border border-brand-taupe text-text-primary font-medium text-sm text-center hover:bg-brand-creamDeep transition-all"
                >
                  Contact Sales &rarr;
                </Link>

                <div className="border-t border-border-subtle pt-6 flex flex-col gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Everything in Pro, plus
                  </span>
                  <ul className="space-y-3 text-sm text-text-secondary">
                    <li className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-brand-forest/20 text-brand-forest flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>Dedicated Account Support service</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-brand-forest/20 text-brand-forest flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>Full MRR waterfall & cohort reporting</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-brand-forest/20 text-brand-forest flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>Maker-checker credit note governance</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-brand-forest/20 text-brand-forest flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>Sub-2 second queries on 50,000+ invoices</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Workflow Pillars */}
      <section id="workflow" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 flex flex-col gap-4">
          <span className="text-xs uppercase tracking-widest text-text-secondary font-semibold">
            The 7-Stage Architectural Journey
          </span>
          <h2 className="font-display text-4xl font-normal text-text-primary tracking-tight">
            How Brightloop powers your recurring lifecycle
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-surface-card border border-border-default rounded-md p-8 shadow-card flex flex-col gap-4">
            <div className="w-12 h-12 rounded-sm bg-brand-creamDeep flex items-center justify-center text-brand-forest">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-text-primary">1. Setup & Quotation</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Define products, base prices, configurable variant increments (+₹560), and plan cadences. Build quotations with automatic tax estimation and validity countdowns.
            </p>
          </div>

          <div className="bg-surface-card border border-border-default rounded-md p-8 shadow-card flex flex-col gap-4">
            <div className="w-12 h-12 rounded-sm bg-brand-creamDeep flex items-center justify-center text-brand-forest">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-text-primary">2. Idempotent Invoicing</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              When recurring billing runs trigger, invoices snapshot historical rates and eligible discounts. Partial compound keys guarantee zero duplicate invoices under retries.
            </p>
          </div>

          <div className="bg-surface-card border border-border-default rounded-md p-8 shadow-card flex flex-col gap-4">
            <div className="w-12 h-12 rounded-sm bg-brand-creamDeep flex items-center justify-center text-brand-forest">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-text-primary">3. Payments & Reporting</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Reconcile payments to invoice balances. Distinguish real cash revenue from invoiced receivables in real-time executive finance dashboards.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
