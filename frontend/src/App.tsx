import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { AdminLoginPage } from "./admin/AdminLogin";
import {
  AdminAuditPage,
  AdminBannersPage,
  AdminCategoriesPage,
  AdminCitiesPage,
  AdminConversationsPage,
  AdminDashboard,
  AdminLayout,
  AdminListingsPage,
  AdminOffersPage,
  AdminReportsPage,
  AdminReviewsPage,
  AdminSettingsPage,
  AdminUserDetailPage,
  AdminUsersPage,
} from "./admin/AdminPages";
import { Layout } from "./components/Layout";
import { Seo } from "./components/Seo";
import { FullSpinner } from "./components/ui";
import { useAuth } from "./context/AuthContext";
import { AccountPage, FavoritesPage, NotificationsPage } from "./pages/AccountPages";
import { ForgotPage, LoginPage, RegisterPage, ResetPage, VerifyEmailPage } from "./pages/AuthPages";
import { CreateListingPage } from "./pages/CreateListingPage";
import { HomePage } from "./pages/HomePage";
import { ListingPage, SellerPage } from "./pages/ListingPage";
import { MessagesPage } from "./pages/MessagesPage";
import { SearchPage } from "./pages/SearchPage";
import { AboutPage, ContactPage, PrivacyPage, RulesPage } from "./pages/StaticPages";

const STAFF = ["MODERATOR", "ADMIN", "SUPER_ADMIN"];

function Guard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullSpinner />;
  if (!user) return <Navigate to={`/giris?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}

function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullSpinner />;
  if (!user) return <Navigate to="/admin/giris" replace />;
  if (!STAFF.includes(user.role || "")) return <Navigate to="/admin/giris?icaze=yox" replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="axtaris" element={<SearchPage />} />
        <Route path="kateqoriya/:slug" element={<SearchPage />} />
        <Route path="elan/:slug" element={<ListingPage />} />
        <Route path="istifadeci/:id" element={<SellerPage />} />
        <Route path="giris" element={<LoginPage />} />
        <Route path="qeydiyyat" element={<RegisterPage />} />
        <Route path="sifre-unutdum" element={<ForgotPage />} />
        <Route path="sifre-yenile" element={<ResetPage />} />
        <Route path="email-tesdiq" element={<VerifyEmailPage />} />
        <Route path="haqqimizda" element={<AboutPage />} />
        <Route path="qaydalar" element={<RulesPage />} />
        <Route path="mexfilik" element={<PrivacyPage />} />
        <Route path="elaqe" element={<ContactPage />} />
        <Route path="favoriler" element={<Guard><FavoritesPage /></Guard>} />
        <Route path="bildirisler" element={<Guard><NotificationsPage /></Guard>} />
        <Route path="mesajlar" element={<Guard><MessagesPage /></Guard>} />
        <Route path="mesajlar/:id" element={<Guard><MessagesPage /></Guard>} />
        <Route path="hesab" element={<Guard><AccountPage /></Guard>} />
        <Route path="elan-yerlesdir" element={<Guard><CreateListingPage /></Guard>} />
        <Route path="elan/:slug/redakte" element={<Guard><CreateListingPage /></Guard>} />
        <Route path="*" element={<div><Seo title="Tapılmadı" /><h1 className="text-2xl font-bold">Səhifə tapılmadı</h1></div>} />
      </Route>
      <Route path="admin/giris" element={<AdminLoginPage />} />
      <Route path="admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
        <Route index element={<AdminDashboard />} />
        <Route path="istifadeciler" element={<AdminUsersPage />} />
        <Route path="istifadeciler/:id" element={<AdminUserDetailPage />} />
        <Route path="elanlar" element={<AdminListingsPage />} />
        <Route path="kateqoriyalar" element={<AdminCategoriesPage />} />
        <Route path="seherler" element={<AdminCitiesPage />} />
        <Route path="bannerler" element={<AdminBannersPage />} />
        <Route path="sikayetler" element={<AdminReportsPage />} />
        <Route path="reyler" element={<AdminReviewsPage />} />
        <Route path="yazismalar" element={<AdminConversationsPage />} />
        <Route path="yazismalar/:id" element={<AdminConversationsPage />} />
        <Route path="teklifler" element={<AdminOffersPage />} />
        <Route path="jurnal" element={<AdminAuditPage />} />
        <Route path="tenzimlemeler" element={<AdminSettingsPage />} />
      </Route>
    </Routes>
  );
}
