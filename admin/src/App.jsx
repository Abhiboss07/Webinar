import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth.jsx";
import { DraftProvider } from "./lib/draft.jsx";
import { BrandingProvider } from "./lib/branding.jsx";
import { ToastProvider } from "./components/ui.jsx";
import ErrorBoundary, { recoverFromChunkError } from "./components/ErrorBoundary.jsx";
import Login from "./pages/Login.jsx"; // eager: first paint

// Route-level code-splitting — each page is its own lazily-loaded chunk. After a
// redeploy the old chunk URLs 404; recoverFromChunkError reloads once to pick up
// the new build instead of leaving the user on a white screen.
const lazyPage = (load) => lazy(() =>
  load().catch((err) => {
    if (recoverFromChunkError(err)) return new Promise(() => {}); // reloading — keep the fallback up
    throw err; // real failure → nearest ErrorBoundary
  })
);

const Dashboard = lazyPage(() => import("./pages/Dashboard.jsx"));
const Content = lazyPage(() => import("./pages/Content.jsx"));
const Sections = lazyPage(() => import("./pages/Sections.jsx"));
const Media = lazyPage(() => import("./pages/Media.jsx"));
const Workshops = lazyPage(() => import("./pages/Workshops.jsx"));
const WorkshopEdit = lazyPage(() => import("./pages/WorkshopEdit.jsx"));
const Registrations = lazyPage(() => import("./pages/Registrations.jsx"));
const Payments = lazyPage(() => import("./pages/Payments.jsx"));
const Users = lazyPage(() => import("./pages/Users.jsx"));
const Roles = lazyPage(() => import("./pages/Roles.jsx"));
const Audit = lazyPage(() => import("./pages/Audit.jsx"));
const Settings = lazyPage(() => import("./pages/Settings.jsx"));
const Communication = lazyPage(() => import("./pages/Communication.jsx"));
const Attendance = lazyPage(() => import("./pages/Attendance.jsx"));
const Certificates = lazyPage(() => import("./pages/Certificates.jsx"));
const Verify = lazyPage(() => import("./pages/Verify.jsx"));
const Analytics = lazyPage(() => import("./pages/Analytics.jsx"));
const System = lazyPage(() => import("./pages/System.jsx"));

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

// Boundary keyed to the route: a crash on one page shows the recovery card, and
// simply navigating elsewhere (sidebar still works after reload) clears it.
function AppRoutes() {
  const location = useLocation();
  return (
    <ErrorBoundary resetKey={location.pathname}>
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
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <BrandingProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
        </BrandingProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
