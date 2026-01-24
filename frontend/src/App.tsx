// import { Route, Routes } from "react-router-dom";
// // import AuthCallbackPage from "./pages/auth-callback/AuthCallbackPage";
// import HomePage from "./pages/home/HomePage";
// import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
// import MainLayout from "./layout/MainLayout";
// // import AlbumPage from "./pages/album/AlbumPage";
// import { AdminPage } from "./pages/admin/AdminPage";
// import { Toaster } from "./components/ui/sonner";
import SignInOAuthButtons from "./components/ui/SignInOAuthButtons";
// import NotFoundPage from "./pages/404/NotFoundPage";

export default function App() {
  // token => 

  return (
    // <>
    //   <Routes>
    //     <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback signUpForceRedirectUrl={"/auth-callback"} />} />
    //     {/* <Route path="/auth-callback" element={<AuthCallbackPage />} /> */}
    //     <Route path="/admin" element={<AdminPage />} />

    //     <Route element={<MainLayout />}>
    //       <Route path="/" element={<HomePage />} />
    //       {/* <Route path="/albums/:albumId" element={<AlbumPage />} />
    //       <Route path="*" element={<NotFoundPage />} /> */}
    //     </Route>
    //   </Routes>
    //   <Toaster expand={false} richColors />
    // </>
    <SignInOAuthButtons></SignInOAuthButtons>
  );
}  