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
    Edit2
} from 'lucide-react';
import { agentApi, sessionApi } from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { DecommissionModal } from '../components/DecommissionModal';

const AgentsPage = () => {
    const { agents, setAgents, setEditingAgent, setActiveSession } = useAgentStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [decommissioningItem, setDecommissioningItem] = useState<{id: string, name: string} | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const navigate = useNavigate();

    const fetchAgents = async (silent = false) => {
        if (!silent) setIsLoading(true);
        else setIsRefreshing(true);

        try {
            const res = await agentApi.list();
            setAgents(res.data);
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
            toast.success('Assistant Live', { id: toastId });
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
            toast.success(`${name} Decommissioned`, { id: toastId });
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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="space-y-1">
                    <h1 className="text-xl md:text-2xl font-heading font-black text-white uppercase tracking-wider leading-tight">Assistant Registry</h1>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                        <p className="text-zinc-600 text-[9px] font-black uppercase tracking-widest opacity-80">Neural Forge Sync Active • Region US-EAST</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={() => fetchAgents(true)}
                        className={`flex-1 md:w-10 md:h-10 h-10 flex items-center justify-center rounded-lg border border-border bg-zinc-950/50 text-zinc-500 hover:text-white transition-all backdrop-blur-sm ${isRefreshing ? 'animate-spin text-primary border-primary/40' : ''}`}
                        title="Sync Registry"
                    >
                        <RefreshCw size={16} />
                    </button>
                    <button
                        onClick={() => { setEditingAgent(null); navigate('/agents/create'); }}
                        className="flex-[4] md:w-auto btn-vapi h-10 !px-6 shadow-[0_0_20px_rgba(0,97,255,0.1)]"
                    >
                        <Plus size={16} strokeWidth={3} />
                        Register Node
                    </button>
                </div>
            </div>

            {/* FILTERS BAR */}
            <div className="flex flex-col md:flex-row items-center gap-4 mb-10">
                <div className="relative flex-1 w-full group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-primary transition-colors" size={16} />
                    <input
                        type="text"
                        placeholder="SEARCH NEURAL REGISTRY..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input-vapi w-full pl-11 pr-5 py-2.5 h-10 text-[10px] uppercase tracking-widest border-border bg-zinc-950/30 md:max-w-md"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors">
                            <X size={14} />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button className="flex-1 md:w-auto h-10 px-5 border border-border rounded-lg bg-zinc-950/50 text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-white hover:border-zinc-700 transition-all flex items-center justify-center gap-3 backdrop-blur-sm">
                        <Filter size={14} />
                        Filter Ops
                    </button>
                    <div className="flex-1 md:w-auto h-10 px-4 border border-border rounded-lg bg-zinc-950/20 flex items-center justify-center gap-3">
                        <Users size={14} className="text-zinc-700" />
                        <span className="text-[9px] font-black text-zinc-700 uppercase tracking-widest leading-none whitespace-nowrap">{agents.length} Nodes</span>
                    </div>
                </div>
            </div>

            {/* ASSISTANTS GRID */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-64 skeleton-vapi" />)}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAgents.map((agent) => (
                        <div
                            key={agent.id}
                            className="card-vapi !p-6 rounded-2xl flex flex-col relative overflow-hidden glow-card-primary group/card animate-in fade-in slide-in-from-bottom-4 duration-300"
                        >
                            {/* Cyber Grid Backdrop */}
                            <div className="absolute inset-0 bg-cyber-grid opacity-[0.03] group-hover/card:opacity-[0.06] transition-opacity pointer-events-none -z-10" />
                            <div className="flex items-start justify-between mb-6 relative z-10">
                                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-border flex items-center justify-center text-xl shadow-inner">
                                    {(agent.agentName || '').includes('Property') ? '🏘️' : '🤖'}
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    <div className="px-2 py-0.5 bg-emerald-500/5 border border-emerald-500/20 rounded-md flex items-center gap-1.5">
                                        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Active</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={(e) => handleEdit(agent, e as any)}
                                            className="p-1.5 text-zinc-700 hover:text-white transition-all bg-zinc-950 rounded-md border border-border hover:border-zinc-600"
                                            title="Edit"
                                        >
                                            <Edit2 size={12} />
                                        </button>
                                        <button 
                                            onClick={(e) => handleDelete(agent.id, agent.agentName, e as any)}
                                            className="p-1.5 text-zinc-700 hover:text-red-500 transition-all bg-zinc-950 rounded-md border border-border hover:border-red-500/30"
                                            title="Delete"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div 
                                onClick={(e) => handleEdit(agent, e as any)}
                                className="flex-1 space-y-3 relative z-10 cursor-pointer"
                            >
                                <div className="space-y-0.5">
                                    <h3 className="text-base font-black text-white uppercase tracking-wide group-hover:text-primary transition-colors line-clamp-1">{agent.agentName || 'Unnamed Node'}</h3>
                                    <div className="flex items-center gap-1.5 opacity-40">
                                        <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-950 px-1 py-0.5 rounded border border-white/5">NODE</span>
                                        <span className="text-[9px] text-zinc-600 font-mono tracking-tighter truncate max-w-[100px]">{agent.id}</span>
                                    </div>
                                </div>

                                <p className="text-[11px] text-zinc-600 font-medium line-clamp-2 min-h-[2rem] leading-relaxed italic opacity-80">
                                    {agent.prompt || 'Autonomous forge agent ready for deployment.'}
                                </p>

                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    <Badge label={agent.language} icon={<Globe size={9} className="text-zinc-700" />} />
                                    <Badge label={agent.llm?.model || 'llama-3.3'} icon={<Cpu size={9} className="text-zinc-700" />} />
                                </div>
                            </div>

                            <div className="mt-6 pt-5 border-t border-zinc-900 flex items-center justify-between relative z-10">
                                <div className="flex flex-col">
                                    <span className="text-[7px] font-black text-zinc-800 uppercase tracking-widest">Protocol</span>
                                    <span className="text-[8px] font-black text-zinc-500 uppercase mt-0.5 tracking-wider">FORGE V.1</span>
                                </div>
                                <button
                                    onClick={(e) => handleLaunch(agent, e as any)}
                                    className="btn-vapi !px-4 !h-8 text-[8px] !rounded-md"
                                >
                                    <Play size={10} fill="currentColor" strokeWidth={0} />
                                    Launch Node
                                </button>
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={() => { setEditingAgent(null); navigate('/agents/create'); }}
                        className="bg-zinc-950/20 border border-dashed border-zinc-900 rounded-xl p-6 flex flex-col items-center justify-center gap-4 hover:border-zinc-700 hover:bg-zinc-900/10 group transition-all duration-300 min-h-[280px]"
                    >
                        <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-900 flex items-center justify-center text-zinc-800 group-hover:text-white group-hover:border-zinc-700 transition-all duration-300">
                            <Plus size={20} />
                        </div>
                        <div className="text-center space-y-0.5">
                            <h4 className="text-[9px] font-black text-white uppercase tracking-widest">Initialize Node</h4>
                            <p className="text-[8px] text-zinc-800 font-bold uppercase tracking-widest opacity-50">Deploy to Forge</p>
                        </div>
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
}

const Badge = ({ label, icon }: BadgeProps) => (
    <div className="flex items-center gap-2 px-2 py-1 bg-zinc-950 border border-white/5 rounded-md text-[9px] font-black text-zinc-600 uppercase tracking-widest leading-none">
        {icon}
        <span>{label}</span>
    </div>
);

export default AgentsPage;
