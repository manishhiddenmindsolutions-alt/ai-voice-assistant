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
      toast.success('Session live', { id: toastId });
    } catch (err) {
      console.error('Launch failed:', err);
      toast.error('Failed to start session', { id: toastId });
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-300">

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
            Intelligence Overview
          </h1>
          <p className="text-sm text-zinc-550 mt-2">
            Monitor real-time voice compute statistics, link metrics, and fleet status.
          </p>
        </div>

        <button 
          onClick={() => navigate('/agents/create')}
          className="h-11 px-5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition flex items-center gap-2 shadow-lg shadow-primary/10 self-start lg:self-auto"
        >
          <Plus size={16} />
          Register Assistant
        </button>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          label="Computed Minutes" 
          value={stats?.computedMinutes?.toLocaleString() || "0"} 
          trend="+12.5% vs cycle" 
          icon={<Clock size={16} />} 
        />
        <StatCard 
          label="Successful Linkages" 
          value={stats?.successfulLinkages?.toLocaleString() || "0"} 
          trend="+8.2% conversion" 
          icon={<Phone size={16} />} 
        />
        <StatCard 
          label="Neural Latency" 
          value={stats?.neuralLatency || "0ms"} 
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* ACTIVE AGENTS */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-400">Active Registry Nodes</h3>
            <button 
              onClick={() => navigate('/agents')} 
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-350 transition flex items-center gap-1"
            >
              View all <ChevronRight size={14} />
            </button>
          </div>
          
          <div className="space-y-4">
            {isLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="h-20 rounded-2xl border border-zinc-850 bg-zinc-900/20 animate-pulse" />
              ))
            ) : agents.length > 0 ? (
              agents.slice(0, 4).map(agent => (
                <div 
                  key={agent.id} 
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-primary/20 hover:bg-zinc-900/60 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(124,58,237,0.04)] transition-all duration-300 flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-zinc-850 flex items-center justify-center text-2xl border border-zinc-800">
                      {(agent.agentName || '').includes('Jiya') ? '👩‍💼' : (agent.agentName || '').includes('Ramu') ? '👨‍💼' : '🤖'}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-100">{agent.agentName}</h4>
                      <p className="text-xs text-zinc-500 mt-1 font-medium">{agent.llm?.model ? agent.llm.model.substring(0, 16) : 'llama-3.3'} • {agent.language}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex flex-col items-end">
                      <div className="flex items-center gap-1.5">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                         <span className="text-[10px] text-zinc-400 font-mono">Online</span>
                      </div>
                      <span className="text-[10px] text-zinc-550 font-mono mt-0.5">ID: {agent.id.slice(0, 8)}</span>
                    </div>
                    <button 
                      onClick={() => handleQuickLaunch(agent)}
                      className="w-10 h-10 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 transition"
                      title="Launch Session"
                    >
                      <Play size={12} fill="currentColor" strokeWidth={0} className="text-emerald-500" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-10 border border-dashed border-zinc-800 rounded-2xl text-center bg-zinc-900/10">
                <p className="text-zinc-500 text-sm font-medium">No active registry nodes configured.</p>
                <button 
                  onClick={() => navigate('/agents/create')}
                  className="mt-4 h-9 px-4 rounded-xl border border-zinc-850 bg-zinc-950 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-zinc-200 transition"
                >
                  Create New Assistant
                </button>
              </div>
            )}
          </div>
        </div>

        {/* NEURAL DISPATCH MONITOR */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-400">Dispatch Signals</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-zinc-500 font-mono uppercase">Live Link</span>
            </div>
          </div>
          
          <div className="rounded-2xl border border-zinc-850 bg-zinc-950/70 p-5 flex flex-col justify-between min-h-[300px] font-mono text-[11px] leading-relaxed text-zinc-400 hover:border-zinc-800 hover:shadow-[0_0_25px_rgba(124,58,237,0.03)] transition-all duration-300">
            <div className="space-y-3">
              <div className="flex gap-2">
                <span className="text-zinc-700">16:59:10</span>
                <span className="text-zinc-500 font-bold">[sys]</span>
                <span>Secured AES-256 connection...</span>
              </div>
              <div className="flex gap-2">
                <span className="text-zinc-700">16:59:12</span>
                <span className="text-zinc-500 font-bold">[gate]</span>
                <span>Sarvam websocket validated.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-zinc-700">16:59:15</span>
                <span className="text-zinc-500 font-bold">[route]</span>
                <span>OpenRouter fallback active.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-zinc-700">16:59:22</span>
                <span className="text-zinc-550 font-bold">[comp]</span>
                <span className="text-zinc-500">Burn speed: 0.0031 tok/s</span>
              </div>
              <div className="flex gap-2">
                <span className="text-zinc-700">16:59:30</span>
                <span className="text-zinc-550 font-bold">[node]</span>
                <span className="text-emerald-500">Ramu connected successfully</span>
              </div>
            </div>
            
            <div className="pt-4 border-t border-zinc-900 flex items-center justify-between text-[10px] text-zinc-550 font-bold uppercase tracking-wider">
              <span>Telemetry Sync</span>
              <span className="text-zinc-350">100% Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* MINIMAL BANDWIDTH CHART */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 flex flex-col relative overflow-hidden hover:border-primary/10 hover:shadow-[0_0_30px_rgba(124,58,237,0.04)] transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-sm font-semibold text-zinc-400">Neural Bandwidth Cycle</h2>
            <p className="text-xs text-zinc-550 mt-1 font-medium">Aggregate agent compute bandwidth in 7-day windows</p>
          </div>
          <div className="text-[10px] font-bold text-zinc-400 px-2.5 py-1 bg-zinc-950 border border-zinc-850 rounded-lg uppercase tracking-wider">7d window</div>
        </div>
        
        <div className="flex-1 flex items-end gap-4 h-36">
          {[40, 65, 30, 85, 45, 78, 55].map((h, i) => (
            <div key={i} className="flex-1 group/bar relative h-full flex items-end">
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.6, delay: i * 0.03 }}
                className="w-full bg-zinc-800 rounded-lg group-hover/bar:bg-zinc-200 transition-all duration-300 relative overflow-hidden border border-zinc-850 shadow-sm"
              />
              <div className="invisible group-hover/bar:visible absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-950 border border-zinc-800 px-2 py-1 text-[10px] font-mono text-zinc-200 rounded-lg whitespace-nowrap shadow-md z-10 animate-in fade-in zoom-in duration-200">
                Day {i + 1}: <strong className="text-zinc-50 font-semibold ml-0.5">{h}m</strong>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-4 border-t border-zinc-850/60 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider">Daily Ingest Ratio</span>
            <span className="text-base font-semibold text-zinc-250 mt-1">54.2m <span className="text-[10px] text-zinc-500 font-mono font-normal ml-0.5">tokens</span></span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-zinc-555 font-bold uppercase tracking-wider">Total Compute Fleet</span>
            <span className="text-base font-semibold text-zinc-250 mt-1">380m <span className="text-[10px] text-zinc-500 font-mono font-normal ml-0.5">tokens</span></span>
          </div>
        </div>
      </div>

    </div>
  );
};

const StatCard = ({ label, value, trend, icon }: any) => (
  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-primary/20 hover:bg-zinc-900/60 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(124,58,237,0.04)] transition-all duration-300 flex flex-col justify-between min-h-[140px] cursor-pointer group">
    <div className="flex items-center justify-between">
      <div className="w-10 h-10 rounded-xl bg-zinc-850 border border-zinc-800 flex items-center justify-center text-zinc-400">
        {icon}
      </div>
      <span className="text-[10px] font-bold text-zinc-400 bg-zinc-950 border border-zinc-850 px-2 py-0.5 rounded-lg uppercase tracking-wider">
        {trend}
      </span>
    </div>
    <div className="space-y-1 mt-4">
      <p className="text-xs font-semibold text-zinc-550 uppercase tracking-wider">{label}</p>
      <h3 className="text-2xl font-semibold text-zinc-100 tracking-tight">{value}</h3>
    </div>
  </div>
);

export default DashboardPage;
