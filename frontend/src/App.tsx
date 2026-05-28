import { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate
} from 'react-router-dom';

import { Toaster } from 'react-hot-toast';
import { Menu, Sun, Moon } from 'lucide-react';

import { useAgentStore } from './store/useAgentStore';
import { useAuthStore } from './store/useAuthStore';
import { useThemeStore } from './store/useThemeStore';

import DashboardPage from './pages/DashboardPage';
import AgentsPage from './pages/AgentsPage';
import CreateAgentPage from './pages/CreateAgentPage';
import ComingSoonPage from './pages/ComingSoonPage';
import ToolsPage from './pages/ToolsPage';
import TelephonyPage from './pages/TelephonyPage';
import CallLogsPage from './pages/CallLogsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProvidersPage from './pages/ProvidersPage';

import { IntegrationsPage } from './pages/IntegrationsPage';
import { ProfilePage } from './pages/ProfilePage';

import Sidebar from './components/Sidebar';
import VoiceSession from './components/VoiceSession';

const ProtectedRoute = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const isAuthenticated = useAuthStore((state) =>
    state.isAuthenticated()
  );

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App = () => {
  const { theme } = useThemeStore();
  const isLight = theme === 'light';

  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          className: '!rounded-2xl !p-4 !shadow-2xl border',
          duration: 4000,
          style: {
            background: isLight ? 'rgba(255, 255, 255, 0.88)' : 'rgba(9, 9, 11, 0.88)',
            backdropFilter: 'blur(16px)',
            color: isLight ? '#09090b' : '#ffffff',
            borderColor: isLight ? 'rgba(9, 9, 11, 0.08)' : 'rgba(255, 255, 255, 0.08)',
            fontFamily: 'ui-monospace, "Cascadia Code", monospace',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontSize: '11px',
            fontWeight: 'bold',
          }
        }}
      />

      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="*"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
};

const AppLayout = () => {
  const { activeSession, setActiveSession } =
    useAgentStore();

  const user = useAuthStore((state) => state.user);

  const { theme, toggleTheme } = useThemeStore();

  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] =
    useState(false);

  useEffect(() => {
    const root = window.document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground antialiased">

      {/* SIDEBAR */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* MAIN LAYOUT */}
      <main className="flex flex-1 flex-col overflow-hidden">

        {/* HEADER */}
        <header className="sticky top-0 z-50 h-16 shrink-0 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl">

          <div className="flex h-full items-center justify-between px-4 lg:px-6">

            {/* LEFT */}
            <div className="flex items-center gap-4 min-w-0">

              {/* MOBILE MENU */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 transition-all duration-200"
              >
                <Menu size={18} />
              </button>

              {/* STATUS */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10">

                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />

                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300 whitespace-nowrap">
                  System Online
                </span>
              </div>

              {/* DIVIDER */}
              <div className="hidden md:block h-5 w-px bg-zinc-800" />

              {/* USER */}
              <button
                onClick={() => navigate('/profile')}
                className="group flex items-center gap-3 min-w-0"
              >
                {/* AVATAR */}
                <div className="w-9 h-9 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 flex items-center justify-center text-sm font-bold text-zinc-100 transition-all duration-200 group-hover:border-primary/40">

                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user?.full_name
                      ?.split(' ')
                      .map((n) => n[0])
                      .join('') || 'U'
                  )}
                </div>

                {/* INFO */}
                <div className="hidden sm:flex flex-col items-start min-w-0">

                  <span className="text-sm font-semibold text-zinc-100 truncate max-w-[180px]">
                    {user?.full_name || 'User'}
                  </span>

                  <span className="text-xs text-zinc-500 truncate max-w-[180px]">
                    {user?.email}
                  </span>
                </div>
              </button>
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-3">

              {/* LIVE NODES */}
              <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60">

                <div className="flex -space-x-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full border-2 border-zinc-950 bg-zinc-700"
                    />
                  ))}
                </div>

                <span className="text-xs font-medium text-zinc-400 whitespace-nowrap">
                  14 Nodes Live
                </span>
              </div>

              {/* THEME TOGGLE */}
              <button
                onClick={toggleTheme}
                className="w-10 h-10 rounded-xl border border-zinc-800 bg-zinc-900/70 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 active:scale-95 transition-all duration-200"
              >
                {theme === 'light' ? (
                  <Moon size={17} />
                ) : (
                  <Sun size={17} />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">

          <div className="px-4 py-6 md:px-6 lg:px-8">

            <Routes>
              <Route
                path="/"
                element={<DashboardPage />}
              />

              <Route
                path="/agents"
                element={<AgentsPage />}
              />

              <Route
                path="/agents/create"
                element={<CreateAgentPage />}
              />

              <Route
                path="/numbers"
                element={<TelephonyPage />}
              />

              <Route
                path="/logs"
                element={
                  <CallLogsPage />
                }
              />

              <Route
                path="/analytics"
                element={
                  <AnalyticsPage />
                }
              />

              <Route
                path="/providers"
                element={<ProvidersPage />}
              />

              <Route
                path="/tools"
                element={<ToolsPage />}
              />

              <Route
                path="/integrations"
                element={<IntegrationsPage />}
              />

              <Route
                path="/profile"
                element={<ProfilePage />}
              />

              <Route
                path="/settings"
                element={
                  <SettingsPage />
                }
              />

              <Route
                path="/help"
                element={
                  <ComingSoonPage title="Help & Support" />
                }
              />
            </Routes>
          </div>
        </div>
      </main>

      {/* VOICE SESSION OVERLAY */}
      {activeSession && (
        <VoiceSession
          token={activeSession.token}
          url={activeSession.url}
          agentName={activeSession.agentName}
          onDisconnect={() =>
            setActiveSession(null)
          }
        />
      )}
    </div>
  );
};

export default App;