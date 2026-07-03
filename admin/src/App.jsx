import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth.jsx";
import { DraftProvider } from "./lib/draft.jsx";
import { BrandingProvider } from "./lib/branding.jsx";
import { ToastProvider } from "./components/ui.jsx";
import Login from "./pages/Login.jsx"; // eager: first paint

// Route-level code-splitting — each page is its own lazily-loaded chunk.
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Content = lazy(() => import("./pages/Content.jsx"));
const Sections = lazy(() => import("./pages/Sections.jsx"));
const Media = lazy(() => import("./pages/Media.jsx"));
const Workshops = lazy(() => import("./pages/Workshops.jsx"));
const WorkshopEdit = lazy(() => import("./pages/WorkshopEdit.jsx"));
const Registrations = lazy(() => import("./pages/Registrations.jsx"));
const Payments = lazy(() => import("./pages/Payments.jsx"));
const Users = lazy(() => import("./pages/Users.jsx"));
const Roles = lazy(() => import("./pages/Roles.jsx"));
const Audit = lazy(() => import("./pages/Audit.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Communication = lazy(() => import("./pages/Communication.jsx"));
const Attendance = lazy(() => import("./pages/Attendance.jsx"));
const Certificates = lazy(() => import("./pages/Certificates.jsx"));
const Verify = lazy(() => import("./pages/Verify.jsx"));
const Analytics = lazy(() => import("./pages/Analytics.jsx"));
const System = lazy(() => import("./pages/System.jsx"));

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
      <BrandingProvider>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<div className="center-screen">Loading…</div>}>
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
          </Suspense>
        </ToastProvider>
      </AuthProvider>
      </BrandingProvider>
    </BrowserRouter>
  );
}
