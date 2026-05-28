import { useState, useEffect } from 'react';
import {
  BarChart3,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  TrendingUp,
  Activity,
  Users,
  CheckCircle2,
  Loader2,
  Phone,
  Zap,
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import { BackButton } from '../components/BackButton';
import { motion } from 'framer-motion';

interface AnalyticsData {
  total_calls: number;
  total_minutes: number;
  avg_duration_seconds: number;
  success_rate: number;
  inbound_count: number;
  outbound_count: number;
  daily_volume: { date: string; count: number; inbound: number; outbound: number }[];
  agent_stats: { agent_id: string; agent_name: string; call_count: number; total_minutes: number }[];
  status_breakdown: Record<string, number>;
}

const AnalyticsPage = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const resp = await dashboardApi.analytics(timeRange);
        setData(resp.data);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [timeRange]);

  const maxVolume = data ? Math.max(...data.daily_volume.map(d => d.count), 1) : 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-zinc-500" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4 md:gap-5">
          <BackButton fallbackPath="/" label="Overview" />
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-bold uppercase tracking-wider text-zinc-100 leading-none mb-0">
              Analytics
            </h1>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)] animate-pulse" />
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider leading-none">
                Performance Intelligence
              </p>
            </div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex bg-zinc-950/80 p-1 rounded-2xl border border-zinc-850 self-start sm:self-auto shadow-inner">
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setTimeRange(d)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                timeRange === d
                  ? 'bg-zinc-900 text-amber-400 border border-zinc-800 shadow-md'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard
          label="Total Calls"
          value={data?.total_calls?.toLocaleString() || '0'}
          icon={<Phone size={16} />}
          iconBg="bg-violet-500/10 text-violet-400 border-violet-500/20"
          trend={`${timeRange}d window`}
        />
        <StatCard
          label="Total Minutes"
          value={`${data?.total_minutes?.toLocaleString() || '0'}m`}
          icon={<Clock size={16} />}
          iconBg="bg-blue-500/10 text-blue-400 border-blue-500/20"
          trend="Computed time"
        />
        <StatCard
          label="Avg Duration"
          value={`${Math.round(data?.avg_duration_seconds || 0)}s`}
          icon={<Activity size={16} />}
          iconBg="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          trend="Per call"
        />
        <StatCard
          label="Success Rate"
          value={`${data?.success_rate || 0}%`}
          icon={<CheckCircle2 size={16} />}
          iconBg="bg-amber-500/10 text-amber-400 border-amber-500/20"
          trend="Connected calls"
        />
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* CALL VOLUME CHART */}
        <div className="lg:col-span-2 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-zinc-700 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 size={15} className="text-amber-400" />
                Call Volume
              </h2>
              <p className="text-[10px] text-zinc-500 mt-1 font-semibold uppercase tracking-wider">
                Daily call distribution — last {timeRange} days
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm bg-blue-500/60" />
                <span className="text-[9px] text-zinc-500 font-bold uppercase">Inbound</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm bg-orange-500/60" />
                <span className="text-[9px] text-zinc-500 font-bold uppercase">Outbound</span>
              </div>
            </div>
          </div>

          <div className="flex items-end gap-1.5 h-48">
            {(data?.daily_volume || []).map((day, i) => {
              const height = maxVolume > 0 ? (day.count / maxVolume) * 100 : 0;
              const inboundPct = day.count > 0 ? (day.inbound / day.count) * 100 : 0;
              return (
                <div key={i} className="flex-1 group/bar relative h-full flex items-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(height, 2)}%` }}
                    transition={{ duration: 0.5, delay: i * 0.02 }}
                    className="w-full rounded-lg overflow-hidden relative border border-zinc-800/50 group-hover/bar:border-zinc-600 transition-all"
                  >
                    {/* Stacked bars: inbound (blue) on bottom, outbound (orange) on top */}
                    <div className="absolute bottom-0 left-0 right-0 bg-blue-500/40" style={{ height: `${inboundPct}%` }} />
                    <div className="absolute top-0 left-0 right-0 bg-orange-500/40" style={{ height: `${100 - inboundPct}%` }} />
                  </motion.div>
                  {/* Tooltip */}
                  <div className="invisible group-hover/bar:visible absolute -top-12 left-1/2 -translate-x-1/2 bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 text-[9px] font-mono text-zinc-200 rounded-lg whitespace-nowrap shadow-xl z-10 animate-in fade-in zoom-in duration-200">
                    <strong className="text-zinc-100">{day.count}</strong> calls
                    <div className="text-zinc-500">{new Date(day.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* DIRECTION BREAKDOWN */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-zinc-700 transition-all duration-300 flex flex-col">
          <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-6 flex items-center gap-2">
            <TrendingUp size={15} className="text-emerald-400" />
            Direction Breakdown
          </h2>

          <div className="flex-1 flex flex-col justify-center space-y-6">
            {/* Visual Ring */}
            <div className="relative w-40 h-40 mx-auto">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgb(39, 39, 42)" strokeWidth="8" />
                {data && data.total_calls > 0 && (
                  <>
                    <motion.circle
                      cx="50" cy="50" r="40" fill="none"
                      stroke="rgb(96, 165, 250)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(data.inbound_count / data.total_calls) * 251.3} 251.3`}
                      initial={{ strokeDasharray: '0 251.3' }}
                      animate={{ strokeDasharray: `${(data.inbound_count / data.total_calls) * 251.3} 251.3` }}
                      transition={{ duration: 1 }}
                    />
                    <motion.circle
                      cx="50" cy="50" r="40" fill="none"
                      stroke="rgb(251, 146, 60)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${(data.outbound_count / data.total_calls) * 251.3} 251.3`}
                      strokeDashoffset={`${-(data.inbound_count / data.total_calls) * 251.3}`}
                      initial={{ strokeDasharray: '0 251.3' }}
                      animate={{ strokeDasharray: `${(data.outbound_count / data.total_calls) * 251.3} 251.3` }}
                      transition={{ duration: 1, delay: 0.3 }}
                    />
                  </>
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-zinc-100">{data?.total_calls || 0}</span>
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Total</span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-zinc-950/40 border border-zinc-900 rounded-xl">
                <div className="flex items-center gap-2">
                  <PhoneIncoming size={13} className="text-blue-400" />
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Inbound</span>
                </div>
                <span className="text-sm font-bold text-zinc-100 font-mono">{data?.inbound_count || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-950/40 border border-zinc-900 rounded-xl">
                <div className="flex items-center gap-2">
                  <PhoneOutgoing size={13} className="text-orange-400" />
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Outbound</span>
                </div>
                <span className="text-sm font-bold text-zinc-100 font-mono">{data?.outbound_count || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AGENT PERFORMANCE + STATUS BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AGENT PERFORMANCE */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-zinc-700 transition-all duration-300">
          <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-5 flex items-center gap-2">
            <Users size={15} className="text-violet-400" />
            Agent Performance
          </h2>

          {(data?.agent_stats || []).length === 0 ? (
            <div className="py-10 text-center text-xs font-semibold text-zinc-600 uppercase tracking-wider border border-dashed border-zinc-800 rounded-2xl">
              No agent data yet
            </div>
          ) : (
            <div className="space-y-3">
              {(data?.agent_stats || []).map((agent, i) => {
                const maxCalls = Math.max(...(data?.agent_stats || []).map(a => a.call_count), 1);
                const barWidth = (agent.call_count / maxCalls) * 100;
                return (
                  <div key={i} className="p-4 bg-zinc-950/30 border border-zinc-900 rounded-xl hover:border-zinc-800 transition-all duration-300">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-zinc-200">{agent.agent_name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-zinc-500 font-mono font-bold">{agent.call_count} calls</span>
                        <span className="text-[10px] text-zinc-600 font-mono">{agent.total_minutes}m</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* STATUS BREAKDOWN */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-zinc-700 transition-all duration-300">
          <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-5 flex items-center gap-2">
            <Zap size={15} className="text-amber-400" />
            Status Distribution
          </h2>

          {Object.keys(data?.status_breakdown || {}).length === 0 ? (
            <div className="py-10 text-center text-xs font-semibold text-zinc-600 uppercase tracking-wider border border-dashed border-zinc-800 rounded-2xl">
              No status data yet
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(data?.status_breakdown || {}).map(([status, count], i) => {
                const totalForStatus = Object.values(data?.status_breakdown || {}).reduce((a, b) => a + b, 0);
                const pct = totalForStatus > 0 ? Math.round((count / totalForStatus) * 100) : 0;
                
                const colorMap: Record<string, string> = {
                  completed: 'from-emerald-500 to-emerald-600',
                  active: 'from-blue-500 to-blue-600',
                  initiated: 'from-amber-500 to-amber-600',
                  connecting: 'from-yellow-500 to-yellow-600',
                  failed: 'from-red-500 to-red-600',
                  ended: 'from-zinc-500 to-zinc-600',
                };
                
                const dotColor: Record<string, string> = {
                  completed: 'bg-emerald-400',
                  active: 'bg-blue-400',
                  initiated: 'bg-amber-400',
                  connecting: 'bg-yellow-400',
                  failed: 'bg-red-400',
                  ended: 'bg-zinc-400',
                };

                return (
                  <div key={status} className="p-4 bg-zinc-950/30 border border-zinc-900 rounded-xl hover:border-zinc-800 transition-all duration-300">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${dotColor[status] || 'bg-zinc-400'}`} />
                        <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">{status}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-zinc-100 font-mono">{count}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">({pct}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className={`h-full bg-gradient-to-r ${colorMap[status] || 'from-zinc-500 to-zinc-600'} rounded-full`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, iconBg, trend }: any) => (
  <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 flex flex-col justify-between min-h-[130px]">
    <div className="flex items-center justify-between">
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
      <span className="text-[9px] font-bold text-zinc-500 bg-zinc-950 border border-zinc-850 px-2 py-0.5 rounded-lg uppercase tracking-wider">
        {trend}
      </span>
    </div>
    <div className="space-y-1 mt-3">
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{label}</p>
      <h3 className="text-2xl font-bold text-zinc-100 tracking-tight">{value}</h3>
    </div>
  </div>
);

export default AnalyticsPage;
