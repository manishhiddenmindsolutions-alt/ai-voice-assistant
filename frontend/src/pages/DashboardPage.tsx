import { useState, useEffect } from 'react';
import { useAgentStore } from '../store/useAgentStore';
import { 
  Plus, 
  Play, 
  Clock, 
  BarChart3, 
  Activity,
  Phone,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { agentApi, sessionApi, dashboardApi } from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AgentAvatar } from '../components/AgentAvatar';

interface DashboardStats {
  computedMinutes: number;
  successfulCalls: number;
  callLatency: string;
  tokenBurn: string;
}

const DashboardPage = () => {
  const { agents, setActiveSession } = useAgentStore();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const [agentsRes, statsRes] = await Promise.all([
          agentApi.list(),
          dashboardApi.stats()
        ]);
        useAgentStore.getState().setAgents(agentsRes.data);
        setStats(statsRes.data);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleQuickLaunch = async (agent: any) => {
    const toastId = toast.loading(`Starting ${agent.agentName}...`);
    try {
      const payload = {
        agent_id: agent.id,
        prompt: agent.prompt,
        language: agent.language,
        stt: agent.stt,
        llm: agent.llm,
        tts: agent.tts,
        vad: agent.vad || { provider: 'silero' },
        tools: agent.tools,
      };
      const res = await sessionApi.start(payload);
      setActiveSession({ ...res.data, agentName: agent.agentName });
      toast.success('Session live', { id: toastId });
    } catch (err) {
      console.error('Launch failed:', err);
      toast.error('Failed to start session', { id: toastId });
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-500 font-sans">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Overview of your voice agents and performance metrics.
          </p>
        </div>

        <button 
          onClick={() => navigate('/agents/create')}
          className="btn-primary self-start md:self-auto shadow-sm"
        >
          <Plus size={16} />
          Create Agent
        </button>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          label="Total Minutes" 
          value={stats?.computedMinutes?.toLocaleString() || "0"} 
          change="+12.5%"
          icon={<Clock size={18} />} 
          color="var(--primary)"
        />
        <StatCard 
          label="Successful Calls" 
          value={stats?.successfulCalls?.toLocaleString() || "0"} 
          change="+8.2%"
          icon={<Phone size={18} />} 
          color="var(--success)"
        />
        <StatCard 
          label="Avg Latency" 
          value={stats?.callLatency || "0ms"} 
          change="-14ms"
          icon={<Activity size={18} />} 
          color="#8B5CF6"
        />
        <StatCard 
          label="Token Cost" 
          value={stats?.tokenBurn || "$0.00"} 
          change="+$2.40"
          icon={<BarChart3 size={18} />} 
          color="#F59E0B"
        />
      </div>

      {/* MAIN CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* ACTIVE AGENTS */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Active Agents</h3>
            <button 
              onClick={() => navigate('/agents')} 
              className="text-xs font-medium flex items-center gap-1 transition-colors"
              style={{ color: 'var(--primary)' }}
            >
              View all <ChevronRight size={14} />
            </button>
          </div>
          
          <div className="space-y-3">
            {isLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="h-20 rounded-lg skeleton" />
              ))
            ) : agents.length > 0 ? (
              agents.slice(0, 4).map(agent => (
                <div 
                  key={agent.id} 
                  className="card p-4 flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <AgentAvatar name={agent.agentName} agent={agent} className="w-10 h-10 text-lg" />
                    <div>
                      <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{agent.agentName}</h4>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {agent.llm?.model ? agent.llm.model.substring(0, 20) : 'Default model'} · {agent.language}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex flex-col items-end">
                      <div className="flex items-center gap-1.5">
                         <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--success)' }} />
                         <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>Active</span>
                      </div>
                      <span className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>ID: {agent.id.slice(0, 8)}</span>
                    </div>
                    <button 
                      onClick={() => handleQuickLaunch(agent)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center transition active:scale-95"
                      style={{ 
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--success)' 
                      }}
                      title="Launch Session"
                    >
                      <Play size={12} fill="currentColor" strokeWidth={0} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div 
                className="p-10 rounded-lg text-center"
                style={{ border: '2px dashed var(--border)' }}
              >
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No agents configured yet.</p>
                <button 
                  onClick={() => navigate('/agents/create')}
                  className="mt-4 btn-outline text-sm"
                >
                  Create Your First Agent
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ACTIVITY LOG */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Activity</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--success)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Live</span>
            </div>
          </div>
          
          <div className="card p-4 flex flex-col justify-between min-h-[300px] font-mono text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <div className="space-y-3">
              <div className="flex gap-2.5">
                <span style={{ color: 'var(--text-muted)' }}>16:59:10</span>
                <span className="font-semibold" style={{ color: 'var(--primary)' }}>[sys]</span>
                <span>Secured AES-256 connection...</span>
              </div>
              <div className="flex gap-2.5">
                <span style={{ color: 'var(--text-muted)' }}>16:59:12</span>
                <span className="font-semibold" style={{ color: 'var(--primary)' }}>[gate]</span>
                <span>Sarvam websocket validated.</span>
              </div>
              <div className="flex gap-2.5">
                <span style={{ color: 'var(--text-muted)' }}>16:59:15</span>
                <span className="font-semibold" style={{ color: 'var(--primary)' }}>[route]</span>
                <span>OpenRouter fallback active.</span>
              </div>
              <div className="flex gap-2.5">
                <span style={{ color: 'var(--text-muted)' }}>16:59:22</span>
                <span className="font-semibold" style={{ color: 'var(--primary)' }}>[compute]</span>
                <span style={{ color: 'var(--text-muted)' }}>Token rate: 0.0031 tok/s</span>
              </div>
              <div className="flex gap-2.5">
                <span style={{ color: 'var(--text-muted)' }}>16:59:30</span>
                <span className="font-semibold" style={{ color: 'var(--primary)' }}>[agent]</span>
                <span className="font-semibold" style={{ color: 'var(--success)' }}>Connected successfully</span>
              </div>
            </div>
            
            <div className="pt-3 flex items-center justify-between text-[11px] mt-4" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <span>System Status</span>
              <span className="animate-pulse font-medium" style={{ color: 'var(--success)' }}>All Systems Operational</span>
            </div>
          </div>
        </div>
      </div>

      {/* CALL VOLUME CHART */}
      <div className="card p-6 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Call Volume</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Weekly agent call bandwidth</p>
          </div>
          <span className="badge text-[11px]">7 day window</span>
        </div>
        
        <div className="flex-1 flex items-end gap-3 h-36 px-2">
          {[40, 65, 30, 85, 45, 78, 55].map((h, i) => (
            <div key={i} className="flex-1 group/bar relative h-full flex items-end">
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.6, delay: i * 0.03 }}
                className="w-full rounded-md transition-all duration-300 group-hover/bar:opacity-90"
                style={{ 
                  backgroundColor: 'var(--primary)',
                  opacity: 0.15 + (h / 200),
                  border: '1px solid rgba(59,130,246,0.1)' 
                }}
              />
              <div 
                className="invisible group-hover/bar:visible absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-[11px] font-mono rounded-md whitespace-nowrap shadow-md z-10 animate-in fade-in zoom-in duration-200"
                style={{ 
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)' 
                }}
              >
                Day {i + 1}: <strong>{h}m</strong>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex flex-col">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Daily Average</span>
            <span className="text-base font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
              54.2m <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>tokens</span>
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Usage</span>
            <span className="text-base font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
              380m <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>tokens</span>
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};

const StatCard = ({ label, value, change, icon, color }: any) => (
  <div className="card p-5 flex flex-col justify-between min-h-[140px] cursor-pointer group">
    <div className="flex items-center justify-between">
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ 
          backgroundColor: `${color}12`,
          color: color 
        }}
      >
        {icon}
      </div>
      <div className="flex items-center gap-1">
        <TrendingUp size={12} style={{ color: 'var(--success)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>
          {change}
        </span>
      </div>
    </div>
    <div className="mt-4">
      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <h3 className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{value}</h3>
    </div>
  </div>
);

export default DashboardPage;
