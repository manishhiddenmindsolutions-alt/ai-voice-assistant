import { useState, useEffect } from 'react';
import {
  History,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  Loader2,
  Phone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  User,
  Bot,
  X,
} from 'lucide-react';
import { callsApi } from '../services/api';
import { useAgentStore } from '../store/useAgentStore';
import { BackButton } from '../components/BackButton';

interface CallRecord {
  id: string;
  session_id: string;
  agent_id: string;
  agent_name: string;
  from_number: string;
  to_number: string;
  direction: string;
  status: string;
  duration_seconds: number;
  tokens_used: number;
  started_at: string;
  ended_at: string | null;
  transcript_count: number;
}

interface Transcript {
  role: string;
  content: string;
  timestamp: string;
}

const statusConfig: Record<string, { color: string; bg: string; border: string; icon: any }> = {
  completed: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 },
  active: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Zap },
  initiated: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Phone },
  connecting: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: Phone },
  failed: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: XCircle },
  ended: { color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', icon: CheckCircle2 },
};

const formatDuration = (seconds: number): string => {
  if (!seconds || seconds === 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const CallLogsPage = () => {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loadingTranscripts, setLoadingTranscripts] = useState(false);
  
  // Filters
  const [directionFilter, setDirectionFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  
  const { agents } = useAgentStore();

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50, offset: 0, days: 90 };
      if (directionFilter) params.direction = directionFilter;
      if (statusFilter) params.status = statusFilter;
      
      const resp = await callsApi.list(params);
      setCalls(resp.data.calls || []);
      setTotal(resp.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch calls:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, [directionFilter, statusFilter]);

  const handleExpandCall = async (callId: string) => {
    if (expandedCallId === callId) {
      setExpandedCallId(null);
      setTranscripts([]);
      return;
    }
    setExpandedCallId(callId);
    setLoadingTranscripts(true);
    try {
      const resp = await callsApi.detail(callId);
      setTranscripts(resp.data.transcripts || []);
    } catch (err) {
      console.error('Failed to fetch transcripts:', err);
      setTranscripts([]);
    } finally {
      setLoadingTranscripts(false);
    }
  };

  const filteredCalls = searchQuery
    ? calls.filter(c =>
        c.to_number?.includes(searchQuery) ||
        c.from_number?.includes(searchQuery) ||
        c.agent_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.session_id?.includes(searchQuery)
      )
    : calls;

  return (
    <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4 md:gap-5">
          <BackButton fallbackPath="/" label="Overview" />
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-bold uppercase tracking-wider text-zinc-100 leading-none mb-0">
              Call Logs
            </h1>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse" />
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider leading-none">
                {total} Total Records
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 border ${
              showFilters
                ? 'bg-zinc-900 text-emerald-400 border-emerald-500/20'
                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <Filter size={13} />
            Filters
            {(directionFilter || statusFilter) && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
        </div>
      </div>

      {/* FILTERS BAR */}
      {showFilters && (
        <div className="mb-6 p-5 bg-zinc-950/60 border border-zinc-800 rounded-2xl animate-in slide-in-from-top duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl h-10 pl-9 pr-4 text-sm text-zinc-200 outline-none focus:border-emerald-500 transition-all placeholder:text-zinc-600"
                placeholder="Search numbers, agents..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* Direction */}
            <select
              className="bg-zinc-900 border border-zinc-800 rounded-xl h-10 px-4 text-sm font-semibold text-zinc-200 outline-none focus:border-emerald-500 transition-all cursor-pointer"
              value={directionFilter}
              onChange={e => setDirectionFilter(e.target.value)}
            >
              <option value="">All Directions</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
            
            {/* Status */}
            <select
              className="bg-zinc-900 border border-zinc-800 rounded-xl h-10 px-4 text-sm font-semibold text-zinc-200 outline-none focus:border-emerald-500 transition-all cursor-pointer"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="active">Active</option>
              <option value="initiated">Initiated</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          
          {(directionFilter || statusFilter || searchQuery) && (
            <button
              onClick={() => { setDirectionFilter(''); setStatusFilter(''); setSearchQuery(''); }}
              className="mt-3 text-[10px] text-zinc-500 font-bold uppercase tracking-wider hover:text-zinc-300 transition-colors flex items-center gap-1"
            >
              <X size={10} /> Clear All Filters
            </button>
          )}
        </div>
      )}

      {/* CALL LIST */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-zinc-500" size={24} />
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-zinc-800 rounded-3xl bg-zinc-950/20">
            <History className="mx-auto mb-4 text-zinc-700" size={40} />
            <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">No Call Records Found</p>
            <p className="text-xs text-zinc-600 mt-2">Make your first call from the Telephony Bridge</p>
          </div>
        ) : (
          filteredCalls.map(call => {
            const isExpanded = expandedCallId === call.id;
            const statusCfg = statusConfig[call.status] || statusConfig.ended;
            const StatusIcon = statusCfg.icon;

            return (
              <div key={call.id} className="group">
                {/* Call Row */}
                <div
                  onClick={() => handleExpandCall(call.id)}
                  className={`flex items-center justify-between p-5 border rounded-2xl cursor-pointer transition-all duration-300 ${
                    isExpanded
                      ? 'bg-zinc-900/60 border-zinc-700 shadow-lg'
                      : 'bg-zinc-950/20 border-zinc-900 hover:border-zinc-800 hover:-translate-y-0.5 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Direction Icon */}
                    <div className={`p-2.5 rounded-xl border transition-all duration-300 shrink-0 ${
                      call.direction === 'inbound'
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                        : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                    }`}>
                      {call.direction === 'inbound' ? <PhoneIncoming size={16} /> : <PhoneOutgoing size={16} />}
                    </div>

                    {/* Call Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <p className="font-mono text-sm font-semibold text-zinc-100 truncate">
                          {call.direction === 'outbound' ? call.to_number : call.from_number || 'Unknown'}
                        </p>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded shrink-0">
                          {call.direction}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] text-zinc-500 font-semibold">
                          {call.agent_name}
                        </span>
                        <span className="text-zinc-800">•</span>
                        <span className="text-[10px] text-zinc-600 font-mono">
                          {call.started_at ? new Date(call.started_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {/* Duration */}
                    <div className="hidden sm:flex items-center gap-1.5 text-zinc-500">
                      <Clock size={12} />
                      <span className="text-[10px] font-mono font-bold">{formatDuration(call.duration_seconds)}</span>
                    </div>

                    {/* Transcript Count */}
                    {call.transcript_count > 0 && (
                      <div className="hidden sm:flex items-center gap-1.5 text-zinc-500">
                        <MessageSquare size={12} />
                        <span className="text-[10px] font-mono font-bold">{call.transcript_count}</span>
                      </div>
                    )}

                    {/* Status Badge */}
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${statusCfg.color} ${statusCfg.bg} border ${statusCfg.border}`}>
                      <StatusIcon size={10} />
                      {call.status}
                    </span>

                    {/* Expand Arrow */}
                    <div className="text-zinc-600">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Transcript Expansion */}
                {isExpanded && (
                  <div className="mt-1 ml-6 mr-2 p-5 bg-zinc-950/60 border border-zinc-800 rounded-2xl animate-in slide-in-from-top duration-200">
                    <div className="flex items-center gap-2 mb-4">
                      <MessageSquare size={13} className="text-zinc-500" />
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Conversation Transcript</span>
                    </div>

                    {loadingTranscripts ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin text-zinc-600" size={18} />
                      </div>
                    ) : transcripts.length === 0 ? (
                      <p className="text-xs text-zinc-600 text-center py-6 font-semibold uppercase tracking-wider">
                        No transcript data available
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                        {transcripts.map((t, i) => (
                          <div key={i} className={`flex gap-3 ${t.role === 'agent' ? '' : 'flex-row-reverse'}`}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              t.role === 'agent'
                                ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              {t.role === 'agent' ? <Bot size={12} /> : <User size={12} />}
                            </div>
                            <div className={`max-w-[75%] p-3 rounded-xl text-sm ${
                              t.role === 'agent'
                                ? 'bg-zinc-900 border border-zinc-800 text-zinc-300'
                                : 'bg-blue-500/10 border border-blue-500/15 text-zinc-200'
                            }`}>
                              <p className="leading-relaxed">{t.content}</p>
                              <span className="text-[9px] text-zinc-600 font-mono mt-1 block">
                                {t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : ''}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Call Metadata */}
                    <div className="mt-4 pt-4 border-t border-zinc-800/60 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider block">Session</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{call.session_id}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider block">Duration</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{formatDuration(call.duration_seconds)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider block">From</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{call.from_number || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider block">To</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{call.to_number || '—'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CallLogsPage;
