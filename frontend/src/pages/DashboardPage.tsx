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

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 pb-6 border-b border-zinc-800 mb-10">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-100 leading-tight">
            Intelligence Overview
          </h1>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Real-time voice compute statistics & registry nodes</p>
          </div>
        </div>

        <button 
          onClick={() => navigate('/agents/create')}
          className="h-11 px-5 rounded-xl bg-primary text-on-primary text-sm font-medium hover:opacity-90 transition flex items-center gap-2 shadow-lg shadow-primary/10 self-start md:self-auto"
        >
          <Plus size={16} />
          Register Assistant
        </button>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard 
          label="Computed Minutes" 
          value={stats?.computedMinutes?.toLocaleString() || "0"} 
          trend="+12.5% vs cycle" 
          icon={<Clock size={16} />} 
        />
        <StatCard 
          label="Successful Calls" 
          value={stats?.successfulCalls?.toLocaleString() || "0"} 
          trend="+8.2% conversion" 
          icon={<Phone size={16} />} 
        />
        <StatCard 
          label="Call Latency" 
          value={stats?.callLatency || "0ms"} 
          trend="-14ms optimized" 
          icon={<Activity size={16} />} 
        />
        <StatCard 
          label="Token Burn" 
          value={stats?.tokenBurn || "$0.00"} 
          trend="+$2.40 efficiency" 
          icon={<BarChart3 size={16} />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {/* ACTIVE AGENTS */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Active Registry Nodes</h3>
            <button 
              onClick={() => navigate('/agents')} 
              className="text-xs font-medium text-zinc-500 hover:text-primary transition flex items-center gap-1 uppercase tracking-wider"
            >
              View all <ChevronRight size={14} />
            </button>
          </div>
          
          <div className="space-y-3">
            {isLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="h-22 rounded-2xl border border-zinc-800 bg-zinc-950/20 animate-pulse" />
              ))
            ) : agents.length > 0 ? (
              agents.slice(0, 4).map(agent => (
                <div 
                  key={agent.id} 
                  className="card-premium p-5 flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <AgentAvatar name={agent.agentName} agent={agent} className="w-12 h-12 text-xl shadow-sm border border-zinc-800" />
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-200 tracking-wide">{agent.agentName}</h4>
                      <p className="text-[10px] text-zinc-500 mt-1 uppercase font-medium tracking-wider">{agent.llm?.model ? agent.llm.model.substring(0, 16) : 'llama-3.3'} • {agent.language}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex flex-col items-end">
                      <div className="flex items-center gap-1.5">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                         <span className="text-[9px] text-emerald-400 font-semibold uppercase tracking-wider">Online</span>
                      </div>
                      <span className="text-[9px] text-zinc-500 font-mono mt-0.5 font-medium uppercase tracking-wider">ID: {agent.id.slice(0, 8)}</span>
                    </div>
                    <button 
                      onClick={() => handleQuickLaunch(agent)}
                      className="w-10 h-10 rounded-xl border border-zinc-800 bg-zinc-950/50 flex items-center justify-center text-zinc-400 hover:text-primary hover:border-primary/20 transition active:scale-95 shadow-sm"
                      title="Launch Session"
                    >
                      <Play size={12} fill="currentColor" strokeWidth={0} className="text-emerald-400" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-10 border border-dashed border-zinc-800 rounded-2xl text-center">
                <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">No active registry nodes configured.</p>
                <button 
                  onClick={() => navigate('/agents/create')}
                  className="mt-4 h-10 px-4 rounded-xl border border-zinc-800 bg-zinc-950/50 text-xs font-medium uppercase tracking-wider text-zinc-400 hover:text-primary hover:border-primary/20 transition active:scale-98 shadow-sm"
                >
                  Create New Assistant
                </button>
              </div>
            )}
          </div>
        </div>

        {/* DISPATCH SIGNALS PANEL */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Dispatch Signals</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">Live Link</span>
            </div>
          </div>
          
          <div className="card-premium p-5 flex flex-col justify-between min-h-[300px] font-mono text-[10px] leading-relaxed text-zinc-400">
            <div className="space-y-3.5">
              <div className="flex gap-2.5">
                <span className="text-zinc-500 font-medium">16:59:10</span>
                <span className="text-primary/60 font-semibold uppercase tracking-wider">[sys]</span>
                <span className="text-zinc-400">Secured AES-256 connection...</span>
              </div>
              <div className="flex gap-2.5">
                <span className="text-zinc-500 font-medium">16:59:12</span>
                <span className="text-primary/60 font-semibold uppercase tracking-wider">[gate]</span>
                <span className="text-zinc-400">Sarvam websocket validated.</span>
              </div>
              <div className="flex gap-2.5">
                <span className="text-zinc-500 font-medium">16:59:15</span>
                <span className="text-primary/60 font-semibold uppercase tracking-wider">[route]</span>
                <span className="text-zinc-400">OpenRouter fallback active.</span>
              </div>
              <div className="flex gap-2.5">
                <span className="text-zinc-500 font-medium">16:59:22</span>
                <span className="text-primary/60 font-semibold uppercase tracking-wider">[comp]</span>
                <span className="text-zinc-500">Burn speed: 0.0031 tok/s</span>
              </div>
              <div className="flex gap-2.5">
                <span className="text-zinc-500 font-medium">16:59:30</span>
                <span className="text-primary/60 font-semibold uppercase tracking-wider">[node]</span>
                <span className="text-emerald-400 font-semibold">Ramu connected successfully</span>
              </div>
            </div>
            
            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-[9px] text-zinc-500 font-medium uppercase tracking-wider mt-4">
              <span>Telemetry Sync</span>
              <span className="text-zinc-400 animate-pulse">100% Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* BANDWIDTH CHART */}
      <div className="card-premium p-6 flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200 tracking-wide uppercase">Call Bandwidth Cycle</h2>
            <p className="text-[10px] text-zinc-500 mt-1 font-medium uppercase tracking-wider">Aggregate agent compute bandwidth in 7-day windows</p>
          </div>
          <div className="text-[9px] font-semibold text-zinc-400 px-2.5 py-1 bg-zinc-900/50 border border-zinc-800 rounded-lg uppercase tracking-wider">7d window</div>
        </div>
        
        <div className="flex-1 flex items-end gap-5 h-36 px-2">
          {[40, 65, 30, 85, 45, 78, 55].map((h, i) => (
            <div key={i} className="flex-1 group/bar relative h-full flex items-end">
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.6, delay: i * 0.03 }}
                className="w-full bg-primary/10 rounded-xl group-hover/bar:bg-primary/25 transition-all duration-300 relative overflow-hidden border border-primary/10 shadow-sm"
              />
              <div className="invisible group-hover/bar:visible absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-950 border border-zinc-800 px-2 py-1 text-[9px] font-mono text-zinc-300 rounded-lg whitespace-nowrap shadow-md z-10 animate-in fade-in zoom-in duration-200">
                Day {i + 1}: <strong className="text-zinc-100 font-semibold ml-0.5">{h}m</strong>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 pt-4 border-t border-zinc-800 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">Daily Ingest Ratio</span>
            <span className="text-base font-semibold text-zinc-200 mt-1 leading-none">54.2m <span className="text-[9px] text-zinc-500 font-mono font-medium uppercase ml-0.5">tokens</span></span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">Total Compute Fleet</span>
            <span className="text-base font-semibold text-zinc-200 mt-1 leading-none">380m <span className="text-[9px] text-zinc-500 font-mono font-medium uppercase ml-0.5">tokens</span></span>
          </div>
        </div>
      </div>

    </div>
  );
};

const StatCard = ({ label, value, trend, icon }: any) => (
  <div className="card-premium p-6 flex flex-col justify-between min-h-[150px] cursor-pointer group">
    <div className="flex items-center justify-between">
      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center text-primary shadow-sm">
        {icon}
      </div>
      <span className="text-[9px] font-medium text-zinc-500 bg-zinc-900/40 border border-zinc-800 px-2 py-0.5 rounded-lg uppercase tracking-wider">
        {trend}
      </span>
    </div>
    <div className="space-y-1.5 mt-5">
      <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
      <h3 className="text-2xl font-semibold text-zinc-100 tracking-tight leading-none">{value}</h3>
    </div>
  </div>
);

export default DashboardPage;
