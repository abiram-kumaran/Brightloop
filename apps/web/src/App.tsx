import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { PublicLayout } from "./layouts/PublicLayout.js";
import { LandingPage } from "./pages/public/LandingPage.js";
import { CustomerLoginPage } from "./pages/auth/CustomerLoginPage.js";
import { CustomerSignupPage } from "./pages/auth/CustomerSignupPage.js";
import { CompanyLoginPage } from "./pages/auth/CompanyLoginPage.js";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage.js";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage.js";
import { AdminLayout } from "./layouts/AdminLayout.js";
import { StaffLayout } from "./layouts/StaffLayout.js";
import { CustomerPortalLayout } from "./layouts/CustomerPortalLayout.js";
import { ProductsPage } from "./pages/admin/ProductsPage.js";
import { PlansPage } from "./pages/admin/PlansPage.js";
import { TaxRulesPage } from "./pages/admin/TaxRulesPage.js";
import { DiscountsPage } from "./pages/admin/DiscountsPage.js";
import { QuotationsPage } from "./pages/admin/QuotationsPage.js";
import { SubscriptionsPage } from "./pages/admin/SubscriptionsPage.js";
import { SubscriptionDetailPage } from "./pages/admin/SubscriptionDetailPage.js";
import { InvoicesPage } from "./pages/admin/InvoicesPage.js";
import { PaymentsPage } from "./pages/admin/PaymentsPage.js";
import { ReportsPage } from "./pages/admin/ReportsPage.js";
import { PortalDashboardPage } from "./pages/portal/PortalDashboardPage.js";
import { CustomerSubscriptionsPage } from "./pages/portal/CustomerSubscriptionsPage.js";
import { CustomerInvoicesPage } from "./pages/portal/CustomerInvoicesPage.js";
import { CustomerPaymentsPage } from "./pages/portal/CustomerPaymentsPage.js";
import { CustomerSupportPage } from "./pages/portal/CustomerSupportPage.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-page">
        <div className="text-sm font-medium text-text-secondary animate-pulse">
          Loading workspace session...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === "admin") return <Navigate to="/admin" replace />;
    if (user.role === "staff" || user.role === "manager") return <Navigate to="/staff" replace />;
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary title="Application Error" message="An unexpected error occurred. Please refresh the page to continue.">
          <Routes>
          {/* Public Website Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/signup" element={<CustomerSignupPage />} />
            <Route path="/login" element={<CustomerLoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          {/* Internal Company Login (Admin + Staff) */}
          <Route path="/company/login" element={<CompanyLoginPage />} />
          <Route path="/company/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/company/reset-password" element={<ResetPasswordPage />} />

          {/* Admin Workspace */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ProductsPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="plans" element={<PlansPage />} />
            <Route path="taxes" element={<TaxRulesPage />} />
            <Route path="discounts" element={<DiscountsPage />} />
            <Route path="quotations" element={<QuotationsPage />} />
            <Route path="subscriptions" element={<SubscriptionsPage />} />
            <Route path="subscriptions/:id" element={<SubscriptionDetailPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>

          {/* Staff Workspace */}
          <Route
            path="/staff"
            element={
              <ProtectedRoute allowedRoles={["admin", "staff", "manager"]}>
                <StaffLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<QuotationsPage />} />
            <Route path="quotations" element={<QuotationsPage />} />
            <Route path="subscriptions" element={<SubscriptionsPage />} />
            <Route path="subscriptions/:id" element={<SubscriptionDetailPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>


          {/* Customer Self-Service Portal */}
          <Route
            path="/portal"
            element={
              <ProtectedRoute allowedRoles={["customer", "admin"]}>
                <CustomerPortalLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<PortalDashboardPage />} />
            <Route path="subscriptions" element={<CustomerSubscriptionsPage />} />
            <Route path="invoices" element={<CustomerInvoicesPage />} />
            <Route path="payments" element={<CustomerPaymentsPage />} />
            <Route path="support" element={<CustomerSupportPage />} />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
