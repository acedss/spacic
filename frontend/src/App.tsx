import { Navigate, Route, Routes } from "react-router-dom";
import AuthCallbackPage from "./pages/auth-callback/AuthCallbackPage";
import OnboardingPage from "./pages/onboarding/OnboardingPage";
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
import RoomsPage from "./pages/rooms/RoomsPage";
import SearchPage from "./pages/search/SearchPage";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/auth-callback" element={<AuthCallbackPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          {/* Public rooms browse — no auth required */}
          <Route path="/rooms" element={<RoomsPage />} />
          {/* Individual room — unauthed visitors see GuestAuthDialog */}
          <Route path="/rooms/:roomId" element={<RoomPage />} />
          {/* /goal shows the album goals section on the home page */}
          <Route path="/goal" element={<Navigate to="/" replace />} />
          <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
          <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/studio" element={<ProtectedRoute><StudioPage /></ProtectedRoute>} />
          {/* Creator Live — inside MainLayout so sidebar + playback footer stay visible */}
          <Route path="/studio/live" element={<ProtectedRoute><CreatorLivePage /></ProtectedRoute>} />
          {/* Legacy redirects */}
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
