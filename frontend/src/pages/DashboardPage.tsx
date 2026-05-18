import { useState, useEffect } from 'react';
import { useAgentStore } from '../store/useAgentStore';
import { 
  Plus, 
  Play, 
  Clock, 
  BarChart3, 
  Activity,
  Phone,
  ChevronRight
} from 'lucide-react';
import { agentApi, sessionApi, dashboardApi } from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface DashboardStats {
  computedMinutes: number;
  successfulLinkages: number;
  neuralLatency: string;
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
      toast.success('Session Live', { id: toastId });
    } catch (err) {
      console.error('Launch failed:', err);
      toast.error('Failed to start session', { id: toastId });
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-500 font-sans">
      
      {/* HEADER AREA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-border pb-6">
        <div className="space-y-1">
          <h1 className="text-xl md:text-3xl font-heading font-black text-white tracking-tight leading-tight">Intelligence Overview</h1>
          <p className="text-muted text-xs font-medium uppercase tracking-widest">Autonomous Fleet Analytics • Forge Intelligence</p>
        </div>
        <button 
          onClick={() => navigate('/agents/create')}
          className="btn-vapi w-full md:w-auto shadow-[0_0_15px_rgba(0,112,243,0.3)]"
        >
          <Plus size={16} strokeWidth={2.5} />
          Initialize Node
        </button>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          label="Computed Minutes" 
          value={stats?.computedMinutes?.toLocaleString() || "..."} 
          trend="+12.5%" 
          icon={<Clock size={16} />} 
          trendUp={true} 
          glowClass="glow-card-primary"
        />
        <StatCard 
          label="Successful Linkages" 
          value={stats?.successfulLinkages?.toLocaleString() || "..."} 
          trend="+8.2%" 
          icon={<Phone size={16} />} 
          trendUp={true} 
          glowClass="glow-card-emerald"
        />
        <StatCard 
          label="Neural Latency" 
          value={stats?.neuralLatency || "..."} 
          trend="-14ms" 
          icon={<Activity size={16} />} 
          trendUp={false} 
          glowClass="glow-card-purple"
        />
        <StatCard 
          label="Token Burn" 
          value={stats?.tokenBurn || "..."} 
          trend="+$2.40" 
          icon={<BarChart3 size={16} />} 
          trendUp={true} 
          glowClass="glow-card-amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* RECENT ASSISTANTS */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-bold text-white uppercase tracking-widest">Recent Nodes</h2>
            <button onClick={() => navigate('/agents')} className="text-primary text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all">
              Registry <ChevronRight size={12} />
            </button>
          </div>
          
          <div className="space-y-3">
            {isLoading ? (
              [1, 2, 3].map(i => <div key={i} className="h-20 bg-surface-container rounded-lg animate-pulse" />)
            ) : agents.length > 0 ? (
              agents.slice(0, 4).map(agent => (
                <div key={agent.id} className="group p-4 bg-surface-container/50 border border-border rounded-2xl hover:bg-surface-container transition-all duration-300 flex items-center justify-between backdrop-blur-sm shadow-sm glow-card-primary">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-md bg-surface border border-border flex items-center justify-center text-xl shadow-inner group-hover:scale-105 transition-transform duration-500">
                      {(agent.agentName || '').includes('Property') ? '🏘️' : '🤖'}
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-white tracking-wide group-hover:text-primary transition-colors leading-tight">{agent.agentName}</h4>
                      <p className="text-[10px] text-muted font-mono uppercase tracking-wider leading-none">{agent.llm?.model || 'llama-3.1'} • {agent.language}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end mr-4">
                      <div className="flex items-center gap-1.5 mb-1">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                         <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Active</span>
                      </div>
                      <span className="text-[9px] text-muted font-mono uppercase tracking-widest opacity-70">ID: {agent.id.slice(0, 8)}</span>
                    </div>
                    <button 
                      onClick={() => handleQuickLaunch(agent)}
                      className="w-9 h-9 rounded-md bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95 flex items-center justify-center"
                    >
                      <Play size={14} fill="currentColor" strokeWidth={0} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 border border-dashed border-border rounded-lg text-center bg-surface-container-low/50 backdrop-blur-sm">
                <p className="text-muted text-[11px] font-bold uppercase tracking-widest">No Active Nodes In Region</p>
                <button 
                  onClick={() => navigate('/agents/create')}
                  className="mt-4 text-primary text-[10px] font-bold uppercase tracking-widest hover:underline"
                >
                  Register New assistant
                </button>
              </div>
            )}
          </div>
        </div>

        {/* USAGE CHART */}
        <div className="bg-surface-container/30 border border-border rounded-2xl p-6 flex flex-col shadow-sm glow-card-primary">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-[10px] font-bold text-white uppercase tracking-widest">Neural Bandwidth</h2>
            <div className="text-[9px] font-bold text-primary px-2 py-1 bg-primary/10 border border-primary/20 rounded-md tracking-wider">7D CYCLE</div>
          </div>
          
          <div className="flex-1 flex items-end gap-2 h-40">
            {[40, 65, 30, 85, 45, 78, 55].map((h, i) => (
              <div key={i} className="flex-1 group/bar relative h-full flex items-end">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.8, delay: i * 0.05 }}
                  className="w-full bg-primary/20 rounded-t-sm group-hover/bar:bg-primary transition-all duration-300 relative overflow-hidden border-t border-primary/40 shadow-[0_0_10px_rgba(0,112,243,0)] group-hover/bar:shadow-[0_0_15px_rgba(0,112,243,0.3)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                </motion.div>
                <div className="invisible group-hover/bar:visible absolute -top-8 left-1/2 -translate-x-1/2 bg-surface px-2 py-1 border border-border text-[10px] font-mono text-white rounded shadow-xl z-20 whitespace-nowrap">
                  {h}m
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-muted uppercase tracking-widest leading-none">Daily Ingest</span>
              <span className="text-xl font-heading font-black text-white tracking-tight">54.2m</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[9px] font-bold text-muted uppercase tracking-widest leading-none">Total Compute</span>
              <span className="text-xl font-heading font-black text-primary tracking-tight">380m</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

const StatCard = ({ label, value, trend, icon, trendUp, glowClass = 'glow-card-primary' }: any) => (
  <div className={`card-vapi !p-5 space-y-4 transition-all duration-300 group hover:scale-[1.02] cursor-pointer ${glowClass}`}>
    <div className="flex items-center justify-between">
      <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-muted group-hover:text-primary transition-colors">
        {icon}
      </div>
      <span className={`text-[11px] font-mono font-medium ${trendUp ? 'text-emerald-500' : 'text-primary'}`}>
        {trend}
      </span>
    </div>
    <div>
      <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 leading-none">{label}</p>
      <h3 className="text-2xl font-heading font-black text-white tracking-tight">{value}</h3>
    </div>
  </div>
);

export default DashboardPage;
