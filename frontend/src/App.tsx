import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAgentStore } from './store/useAgentStore';
import DashboardPage from './pages/DashboardPage';
import AgentsPage from './pages/AgentsPage';
import CreateAgentPage from './pages/CreateAgentPage';
import ComingSoonPage from './pages/ComingSoonPage';
import ToolsPage from './pages/ToolsPage';
import TelephonyPage from './pages/TelephonyPage';
import VoiceSession from './components/VoiceSession';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { ProfilePage } from './pages/ProfilePage';
import Sidebar from './components/Sidebar';
import { useAuthStore } from './store/useAuthStore';
import { Navigate, useNavigate } from 'react-router-dom';
import { 
  Menu
} from 'lucide-react';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated());
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};


const App = () => {

  return (
    <Router>
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'glass !bg-zinc-900 !text-white !border-white/10 !rounded-xl !p-4 !text-sm !shadow-2xl',
          duration: 4000
        }}
      />
      
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        <Route path="*" element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
};

const AppLayout = () => {
  const { activeSession, setActiveSession } = useAgentStore();
  const user = useAuthStore(state => state.user);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-zinc-950 font-sans selection:bg-primary/30 selection:text-white antialiased overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <main className="flex-1 relative overflow-auto custom-scrollbar flex flex-col">
        {/* HEADER */}
        <header className="h-16 px-4 md:px-6 flex items-center justify-between border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-3 md:gap-5">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-zinc-400 hover:text-white lg:hidden"
            >
              <Menu size={20} />
            </button>

            <div className="hidden sm:flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/40" />
               <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none">Operator Online</span>
            </div>
            <div className="hidden sm:block h-3 w-px bg-white/10 mx-5" />
            
            <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition-opacity group" onClick={() => navigate('/profile')}>
              <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-[9px] font-black text-primary overflow-hidden uppercase group-hover:border-primary/40 transition-colors">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  user?.full_name?.split(' ').map(n => n[0]).join('') || 'ID'
                )}
              </div>
              <span className="text-[13px] font-bold text-zinc-200 tracking-tight line-clamp-1 group-hover:text-primary transition-colors">{user?.full_name || user?.email}</span>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="hidden xs:flex -space-x-1.5">
               {[1,2,3].map(i => (
                 <div key={i} className="w-6 h-6 rounded-full border border-zinc-950 bg-zinc-800" />
               ))}
            </div>
            <span className="text-[9px] font-bold text-zinc-700 uppercase tracking-tighter hidden xs:block">14 Nodes Live</span>
          </div>
        </header>

        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/agents/create" element={<CreateAgentPage />} />
            <Route path="/numbers" element={<TelephonyPage />} />
            <Route path="/logs" element={<ComingSoonPage title="Call Logs" />} />
            <Route path="/analytics" element={<ComingSoonPage title="Analytics" />} />
            <Route path="/keys" element={<ComingSoonPage title="API Keys" />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<ComingSoonPage title="Settings" />} />
            <Route path="/help" element={<ComingSoonPage title="Help & Support" />} />
          </Routes>
        </div>
      </main>

      {/* VOICE OVERLAY */}
      {activeSession && (
        <VoiceSession 
          token={activeSession.token}
          url={activeSession.url}
          agentName={activeSession.agentName}
          onDisconnect={() => setActiveSession(null)}
        />
      )}
    </div>
  );
};

export default App;
