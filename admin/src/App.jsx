import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth.jsx";
import { DraftProvider } from "./lib/draft.jsx";
import { ToastProvider } from "./components/ui.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Content from "./pages/Content.jsx";
import Sections from "./pages/Sections.jsx";
import Media from "./pages/Media.jsx";
import Workshops from "./pages/Workshops.jsx";
import WorkshopEdit from "./pages/WorkshopEdit.jsx";
import Registrations from "./pages/Registrations.jsx";
import Payments from "./pages/Payments.jsx";
import Users from "./pages/Users.jsx";
import Roles from "./pages/Roles.jsx";
import Audit from "./pages/Audit.jsx";
import Settings from "./pages/Settings.jsx";
import Communication from "./pages/Communication.jsx";
import Attendance from "./pages/Attendance.jsx";
import Certificates from "./pages/Certificates.jsx";
import Verify from "./pages/Verify.jsx";
import Analytics from "./pages/Analytics.jsx";
import System from "./pages/System.jsx";

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
            <Route path="/verify" element={<Verify />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route element={<ContentArea />}>
              <Route path="/content" element={<Content />} />
              <Route path="/sections" element={<Sections />} />
            </Route>
            <Route path="/media" element={<Protected><Media /></Protected>} />
            <Route path="/workshops" element={<Protected><Workshops /></Protected>} />
            <Route path="/workshops/:id" element={<Protected><WorkshopEdit /></Protected>} />
            <Route path="/registrations" element={<Protected><Registrations /></Protected>} />
            <Route path="/payments" element={<Protected><Payments /></Protected>} />
            <Route path="/users" element={<Protected><Users /></Protected>} />
            <Route path="/roles" element={<Protected><Roles /></Protected>} />
            <Route path="/audit" element={<Protected><Audit /></Protected>} />
            <Route path="/system" element={<Protected><System /></Protected>} />
            <Route path="/settings" element={<Protected><Settings /></Protected>} />
            <Route path="/communication" element={<Protected><Communication /></Protected>} />
            <Route path="/attendance" element={<Protected><Attendance /></Protected>} />
            <Route path="/certificates" element={<Protected><Certificates /></Protected>} />
            <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
