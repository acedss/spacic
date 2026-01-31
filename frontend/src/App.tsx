import { Route, Routes } from "react-router-dom";
import AuthCallbackPage from "./pages/auth-callback/AuthCallbackPage";
import HomePage from "./pages/home/HomePage";
import MainLayout from "./layout/MainLayout";
import { AdminPage } from "./pages/admin/AdminPage";
import { Toaster } from "./components/ui/sonner";
import NotFoundPage from "./pages/404/NotFoundPage";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/auth-callback" element={<AuthCallbackPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <Toaster expand={false} richColors />
    </>
  );
}