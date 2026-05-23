import React, { useState, useEffect } from 'react';
import { Phone, PhoneOutgoing, History, MoreVertical, Plus, Trash2, Smartphone, Loader2, X, ArrowLeft } from 'lucide-react';
import { numbersApi, callsApi } from '../services/api';
import { useAgentStore } from '../store/useAgentStore';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface Number {
  id: string;
  number: string;
  provider: string;
}

interface Call {
  id: string;
  session_id: string;
  status: string;
  started_at: string;
  to_number: string;
}

export const TelephonyPanel: React.FC = () => {
  const navigate = useNavigate();
  const [numbers, setNumbers] = useState<Number[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newNumber, setNewNumber] = useState({ number: '', provider: 'custom' });
  const [targetNumber, setTargetNumber] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { agents } = useAgentStore();

  const fetchTelephonyData = async () => {
    try {
      const [numResp, callResp] = await Promise.all([
        numbersApi.list(),
        callsApi.list()
      ]);
      setNumbers(numResp.data);
      setCalls(callResp.data);
    } catch (err) {
      console.error("Failed to fetch telephony data", err);
    }
  };

  useEffect(() => { fetchTelephonyData(); }, []);

  const handleAddNumber = async () => {
    setLoading(true);
    try {
      await numbersApi.create(newNumber);
      setIsAdding(false);
      fetchTelephonyData();
      toast.success('Number Linked');
    } catch (err) {
      toast.error('Link failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerCall = async () => {
    if (!selectedAgentId) {
      toast.error('Select Neural Asset First');
      return;
    }
    
    try {
      await callsApi.outbound({ 
        to_number: targetNumber, 
        agent_id: selectedAgentId 
      });
      toast.success('Outbound Handshake Success');
      fetchTelephonyData();
    } catch (err) {
      toast.error('Dispatch failed');
    }
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-8 font-sans">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4 md:gap-5">
          <button onClick={() => navigate('/')} className="btn-back-premium">
            <ArrowLeft size={14} />
            <span>Overview</span>
          </button>
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-bold uppercase tracking-wider text-zinc-100 leading-none mb-0">
              Telephony Bridge
            </h1>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(0,149,255,0.4)] animate-pulse" />
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider leading-none">PSTN Gateway Interface</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Call Center */}
        <div className="lg:col-span-2 space-y-8">
          <div className="card-vapi relative overflow-hidden group glow-card-primary !p-6 rounded-2xl">
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/15 to-transparent" />
            
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-6 flex items-center gap-2.5">
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                <PhoneOutgoing size={15} />
              </div>
              Neural Outbound Dialer
            </h2>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Target Persona</label>
                  <select 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl h-11 px-4 text-sm font-semibold text-zinc-200 outline-none focus:border-blue-500 transition-all"
                    value={selectedAgentId}
                    onChange={e => setSelectedAgentId(e.target.value)}
                  >
                    <option value="">Select Agent...</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.agentName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">PSTN Node (Number)</label>
                  <input 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl h-11 px-4 text-sm font-mono text-zinc-200 outline-none focus:border-blue-500 transition-all placeholder:text-zinc-600"
                    placeholder="+1 (555) 000-0000"
                    value={targetNumber}
                    onChange={e => setTargetNumber(e.target.value)}
                  />
                </div>
              </div>
              
              <button 
                onClick={handleTriggerCall}
                className="btn-vapi w-full h-11 rounded-xl shadow-xs"
              >
                <Smartphone size={16} strokeWidth={2.5} />
                Execute Outbound Dispatch
              </button>
            </div>
          </div>

          <div className="card-vapi glow-card-primary !p-6 rounded-2xl">
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-6 flex items-center gap-2.5">
               <div className="p-2 bg-zinc-900 border border-zinc-850 rounded-xl text-zinc-400">
                <History size={15} />
              </div>
              Node Activity Logs
            </h2>
            <div className="space-y-3">
              {calls.length === 0 ? (
                <div className="py-10 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/20">
                  No Active Node History
                </div>
              ) : calls.map(call => (
                <div key={call.id} className="flex items-center justify-between p-5 bg-zinc-950/20 border border-zinc-900 rounded-2xl hover:border-zinc-800 hover:-translate-y-0.5 transition-all duration-300 group shadow-xs">
                  <div className="flex items-center gap-4.5">
                    <div className="p-2.5 bg-zinc-900 rounded-xl text-blue-500 border border-zinc-850 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500 transition-all duration-350 shadow-xs">
                      <Phone size={16} />
                    </div>
                    <div className="space-y-1">
                      <p className="font-mono text-base font-semibold text-zinc-100 leading-tight">{call.to_number}</p>
                      <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mt-0.5">{new Date(call.started_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="px-2.5 py-0.5 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] rounded-lg font-bold uppercase tracking-wider">
                      {call.status}
                    </span>
                    <button className="text-zinc-500 hover:text-zinc-200 transition-colors">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Numbers Management */}
        <div className="space-y-8">
           <div className="card-vapi glow-card-primary !p-6 rounded-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">PSTN Registry</h2>
                <button 
                    onClick={() => setIsAdding(true)}
                    className="p-2 bg-zinc-900 text-zinc-200 rounded-xl hover:bg-zinc-850 hover:text-zinc-100 border border-zinc-800 transition-all shadow-xs"
                    title="Add Number"
                >
                    <Plus size={16} strokeWidth={2.5} />
                </button>
              </div>
              <div className="space-y-3">
                {numbers.length === 0 ? (
                  <div className="py-8 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/20">
                    No Registered Numbers
                  </div>
                ) : numbers.map(num => (
                  <div key={num.id} className="p-5 bg-zinc-950/20 rounded-2xl border border-zinc-900 flex justify-between items-center group hover:border-zinc-800 hover:-translate-y-0.5 transition-all duration-300 shadow-xs">
                    <div className="space-y-1">
                      <p className="font-mono font-semibold text-zinc-100 tracking-wide text-sm">{num.number}</p>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">{num.provider}</p>
                    </div>
                     <button className="text-zinc-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
           </div>
        </div>
      </div>

       {isAdding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-[360px] rounded-2xl p-8 shadow-2xl relative overflow-hidden animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-base font-bold text-zinc-100 uppercase tracking-wider">Link Neural Node</h2>
              <button onClick={() => setIsAdding(false)} className="text-zinc-500 hover:text-zinc-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">E.164 Phone Number</label>
                <input 
                  className="w-full h-11 bg-zinc-900 border border-zinc-850 rounded-xl px-4 text-sm font-mono text-zinc-200 outline-none focus:border-blue-500 placeholder:text-zinc-600 transition-all"
                  placeholder="+1..."
                  value={newNumber.number}
                  onChange={e => setNewNumber({...newNumber, number: e.target.value})}
                />
              </div>

               <button 
                  onClick={handleAddNumber}
                  disabled={loading}
                  className="btn-vapi w-full h-11 rounded-xl"
                >
                  {loading ? <Loader2 className="animate-spin" size={16} /> : (
                    <>
                      <Smartphone size={16} strokeWidth={2.5} />
                      Verify Node
                    </>
                  )}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
