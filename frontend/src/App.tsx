import { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate
} from 'react-router-dom';

import { Toaster } from 'react-hot-toast';
import { Menu, Sun, Moon, Bell } from 'lucide-react';

import { useAgentStore } from './store/useAgentStore';
import { useAuthStore } from './store/useAuthStore';
import { useThemeStore } from './store/useThemeStore';

import DashboardPage from './pages/DashboardPage';
import CreateAgentPage from './pages/CreateAgentPage';
import ComingSoonPage from './pages/ComingSoonPage';
import ToolsPage from './pages/ToolsPage';
import TelephonyPage from './pages/TelephonyPage';
import OutboundPage from './pages/OutboundPage';
import CallLogsPage from './pages/CallLogsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProvidersPage from './pages/ProvidersPage';
import AgentConfigurePage from './pages/AgentConfigurePage';
import AgentOverviewPage from './pages/AgentOverviewPage';
import AgentToolsPage from './pages/AgentToolsPage';
import AgentSettingsPage from './pages/AgentSettingsPage';
import AgentConversationsPage from './pages/AgentConversationsPage';
import AgentAnalyticsPage from './pages/AgentAnalyticsPage';
import AgentKnowledgePage from './pages/AgentKnowledgePage';

import { IntegrationsPage } from './pages/IntegrationsPage';
import { ProfilePage } from './pages/ProfilePage';

import Sidebar from './components/Sidebar';
import VoiceSession from './components/VoiceSession';
import { useParams } from 'react-router-dom';

const ComingSoonTab = () => {
  const { tab } = useParams<{ tab: string }>();
  const titleMap: Record<string, string> = {
    'procedures': 'Procedures Blueprint',
    'workflow': 'Workflow Engine',
    'branches': 'Workflow Branches',
    'knowledge-base': 'Knowledge Base',
    'analysis': 'Conversational Analysis',
    'widget': 'Web Voice Widget',
    'tests': 'Agent System Tests'
  };
  const title = (tab && titleMap[tab]) || 'Feature Module';
  return <ComingSoonPage title={title} />;
};

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

  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          className: '!rounded-lg !p-4 !shadow-lg',
          duration: 4000,
          style: {
            background: theme === 'light' ? '#FFFFFF' : '#1E293B',
            color: theme === 'light' ? '#0F172A' : '#F1F5F9',
            border: `1px solid ${theme === 'light' ? '#E2E8F0' : '#293548'}`,
            fontFamily: '"Inter", sans-serif',
            fontSize: '13px',
            fontWeight: '500',
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
    <div className="flex h-screen overflow-hidden antialiased relative" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Dot Grid Overlay */}
      <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-30 z-0" />

      {/* SIDEBAR */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* MAIN LAYOUT */}
      <main className="flex flex-1 flex-col overflow-hidden relative z-10">

        {/* HEADER */}
        <header 
          className="sticky top-0 z-50 h-16 shrink-0"
          style={{ 
            backgroundColor: 'var(--header-bg)',
            borderBottom: '1px solid var(--header-border)',
            backdropFilter: 'blur(20px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.8)'
          }}
        >
          <div className="flex h-full items-center justify-between px-4 lg:px-6">

            {/* LEFT */}
            <div className="flex items-center gap-3 min-w-0">

              {/* MOBILE MENU */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200"
                style={{ 
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-secondary)' 
                }}
              >
                <Menu size={18} />
              </button>

              {/* PAGE BREADCRUMB */}
              <div className="hidden md:flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                  HMS Platform
                </span>
                <span style={{ color: 'var(--text-muted)' }}>/</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Workspace
                </span>
              </div>
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-2">

              {/* NOTIFICATION */}
              <button
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200"
                style={{ 
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-secondary)' 
                }}
              >
                <Bell size={16} />
              </button>

              {/* THEME TOGGLE */}
              <button
                onClick={toggleTheme}
                className="w-9 h-9 rounded-lg flex items-center justify-center active:scale-95 transition-all duration-200"
                style={{ 
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-secondary)' 
                }}
              >
                {theme === 'light' ? (
                  <Moon size={16} />
                ) : (
                  <Sun size={16} />
                )}
              </button>

              {/* USER AVATAR */}
              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2.5 ml-1 group"
              >
                <div 
                  className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center text-xs font-semibold transition-all duration-200"
                  style={{ 
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text-primary)' 
                  }}
                >
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

                {/* NAME (hidden on small screens) */}
                <div className="hidden sm:flex flex-col items-start min-w-0">
                  <span className="text-sm font-medium truncate max-w-[160px]" style={{ color: 'var(--text-primary)' }}>
                    {user?.full_name || 'User'}
                  </span>
                  <span className="text-xs truncate max-w-[160px]" style={{ color: 'var(--text-muted)' }}>
                    {user?.email}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ backgroundColor: 'var(--background)' }}>

          <div className="px-4 py-6 md:px-6 lg:px-8">

            <Routes>
              <Route
                path="/"
                element={<DashboardPage />}
              />

              <Route
                path="/agents"
                element={<Navigate to="/" replace />}
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
                path="/outbound"
                element={<OutboundPage />}
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

              {/* DEDICATED AGENT WORKSPACE ROUTES */}
              <Route path="/agent/:agentId/overview" element={<AgentOverviewPage />} />
              <Route path="/agent/:agentId/configure" element={<AgentConfigurePage />} />
              <Route path="/agent/:agentId/knowledge" element={<AgentKnowledgePage />} />
              <Route path="/agent/:agentId/tools" element={<AgentToolsPage />} />
              <Route path="/agent/:agentId/settings" element={<AgentSettingsPage />} />
              <Route path="/agent/:agentId/conversations" element={<AgentConversationsPage />} />
              <Route path="/agent/:agentId/analytics" element={<AgentAnalyticsPage />} />
              <Route path="/agent/:agentId/coming-soon/:tab" element={<ComingSoonTab />} />
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