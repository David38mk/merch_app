import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { PublicLayout } from "./components/layout/PublicLayout";
import ForgotPassword from "./pages/ForgotPassword";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import Overview from "./pages/dashboard/Overview";
import BuyerOrders from "./pages/dashboard/buyer/BuyerOrders";
import DesignerCalls from "./pages/dashboard/designer/DesignerCalls";
import DesignerCollabs from "./pages/dashboard/designer/DesignerCollabs";
import PrintShopCatalog from "./pages/dashboard/printshop/PrintShopCatalog";
import PrintShopQueue from "./pages/dashboard/printshop/PrintShopQueue";
import SellerHiring from "./pages/dashboard/seller/SellerHiring";
import SellerProducts from "./pages/dashboard/seller/SellerProducts";
import SellerStorefront from "./pages/dashboard/seller/SellerStorefront";
import SellerStudio from "./pages/dashboard/seller/SellerStudio";
import SellerOnboarding from "./pages/onboarding/SellerOnboarding";
import Storefront from "./pages/store/Storefront";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-sm text-slate-400">Loading…</div>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

/** Auth screens (login/signup/forgot) must not show to an already-logged-in user. */
function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-sm text-slate-400">Loading…</div>;
  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public storefront + auth shell */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route
          path="/login"
          element={
            <GuestOnly>
              <Login />
            </GuestOnly>
          }
        />
        <Route
          path="/signup"
          element={
            <GuestOnly>
              <Signup />
            </GuestOnly>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <GuestOnly>
              <ForgotPassword />
            </GuestOnly>
          }
        />
        {/* reset-password + verify-email stay reachable while logged in (token links) */}
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Public storefront — its own branded page, reachable by anyone (no auth) */}
      <Route path="/store/:slug" element={<Storefront />} />

      {/* Onboarding — auth required, full-page (no dashboard chrome) */}
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <SellerOnboarding />
          </RequireAuth>
        }
      />

      {/* Dashboard shell (auth required) */}
      <Route
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<Overview />} />
        <Route path="/seller" element={<SellerStudio />} />
        <Route path="/seller/storefront" element={<SellerStorefront />} />
        <Route path="/seller/products" element={<SellerProducts />} />
        <Route path="/seller/hiring" element={<SellerHiring />} />
        <Route path="/designer" element={<DesignerCalls />} />
        <Route path="/designer/collabs" element={<DesignerCollabs />} />
        <Route path="/printshop" element={<PrintShopQueue />} />
        <Route path="/printshop/catalog" element={<PrintShopCatalog />} />
        <Route path="/orders" element={<BuyerOrders />} />
      </Route>
    </Routes>
  );
}
