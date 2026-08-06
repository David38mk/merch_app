import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { useAuth } from "./auth";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { PublicLayout } from "./components/layout/PublicLayout";
import ForgotPassword from "./pages/ForgotPassword";
import Landing from "./pages/Landing";
import { Privacy, Terms } from "./pages/Legal";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Wishlist from "./pages/Wishlist";
import Login from "./pages/Login";
import Marketplace from "./pages/Marketplace";
import OrderConfirmed from "./pages/OrderConfirmed";
import ProductDetails from "./pages/ProductDetails";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import SellerSignup from "./pages/SellerSignup";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import CollaborationWorkspace from "./pages/dashboard/CollaborationWorkspace";
import DesignerProfile from "./pages/dashboard/DesignerProfile";
import Overview from "./pages/dashboard/Overview";
import BuyerOrderDetail from "./pages/dashboard/buyer/BuyerOrderDetail";
import BuyerOrders from "./pages/dashboard/buyer/BuyerOrders";
import CallDetail from "./pages/dashboard/designer/CallDetail";
import DesignerCalls from "./pages/dashboard/designer/DesignerCalls";
import DesignerCollabs from "./pages/dashboard/designer/DesignerCollabs";
import PrintShopCatalog from "./pages/dashboard/printshop/PrintShopCatalog";
import PrintShopQueue from "./pages/dashboard/printshop/PrintShopQueue";
import DesignEditor from "./pages/dashboard/seller/DesignEditor";
import JobDetail from "./pages/dashboard/seller/JobDetail";
import JobForm from "./pages/dashboard/seller/JobForm";
import ProductDetail from "./pages/dashboard/seller/ProductDetail";
import ProductEdit from "./pages/dashboard/seller/ProductEdit";
import ProductNew from "./pages/dashboard/seller/ProductNew";
import SellerCatalog from "./pages/dashboard/seller/SellerCatalog";
import SellerHiring from "./pages/dashboard/seller/SellerHiring";
import SellerProducts from "./pages/dashboard/seller/SellerProducts";
import SellerStorefront from "./pages/dashboard/seller/SellerStorefront";
import Notifications from "./pages/dashboard/Notifications";
import Settings from "./pages/dashboard/Settings";
import OrderDetail from "./pages/dashboard/seller/OrderDetail";
import SellerAnalytics from "./pages/dashboard/seller/SellerAnalytics";
import SellerOrders from "./pages/dashboard/seller/SellerOrders";
import SellerStudio from "./pages/dashboard/seller/SellerStudio";
import StorefrontPreview from "./pages/dashboard/seller/StorefrontPreview";
import SellerOnboarding from "./pages/onboarding/SellerOnboarding";
import Storefront from "./pages/store/Storefront";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="flex h-screen items-center justify-center text-sm text-slate-400">Loading…</div>;
  // Remember where they were headed so login can send them back there.
  return user ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  );
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
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/p/:id" element={<ProductDetails />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/checkout/:slug" element={<Checkout />} />
        <Route path="/order/confirmed/:token" element={<OrderConfirmed />} />
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
          path="/sell"
          element={
            <GuestOnly>
              <SellerSignup />
            </GuestOnly>
          }
        />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
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
        <Route path="/seller/storefront/preview" element={<StorefrontPreview />} />
        <Route path="/seller/catalog" element={<SellerCatalog />} />
        <Route path="/seller/catalog/:id" element={<ProductDetail />} />
        <Route path="/seller/design/:baseItemId" element={<DesignEditor />} />
        <Route path="/seller/products" element={<SellerProducts />} />
        <Route path="/seller/products/new" element={<ProductNew />} />
        <Route path="/seller/products/:id/edit" element={<ProductEdit />} />
        <Route path="/seller/orders" element={<SellerOrders />} />
        <Route path="/seller/orders/:id" element={<OrderDetail />} />
        <Route path="/seller/analytics" element={<SellerAnalytics />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/seller/hiring" element={<SellerHiring />} />
        <Route path="/seller/hiring/new" element={<JobForm />} />
        <Route path="/seller/hiring/:id" element={<JobDetail />} />
        <Route path="/seller/hiring/:id/edit" element={<JobForm />} />
        <Route path="/designer" element={<DesignerCalls />} />
        <Route path="/designer/calls/:id" element={<CallDetail />} />
        <Route path="/designers/:slug" element={<DesignerProfile />} />
        <Route path="/collaborations/:id" element={<CollaborationWorkspace />} />
        <Route path="/designer/collabs" element={<DesignerCollabs />} />
        <Route path="/printshop" element={<PrintShopQueue />} />
        <Route path="/printshop/catalog" element={<PrintShopCatalog />} />
        <Route path="/orders" element={<BuyerOrders />} />
        <Route path="/orders/:id" element={<BuyerOrderDetail />} />
      </Route>
    </Routes>
  );
}
