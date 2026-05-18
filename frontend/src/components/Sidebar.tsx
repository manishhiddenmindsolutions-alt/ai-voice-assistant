import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  History, 
  Settings, 
  Key, 
  BarChart3, 
  PlusCircle,
  Package,
  Share2,
  X
} from 'lucide-react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAgentStore } from '../store/useAgentStore';
import { useAuthStore } from '../store/useAuthStore';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setEditingAgent } = useAgentStore();
  const user = useAuthStore(state => state.user);

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : user?.email.substring(0, 2).toUpperCase();

  const handleNewAgent = () => {
    setEditingAgent(null);
    navigate('/agents/create');
    onClose();
  };

  const navGroups = [
    {
      label: 'Workspace',
      items: [
        { id: 'dashboard', path: '/', icon: LayoutDashboard, label: 'Overview' },
        { id: 'agents', path: '/agents', icon: Users, label: 'Agents' },
        { id: 'logs', path: '/logs', icon: History, label: 'Call Logs' },
        { id: 'analytics', path: '/analytics', icon: BarChart3, label: 'Analytics' },
      ]
    },
    {
      label: 'Config',
      items: [
        { id: 'keys', path: '/keys', icon: Key, label: 'API Keys' },
        { id: 'webhooks', path: '/tools', icon: Package, label: 'Webhooks' },
        { id: 'integrations', path: '/integrations', icon: Share2, label: 'Integrations' },
        { id: 'settings', path: '/settings', icon: Settings, label: 'Settings' },
      ]
    }
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* MOBILE OVERLAY */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] lg:hidden animate-in fade-in duration-300"
          onClick={onClose}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-[100] w-72 bg-zinc-950 flex flex-col p-8 border-r border-white/5 transition-transform duration-500 lg:sticky lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Background Glow */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20 bg-neural-mesh" />

        <div className="flex items-center justify-between mb-12 relative z-10">
          {/* LOGO */}
          <NavLink to="/" onClick={onClose} className="flex items-center gap-4 px-1 group cursor-pointer">
            <div className="w-11 h-11 bg-primary rounded-2xl flex items-center justify-center font-bold text-xl shadow-2xl shadow-primary/40 group-hover:scale-110 transition-transform duration-500">
              🎙
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-heading font-black leading-none tracking-tight text-white uppercase tracking-[0.15em]">VoiceForge</span>
              <span className="text-[10px] text-zinc-600 font-black tracking-[0.3em] uppercase mt-1.5 opacity-80">Foundry V5</span>
            </div>
          </NavLink>

          <button 
            onClick={onClose}
            className="p-2 text-zinc-600 hover:text-white lg:hidden transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {navGroups.map((group) => (
          <div key={group.label} className="mb-12 relative z-10">
            <div className="px-4 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700 mb-6 flex items-center gap-3">
               <div className="h-[1px] w-4 bg-zinc-800" />
               {group.label}
            </div>
            <nav className="space-y-2">
              {group.items.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  onClick={onClose}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group ${
                    isActive(item.path)
                      ? 'bg-primary/10 text-primary border border-primary/20 shadow-lg shadow-primary/5' 
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <item.icon size={18} className={`${isActive(item.path) ? 'text-primary' : 'text-zinc-700 group-hover:text-zinc-400'} transition-colors`} />
                  <span className="font-bold text-[13px] tracking-wide uppercase">{item.label}</span>
                  {item.id === 'agents' && (
                     <span className="ml-auto text-[10px] font-black bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg text-zinc-600">3</span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}

        {/* FOOTER ACTION */}
        <div className="mt-auto pt-8 border-t border-white/5 flex flex-col gap-6 relative z-10">
          <button 
            onClick={handleNewAgent}
            className="w-full flex items-center gap-4 p-4 bg-zinc-900/50 hover:bg-zinc-800 border border-white/5 rounded-[1.5rem] transition-all duration-300 group"
          >
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner">
              <PlusCircle size={20} />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-black text-white uppercase tracking-[0.2em]">Deploy Node</p>
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5">Initialize Assistant</p>
            </div>
          </button>

          <div 
            onClick={() => {
              navigate('/profile');
              onClose();
            }}
            className="p-4 bg-zinc-950/50 border border-white/5 hover:border-primary/40 rounded-[1.5rem] flex items-center gap-4 group cursor-pointer transition-all hover:bg-zinc-900/40"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center overflow-hidden font-black text-xs text-zinc-500 group-hover:text-primary group-hover:border-primary/20 transition-all">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="text-left overflow-hidden">
              <p className="text-[11px] font-black text-white uppercase tracking-[0.2em] truncate group-hover:text-primary transition-colors">
                {user?.full_name || 'Operator'}
              </p>
              <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Pro Foundry
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
