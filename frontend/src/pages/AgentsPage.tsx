import { useState, useEffect } from 'react';
import { useAgentStore } from '../store/useAgentStore';
import {
    Search,
    Play,
    Plus,
    RefreshCw,
    Globe,
    Cpu,
    X,
    Filter,
    Users,
    Trash2,
    Edit2,
    Phone
} from 'lucide-react';
import { agentApi, sessionApi, numbersApi } from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { DecommissionModal } from '../components/DecommissionModal';
import { BackButton } from '../components/BackButton';
import { AgentAvatar } from '../components/AgentAvatar';

const AgentsPage = () => {
    const { agents, setAgents, setEditingAgent, setActiveSession } = useAgentStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [decommissioningItem, setDecommissioningItem] = useState<{id: string, name: string} | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [numbers, setNumbers] = useState<any[]>([]);
    const navigate = useNavigate();

    const fetchNumbers = async () => {
        try {
            const resp = await numbersApi.list();
            setNumbers(resp.data);
        } catch (err) {
            console.error("Failed to load active telephony numbers", err);
        }
    };

    const fetchAgents = async (silent = false) => {
        if (!silent) setIsLoading(true);
        else setIsRefreshing(true);

        try {
            const res = await agentApi.list();
            setAgents(res.data);
            fetchNumbers();
        } catch (err) {
            console.error('Fetch failed', err);
            toast.error('Failed to sync assistants');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAgents();
    }, []);

    const handleEdit = (agent: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingAgent(agent);
        navigate('/agents/create');
    };

    const handleLaunch = async (agent: any, e: React.MouseEvent) => {
        e.stopPropagation();
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

    const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDecommissioningItem({ id, name });
    };

    const confirmDecommission = async () => {
        if (!decommissioningItem) return;
        setIsDeleting(true);
        const { id, name } = decommissioningItem;

        const toastId = toast.loading(`Decommissioning ${name}...`);
        try {
            await agentApi.delete(id);
            toast.success(`${name} decommissioned`, { id: toastId });
            setDecommissioningItem(null);
            fetchAgents(true);
        } catch (err) {
            console.error('Delete failed:', err);
            toast.error('Failed to delete assistant', { id: toastId });
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredAgents = (agents || []).filter(a =>
        (a.agentName || 'Unnamed Assistant').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-300">

            {/* HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
                <div>
                    <div className="mb-5">
                        <BackButton fallbackPath="/" label="Overview" />
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
                        Assistants Registry
                    </h1>
                    <p className="text-sm text-zinc-500 mt-2">
                        Deploy, monitor and orchestrate your autonomous AI voice agents.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchAgents(true)}
                        className={`w-11 h-11 flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all ${isRefreshing ? 'animate-spin' : ''}`}
                        title="Sync Registry"
                    >
                        <RefreshCw size={16} />
                    </button>

                    <button
                        onClick={() => { setEditingAgent(null); navigate('/agents/create'); }}
                        className="h-11 px-5 rounded-xl bg-primary text-on-primary text-sm font-medium hover:opacity-90 transition flex items-center gap-2 shadow-lg shadow-primary/10"
                    >
                        <Plus size={16} />
                        Register Assistant
                    </button>
                </div>
            </div>

            {/* FILTERS BAR */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                <div className="relative flex-1 w-full max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={15} />
                    <input
                        type="text"
                        placeholder="Search HMS registry..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-11 rounded-xl border border-zinc-800 bg-zinc-950/40 pl-11 pr-10 text-sm outline-none focus:border-primary transition"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-355">
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button className="h-11 px-4 border border-zinc-800 rounded-xl bg-zinc-900/30 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition flex items-center gap-2">
                        <Filter size={14} />
                        Filter Operations
                    </button>
                    <div className="h-11 px-4 border border-zinc-850 rounded-xl bg-zinc-950/20 flex items-center gap-2 text-zinc-550 text-xs font-semibold uppercase tracking-wider">
                        <Users size={14} className="text-zinc-500" />
                        <span>{agents.length} Nodes</span>
                    </div>
                </div>
            </div>

            {/* ASSISTANTS GRID */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-64 rounded-2xl border border-zinc-850 bg-zinc-900/20 animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredAgents.map((agent) => {
                        return (
                             <div
                                key={agent.id}
                                className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 hover:border-primary/30 hover:bg-zinc-900/60 hover:-translate-y-1 hover:shadow-md transition-all duration-300 flex flex-col justify-between min-h-[290px] group cursor-pointer relative overflow-hidden"
                            >
                                <div>
                                    {/* CARD TOP */}
                                    <div className="flex items-start justify-between mb-5">
                                        <div className="flex items-center gap-4">
                                            <AgentAvatar name={agent.agentName} agent={agent} className="w-12 h-12 text-2xl" />

                                            <div>
                                                <h3 className="text-base font-semibold text-zinc-105 line-clamp-1 leading-tight group-hover:text-primary transition-colors duration-300">
                                                    {agent.agentName || 'Unnamed Node'}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 text-[10px] font-semibold uppercase tracking-wider scale-90">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        <span>Active</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* TOP CONTROL OVERLAYS */}
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={(e) => handleEdit(agent, e)}
                                                className="w-9 h-9 rounded-2xl border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 transition-all shadow"
                                                title="Configure"
                                            >
                                                <Edit2 size={13} />
                                            </button>
                                            <button 
                                                onClick={(e) => handleDelete(agent.id, agent.agentName, e)}
                                                className="w-9 h-9 rounded-2xl border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-905 flex items-center justify-center text-zinc-455 hover:text-red-400 hover:border-red-500/20 transition-all shadow"
                                                title="Decommission"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* PROMPT DESCRIPTION */}
                                    <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3 min-h-[60px] italic pt-1">
                                        "{agent.prompt || 'Autonomous voice assistant configured and ready for live operation.'}"
                                    </p>
                                </div>

                                {/* FOOTER & LAUNCH ACTIONS */}
                                <div className="mt-5 pt-4 border-t border-zinc-900/60 flex items-center justify-between">
                                    <div className="flex flex-wrap gap-2 max-w-[70%]">
                                        <Badge 
                                            label={agent.language.toUpperCase()} 
                                            icon={<Globe size={12} className="text-zinc-500 group-hover:text-primary transition-colors" />} 
                                        />
                                        <Badge 
                                            label={agent.llm?.model ? agent.llm.model.split('/').pop()?.substring(0, 12) || agent.llm.model.substring(0, 12) : 'llama-3.3'} 
                                            icon={<Cpu size={12} className="text-zinc-500 group-hover:text-primary transition-colors" />} 
                                        />
                                        {numbers.filter(n => n.agent_id === agent.id).length > 0 ? (
                                            numbers.filter(n => n.agent_id === agent.id).map(n => (
                                                <Badge 
                                                    key={n.id}
                                                    label={n.number} 
                                                    icon={<Phone size={11} className="text-orange-500" />} 
                                                    onClick={(e) => { e.stopPropagation(); navigate('/numbers'); }}
                                                    className="cursor-pointer border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 text-orange-400 font-bold"
                                                />
                                            ))
                                        ) : (
                                            <Badge 
                                                label="Link Line" 
                                                icon={<Plus size={10} className="text-zinc-500 group-hover:text-primary transition-colors" />} 
                                                onClick={(e) => { e.stopPropagation(); navigate('/numbers'); }}
                                                className="cursor-pointer hover:bg-zinc-800/80 hover:text-zinc-200"
                                            />
                                        )}
                                    </div>

                                    <button
                                        onClick={(e) => handleLaunch(agent, e)}
                                        className="h-9 px-4 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-zinc-100 transition-all flex items-center gap-2 shadow group/btn"
                                    >
                                        <Play size={10} fill="currentColor" strokeWidth={0} className="text-emerald-500 group-hover/btn:scale-110 group-hover/btn:text-emerald-450 transition-transform" />
                                        <span>Launch</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* ADD NEW CARD OVERHAUL */}
                    <button
                        onClick={() => { setEditingAgent(null); navigate('/agents/create'); }}
                        className="rounded-3xl border-2 border-dashed border-zinc-850 bg-zinc-900/10 p-6 flex flex-col items-center justify-center min-h-[290px] hover:border-primary/45 hover:bg-zinc-900/20 hover:-translate-y-1 hover:shadow-md transition-all duration-300 group"
                    >
                        <div className="w-14 h-14 rounded-3xl bg-zinc-950 flex items-center justify-center text-zinc-500 group-hover:text-zinc-200 transition-all border border-zinc-800 mb-5 group-hover:scale-105 group-hover:border-primary/20">
                            <Plus size={20} />
                        </div>
                        <h3 className="text-base font-semibold text-zinc-200 group-hover:text-primary transition-colors">
                            Register Assistant
                        </h3>
                        <p className="text-sm text-zinc-500 mt-2 text-center max-w-[220px] leading-relaxed">
                            Initialize a new connection node for your voice assistant.
                        </p>
                    </button>
                </div>
            )}

            <DecommissionModal 
                isOpen={!!decommissioningItem}
                onClose={() => setDecommissioningItem(null)}
                onConfirm={confirmDecommission}
                title="Decommission Assistant"
                itemName={decommissioningItem?.name || ''}
                loading={isDeleting}
            />
        </div>
    );
};

interface BadgeProps {
    label: string;
    icon: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    className?: string;
}

const Badge = ({ label, icon, onClick, className }: BadgeProps) => (
    <div 
        onClick={onClick}
        className={`flex items-center gap-1.5 px-3 py-1 bg-zinc-950 border border-zinc-800/80 rounded-lg text-[10px] font-mono text-zinc-400 leading-none transition-all duration-200 select-none ${className || ''}`}
    >
        {icon}
        <span>{label}</span>
    </div>
);

export default AgentsPage;
