import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, use_auth } from "./auth";
import Sidebar from "./components/sidebar";
import SplashPage from "./pages/splash";
// import CallbackPage from "./pages/callback";
import HomePage from "./pages/home";
import CreatePage from "./pages/create";
import NotificationsPage from "./pages/notifications";
import ProfilePage from "./pages/profile";
import ThreadPage from "./pages/thread";
import UserProfilePage from "./pages/user_profile";
import SearchPage from "./pages/search";
import { EyeIcon } from "./icons";

function ProtectedRoute({ children }) {
  const { user, loading } = use_auth();
  if (loading) return <div className="loading_spinner"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/" />;
  return (
    <div className="app_layout">
      <Sidebar />
      <div className="main_content">{children}</div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = use_auth();
  if (loading) return <div className="loading_spinner"><div className="spinner" /></div>;
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/home" /> : <SplashPage />} />
// <Route path="/callback" element={<CallbackPage />} />
      <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
      <Route path="/create" element={<ProtectedRoute><CreatePage /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/thread/:id" element={<ProtectedRoute><ThreadPage /></ProtectedRoute>} />
      <Route path="/user/:uid" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function SecurityWall({ children }) {
  const [countdown, set_countdown] = useState(5);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => set_countdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (countdown > 0) {
    return (
      <div className="splash_screen">
        <div className="cf_security_card" style={{ animation: "fade_in_up 0.5s ease" }}>
          <div className="cf_icon_wrap">
            <EyeIcon size={64} />
          </div>
          <h2 className="cf_title">Verifying your connection</h2>
          <p className="cf_desc">This is a standard security check to protect against automated attacks.</p>
          <div className="cf_spinner_wrap">
            <div className="cf_spinner"></div>
          </div>
          <p className="cf_redirect_text">You will be redirected automatically in {countdown} seconds...</p>
          <div className="cf_challenge">Challenge: {Math.random().toString(16).slice(2, 14)}{Math.random().toString(16).slice(2, 8)}</div>
        </div>
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <SecurityWall>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </SecurityWall>
  );
}
