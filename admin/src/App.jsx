import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth.jsx";
import { DraftProvider } from "./lib/draft.jsx";
import { ToastProvider } from "./components/ui.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Content from "./pages/Content.jsx";
import Sections from "./pages/Sections.jsx";
import Media from "./pages/Media.jsx";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen">Loading…</div>;
  if (user) return <Navigate to="/" replace />;
  return children;
}

// Content + Sections share ONE draft (autosave + publish), so they live under a
// single DraftProvider that stays mounted while navigating between them.
function ContentArea() {
  return (
    <Protected>
      <DraftProvider><Outlet /></DraftProvider>
    </Protected>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route element={<ContentArea />}>
              <Route path="/content" element={<Content />} />
              <Route path="/sections" element={<Sections />} />
            </Route>
            <Route path="/media" element={<Protected><Media /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
