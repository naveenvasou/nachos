import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Today from './pages/Today';
import Chat from './pages/Chat';
import Focus from './pages/Focus';
import Strategy from './pages/Strategy';
import Welcome from './pages/Welcome';
import Settings from './pages/Settings';
import Landing from './pages/Landing';
import { loadProfile } from './profile';
import { track } from './analytics';

export default function App() {
  const location = useLocation();

  useEffect(() => {
    track('screen_viewed', { path: location.pathname });
  }, [location.pathname]);

  return (
    <Routes>
      {/* Public marketing — full-width, no app-shell */}
      <Route path="/landing" element={<Landing />} />

      {/* Everything else uses the phone-style app-shell */}
      <Route element={<AppShellLayout />}>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/" element={<RequireProfile><Today /></RequireProfile>} />
        <Route path="/chat" element={<RequireProfile><Chat /></RequireProfile>} />
        <Route path="/focus" element={<RequireProfile><Focus /></RequireProfile>} />
        <Route path="/strategy" element={<RequireProfile><Strategy /></RequireProfile>} />
        <Route path="/settings" element={<RequireProfile><Settings /></RequireProfile>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function AppShellLayout() {
  return (
    <div className="app-shell">
      {/* Outlet rendered by react-router via nested route */}
      <ShellOutlet />
    </div>
  );
}

// Tiny wrapper so we can keep the v6 element/Outlet API explicit.
import { Outlet } from 'react-router-dom';
function ShellOutlet() {
  return <Outlet />;
}

function RequireProfile({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const profile = loadProfile();
  if (!profile) {
    // First-time visitors land on the marketing page, not the onboarding form.
    return (
      <Navigate
        to="/landing"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }
  return <>{children}</>;
}
