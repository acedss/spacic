import { Navigate, Route, Routes } from "react-router-dom";
import AuthCallbackPage from "./pages/auth-callback/AuthCallbackPage";
import HomePage from "./pages/home/HomePage";
import { RoomPage } from "./pages/room/RoomPage";
import MainLayout from "./layout/MainLayout";
import { AdminPage } from "./pages/admin/AdminPage";
import { Toaster } from "./components/ui/sonner";
import NotFoundPage from "./pages/404/NotFoundPage";
import WalletPage from "./pages/wallet/WalletPage";
import SubscriptionPage from "./pages/subscription/SubscriptionPage";
import ProtectedRoute from "./components/ProtectedRoute";
import ProfilePage from "./pages/profile/ProfilePage";
import StudioPage from "./pages/studio/StudioPage";
import CreatorLivePage from "./pages/studio/CreatorLivePage";
import FriendsPage from "./pages/friends/FriendsPage";
import FavoritesPage from "./pages/favorites/FavoritesPage";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/auth-callback" element={<AuthCallbackPage />} />
        <Route path="/admin" element={<AdminPage />} />
        {/* Creator Live page — full screen, outside MainLayout sidebar */}
        <Route path="/studio/live" element={<ProtectedRoute><CreatorLivePage /></ProtectedRoute>} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/rooms/:roomId" element={<ProtectedRoute><RoomPage /></ProtectedRoute>} />
          <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
          <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/studio" element={<ProtectedRoute><StudioPage /></ProtectedRoute>} />
          {/* Keep /creator working — redirect to /studio */}
          <Route path="/creator" element={<Navigate to="/studio" replace />} />
          <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
          <Route path="/favorites" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <Toaster expand={false} richColors />
    </>
  );
}