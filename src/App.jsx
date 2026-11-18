import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import AdminDashboard from './pages/admin/AdminDashboard';
import AccountStatusPage from './pages/auth/AccountStatusPage';
import CourierRegisterPage from './pages/auth/CourierRegisterPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import CourierJobPage from './pages/courier/CourierJobPage';
import CourierJobsPage from './pages/courier/CourierJobsPage';
import CheckoutPage from './pages/customer/CheckoutPage';
import DeliveryPage from './pages/customer/DeliveryPage';
import OrderPage from './pages/customer/OrderPage';
import OrdersPage from './pages/customer/OrdersPage';
import OutletPage from './pages/customer/OutletPage';
import OutletsPage from './pages/customer/OutletsPage';
import SupportPage from './pages/customer/SupportPage';
import RestaurantDashboard from './pages/restaurant/RestaurantDashboard';
import AccessDenied from './pages/shared/AccessDenied';
import NotFound from './pages/shared/NotFound';
import ProfilePage from './pages/shared/ProfilePage';
import WalletPage from './pages/shared/WalletPage';
import { useCurrentUser } from './store/store';

/** Client-side role gate. Milestone 2 enforces the same rules on the server. */
function RequireRole({ roles }) {
  const user = useCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.verification.customer !== 'approved') return <Navigate to="/account-status" replace />;
  if (!roles) return <Outlet />;
  if (roles.includes('courier') && !user.roles.includes('courier') && roles.length === 1 && user.roles.includes('customer')) {
    return <Navigate to="/courier/register" replace />;
  }
  if (!roles.some((role) => user.roles.includes(role))) return <AccessDenied />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="courier/register" element={<CourierRegisterPage />} />
        <Route path="account-status" element={<AccountStatusPage />} />

        <Route element={<RequireRole roles={['customer']} />}>
          <Route index element={<OutletsPage />} />
          <Route path="outlets/:id" element={<OutletPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:id" element={<OrderPage />} />
          <Route path="orders/:id/delivery" element={<DeliveryPage />} />
        </Route>

        <Route element={<RequireRole roles={['customer', 'courier']} />}>
          <Route path="wallet" element={<WalletPage />} />
          <Route path="support" element={<SupportPage />} />
        </Route>

        <Route element={<RequireRole />}>
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route element={<RequireRole roles={['courier']} />}>
          <Route path="courier" element={<CourierJobsPage />} />
          <Route path="courier/jobs/:id" element={<CourierJobPage />} />
        </Route>

        <Route element={<RequireRole roles={['restaurant']} />}>
          <Route path="restaurant" element={<RestaurantDashboard />} />
        </Route>

        <Route element={<RequireRole roles={['admin']} />}>
          <Route path="admin" element={<AdminDashboard />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
