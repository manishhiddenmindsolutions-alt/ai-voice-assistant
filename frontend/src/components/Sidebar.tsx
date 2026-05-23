import React from 'react';
import hmsLogo from '../assets/HMS logo.png';
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
  const { agents, setEditingAgent } = useAgentStore();
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
        { 
          id: 'dashboard', 
          path: '/', 
          icon: LayoutDashboard, 
          label: 'Overview',
          activeClass: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm shadow-cyan-500/5', 
          hoverClass: 'text-zinc-400 hover:text-cyan-300 hover:bg-cyan-500/5 hover:border-cyan-500/10 border border-transparent',
          iconColor: 'text-cyan-400',
          iconHoverColor: 'group-hover:text-cyan-400'
        },
        { 
          id: 'agents', 
          path: '/agents', 
          icon: Users, 
          label: 'Agents',
          activeClass: 'bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-sm shadow-violet-500/5', 
          hoverClass: 'text-zinc-400 hover:text-violet-300 hover:bg-violet-500/5 hover:border-violet-500/10 border border-transparent',
          iconColor: 'text-violet-400',
          iconHoverColor: 'group-hover:text-violet-400'
        },
        { 
          id: 'logs', 
          path: '/logs', 
          icon: History, 
          label: 'Call Logs',
          activeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/5', 
          hoverClass: 'text-zinc-400 hover:text-emerald-300 hover:bg-emerald-500/5 hover:border-emerald-500/10 border border-transparent',
          iconColor: 'text-emerald-400',
          iconHoverColor: 'group-hover:text-emerald-400'
        },
        { 
          id: 'analytics', 
          path: '/analytics', 
          icon: BarChart3, 
          label: 'Analytics',
          activeClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm shadow-amber-500/5', 
          hoverClass: 'text-zinc-400 hover:text-amber-300 hover:bg-amber-500/5 hover:border-amber-500/10 border border-transparent',
          iconColor: 'text-amber-400',
          iconHoverColor: 'group-hover:text-amber-400'
        },
      ]
    },
    {
      label: 'Config',
      items: [
        { 
          id: 'providers', 
          path: '/providers', 
          icon: Key, 
          label: 'Providers',
          activeClass: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 shadow-sm shadow-yellow-500/5', 
          hoverClass: 'text-zinc-400 hover:text-yellow-300 hover:bg-yellow-500/5 hover:border-yellow-500/10 border border-transparent',
          iconColor: 'text-yellow-400',
          iconHoverColor: 'group-hover:text-yellow-400'
        },
        { 
          id: 'webhooks', 
          path: '/tools', 
          icon: Package, 
          label: 'Webhooks',
          activeClass: 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm shadow-blue-500/5', 
          hoverClass: 'text-zinc-400 hover:text-blue-300 hover:bg-blue-500/5 hover:border-blue-500/10 border border-transparent',
          iconColor: 'text-blue-400',
          iconHoverColor: 'group-hover:text-blue-400'
        },
        { 
          id: 'integrations', 
          path: '/integrations', 
          icon: Share2, 
          label: 'Integrations',
          activeClass: 'bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-sm shadow-rose-500/5', 
          hoverClass: 'text-zinc-400 hover:text-rose-300 hover:bg-rose-500/5 hover:border-rose-500/10 border border-transparent',
          iconColor: 'text-rose-400',
          iconHoverColor: 'group-hover:text-rose-400'
        },
        { 
          id: 'settings', 
          path: '/settings', 
          icon: Settings, 
          label: 'Settings',
          activeClass: 'bg-zinc-800/30 text-zinc-100 border border-zinc-700/50 shadow-xs', 
          hoverClass: 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/20 hover:border-zinc-700/20 border border-transparent',
          iconColor: 'text-zinc-400',
          iconHoverColor: 'group-hover:text-zinc-300'
        },
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] lg:hidden animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-[100] w-72 bg-zinc-950 flex flex-col p-6 border-r border-zinc-800 transition-transform duration-300 lg:sticky lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} h-screen`}>
        {/* Background Glow */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20 bg-neural-mesh" />

        {/* LOGO SECTION - FIXED AT THE TOP */}
        <div className="flex items-center justify-between mb-8 shrink-0 relative z-10">
          <NavLink to="/" onClick={onClose} className="flex items-center gap-4 px-1 group cursor-pointer">
            <div className="w-11 h-11 rounded-none flex items-center justify-center overflow-hidden group-hover:scale-[1.02] transition-transform duration-250 shrink-0">
              <img 
                src={hmsLogo} 
                alt="HMS Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-heading font-black leading-none tracking-[0.12em] text-zinc-100 uppercase mt-0.5">HMS</span>
              <span className="text-[9px] text-zinc-500 font-extrabold tracking-widest uppercase mt-2 opacity-80">HiddenMindSolutions</span>
            </div>
          </NavLink>

          <button 
            onClick={onClose}
            className="p-2 text-zinc-600 hover:text-zinc-100 lg:hidden transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* SCROLLABLE NAVIGATION LIST */}
        <div className="flex-1 overflow-y-auto pr-1 py-2 space-y-6 custom-scrollbar relative z-10">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-3">
              <div className="px-4 text-xs font-extrabold uppercase tracking-wider text-zinc-500 flex items-center gap-3">
                 <div className="h-[1px] w-4 bg-zinc-800" />
                 {group.label}
               </div>
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const isLinkActive = isActive(item.path);
                  return (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      onClick={onClose}
                      className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-300 group ${
                        isLinkActive 
                          ? 'bg-primary/10 text-primary border border-primary/25 shadow-lg shadow-primary/5 pl-6' 
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 hover:pl-5 hover:border-zinc-800 hover:shadow-[0_0_15px_rgba(124,58,237,0.03)] border border-transparent'
                      }`}
                    >
                      {/* Active Left Indicator Line */}
                      {isLinkActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary animate-in slide-in-from-left duration-300" />
                      )}

                      <item.icon 
                        size={16} 
                        className={`${
                          isLinkActive ? 'text-primary' : `text-zinc-500 ${item.iconHoverColor}`
                        } transition-all duration-300 shrink-0 group-hover:scale-110`} 
                      />
                      <span className="font-semibold text-xs tracking-wider uppercase transition-colors duration-300">{item.label}</span>
                      {item.id === 'agents' && (
                         <span className="ml-auto text-[10px] font-extrabold bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-lg text-zinc-400 transition-colors duration-300">{agents.length}</span>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* FOOTER ACTIONS - LOCKED AT THE BOTTOM */}
        <div className="shrink-0 pt-6 border-t border-zinc-800/80 flex flex-col gap-3 relative z-10 mt-auto">
          <button 
            onClick={handleNewAgent}
            className={`w-full flex items-center gap-3.5 p-3.5 border rounded-2xl transition-all duration-200 group active:scale-98 hover:shadow-[0_0_20px_rgba(124,58,237,0.04)] ${
              location.pathname === '/agents/create'
                ? 'bg-primary/10 text-primary border-primary/20 shadow-md shadow-primary/5'
                : 'bg-zinc-900/30 hover:bg-zinc-900 hover:border-zinc-700 border-zinc-800/60'
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
              location.pathname === '/agents/create'
                ? 'bg-primary text-zinc-950 font-bold'
                : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white'
            }`}>
              <PlusCircle size={18} />
            </div>
            <div className="text-left truncate">
              <p className="text-xs font-semibold text-zinc-300 transition-colors">Create Agent</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Initialize agent fleet</p>
            </div>
          </button>

          <div 
            onClick={() => {
              navigate('/profile');
              onClose();
            }}
            className={`p-3.5 border rounded-2xl flex items-center gap-3.5 group cursor-pointer transition-all duration-200 active:scale-98 hover:shadow-[0_0_20px_rgba(124,58,237,0.04)] ${
              location.pathname === '/profile'
                ? 'bg-primary/10 text-primary border-primary/20 shadow-md shadow-primary/5'
                : 'bg-zinc-900/30 hover:bg-zinc-900 hover:border-zinc-700 border-zinc-800/60'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden font-semibold text-xs text-zinc-400 group-hover:text-primary transition-all shrink-0">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="text-left overflow-hidden truncate">
              <p className="text-xs font-semibold text-zinc-300 transition-colors truncate">
                {user?.full_name || 'Operator'}
              </p>
              <span className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-1.5 leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                Operator Active
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
