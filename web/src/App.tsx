import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Today from './pages/Today';
import Chat from './pages/Chat';
import Focus from './pages/Focus';
import Strategy from './pages/Strategy';
import Welcome from './pages/Welcome';
import Settings from './pages/Settings';
import { loadProfile } from './profile';

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route
          path="/"
          element={
            <RequireProfile>
              <Today />
            </RequireProfile>
          }
        />
        <Route
          path="/chat"
          element={
            <RequireProfile>
              <Chat />
            </RequireProfile>
          }
        />
        <Route
          path="/focus"
          element={
            <RequireProfile>
              <Focus />
            </RequireProfile>
          }
        />
        <Route
          path="/strategy"
          element={
            <RequireProfile>
              <Strategy />
            </RequireProfile>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireProfile>
              <Settings />
            </RequireProfile>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function RequireProfile({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const profile = loadProfile();
  if (!profile) {
    return (
      <Navigate
        to="/welcome"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }
  return <>{children}</>;
}
