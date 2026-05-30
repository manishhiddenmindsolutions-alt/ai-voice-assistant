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
  X,
  Phone,
  ChevronRight
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
        { id: 'dashboard', path: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { id: 'agents', path: '/agents', icon: Users, label: 'Agents' },
        { id: 'telephony', path: '/numbers', icon: Phone, label: 'Telephony' },
        { id: 'logs', path: '/logs', icon: History, label: 'Call Logs' },
        { id: 'analytics', path: '/analytics', icon: BarChart3, label: 'Analytics' },
      ]
    },
    {
      label: 'Configuration',
      items: [
        { id: 'providers', path: '/providers', icon: Key, label: 'Providers' },
        { id: 'webhooks', path: '/tools', icon: Package, label: 'Tools' },
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
          className="fixed inset-0 z-[90] lg:hidden animate-in fade-in duration-200"
          style={{ backgroundColor: 'var(--overlay-bg)' }}
          onClick={onClose}
        />
      )}

      <aside 
        className={`fixed inset-y-0 left-0 z-[100] w-64 flex flex-col border-r transition-transform duration-300 lg:sticky lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} h-screen`}
        style={{ 
          backgroundColor: 'var(--sidebar-bg)', 
          borderColor: 'var(--sidebar-border)' 
        }}
      >
        {/* LOGO SECTION */}
        <div className="flex items-center justify-between px-5 h-16 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <NavLink to="/" onClick={onClose} className="flex items-center gap-3 group cursor-pointer">
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
              <img 
                src={hmsLogo} 
                alt="HMS Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>HMS</span>
              <span className="text-[10px] font-medium leading-tight" style={{ color: 'var(--text-muted)' }}>Voice Agent Platform</span>
            </div>
          </NavLink>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-md lg:hidden transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* NAVIGATION */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="px-3 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {group.label}
                </span>
              </div>
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const isLinkActive = isActive(item.path);
                  return (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      onClick={onClose}
                      className="relative w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group"
                      style={{
                        backgroundColor: isLinkActive ? 'var(--sidebar-item-active-bg)' : 'transparent',
                        border: isLinkActive ? '1px solid var(--sidebar-item-active-border)' : '1px solid transparent',
                        color: isLinkActive ? 'var(--sidebar-item-active-text)' : 'var(--text-secondary)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isLinkActive) {
                          e.currentTarget.style.backgroundColor = 'var(--sidebar-item-hover)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isLinkActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }
                      }}
                    >
                      {/* Active indicator */}
                      {isLinkActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full" style={{ backgroundColor: 'var(--primary)' }} />
                      )}

                      <item.icon size={16} className="shrink-0" />
                      <span className="text-sm font-medium">{item.label}</span>
                      
                      {item.id === 'agents' && (
                        <span 
                          className="ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
                          style={{ 
                            backgroundColor: 'var(--badge-bg)', 
                            border: '1px solid var(--badge-border)',
                            color: 'var(--badge-text)' 
                          }}
                        >
                          {agents.length}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div className="shrink-0 px-3 pb-4 pt-3 flex flex-col gap-2 mt-auto" style={{ borderTop: '1px solid var(--border)' }}>
          {/* Create Agent */}
          <button 
            onClick={handleNewAgent}
            className="w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 group active:scale-[0.98]"
            style={{ 
              backgroundColor: location.pathname === '/agents/create' ? 'var(--sidebar-item-active-bg)' : 'var(--surface-secondary)',
              border: location.pathname === '/agents/create' ? '1px solid var(--sidebar-item-active-border)' : '1px solid var(--border)',
            }}
          >
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
              style={{ 
                backgroundColor: location.pathname === '/agents/create' ? 'var(--primary)' : 'rgba(59,130,246,0.1)', 
                color: location.pathname === '/agents/create' ? 'var(--on-primary)' : 'var(--primary)' 
              }}
            >
              <PlusCircle size={16} />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Create Agent</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>New voice assistant</p>
            </div>
          </button>

          {/* User Profile */}
          <div 
            onClick={() => { navigate('/profile'); onClose(); }}
            className="p-3 rounded-lg flex items-center gap-3 group cursor-pointer transition-all duration-200 active:scale-[0.98]"
            style={{ 
              backgroundColor: location.pathname === '/profile' ? 'var(--sidebar-item-active-bg)' : 'var(--surface-secondary)',
              border: location.pathname === '/profile' ? '1px solid var(--sidebar-item-active-border)' : '1px solid var(--border)',
            }}
          >
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden font-medium text-xs shrink-0"
              style={{ 
                backgroundColor: 'var(--surface)', 
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)' 
              }}
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="text-left overflow-hidden">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {user?.full_name || 'User'}
              </p>
              <span className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: 'var(--success)' }} />
                Online
              </span>
            </div>
            <ChevronRight size={14} className="ml-auto shrink-0" style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
