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
    <div className="p-6 bg-zinc-950 text-white min-h-screen animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4 md:gap-5">
          <button onClick={() => navigate('/')} className="btn-back-premium">
            <ArrowLeft size={14} />
            <span>Overview</span>
          </button>
          <div>
            <h1 className="text-xl font-black uppercase tracking-widest text-white mb-1">
              Telephony Bridge
            </h1>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(0,149,255,0.4)]" />
              <p className="text-zinc-600 text-[9px] font-black uppercase tracking-widest">PSTN Gateway Interface</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Call Center */}
        <div className="lg:col-span-2 space-y-8">
          <div className="card-vapi relative overflow-hidden group glow-card-primary">
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/10 to-transparent" />
            
            <h2 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/10 rounded-md text-blue-400">
                <PhoneOutgoing size={14} />
              </div>
              Neural Outbound Dialer
            </h2>

            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">Target Persona</label>
                  <select 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg h-11 px-4 text-[11px] font-bold text-white outline-none focus:border-blue-500/40 transition-all"
                    value={selectedAgentId}
                    onChange={e => setSelectedAgentId(e.target.value)}
                  >
                    <option value="">Select Agent...</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.agentName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">PSTN Node (Number)</label>
                  <input 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg h-11 px-4 text-base font-mono text-white outline-none focus:border-blue-500/40 transition-all placeholder:text-zinc-800"
                    placeholder="+1 (555) 000-0000"
                    value={targetNumber}
                    onChange={e => setTargetNumber(e.target.value)}
                  />
                </div>
              </div>
              
              <button 
                onClick={handleTriggerCall}
                className="btn-vapi w-full h-11 shadow-2xl"
              >
                <Smartphone size={16} strokeWidth={3} />
                Execute Outbound Dispatch
              </button>
            </div>
          </div>

          <div className="card-vapi glow-card-primary">
            <h2 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
               <div className="p-1.5 bg-zinc-800 rounded-md text-zinc-400">
                <History size={14} />
              </div>
              Node Activity Logs
            </h2>
            <div className="space-y-2.5">
              {calls.length === 0 ? (
                <div className="py-8 text-center text-[9px] font-bold text-zinc-700 uppercase tracking-widest border border-dashed border-zinc-800 rounded-xl">
                  No Active Node History
                </div>
              ) : calls.map(call => (
                <div key={call.id} className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-900 rounded-xl hover:border-zinc-700 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-zinc-900 rounded-lg text-blue-500 border border-zinc-800 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <Phone size={16} />
                    </div>
                    <div>
                      <p className="font-mono text-base font-bold text-white leading-tight">{call.to_number}</p>
                      <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-0.5">{new Date(call.started_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="px-2 py-0.5 bg-emerald-500/5 text-emerald-500 border border-emerald-500/20 text-[7px] rounded font-black uppercase tracking-widest">
                      {call.status}
                    </span>
                    <button className="text-zinc-800 hover:text-white transition-colors">
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
           <div className="card-vapi glow-card-primary">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xs font-black text-white uppercase tracking-widest">PSTN Registry</h2>
                <button 
                    onClick={() => setIsAdding(true)}
                    className="p-1.5 bg-zinc-800 text-white rounded-md hover:bg-zinc-700 border border-zinc-700 transition-all"
                >
                    <Plus size={16} />
                </button>
              </div>
              <div className="space-y-2.5">
                {numbers.map(num => (
                  <div key={num.id} className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 flex justify-between items-center group hover:border-zinc-700 transition-all">
                    <div>
                      <p className="font-mono font-bold text-white tracking-widest text-sm">{num.number}</p>
                      <p className="text-[7px] text-zinc-600 font-black uppercase tracking-[0.2em] mt-0.5">{num.provider}</p>
                    </div>
                     <button className="text-zinc-900 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
           </div>
        </div>
      </div>

       {isAdding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-in fade-in duration-200">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-[360px] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Link Neural Node</h2>
              <button onClick={() => setIsAdding(false)} className="text-zinc-600 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">E.164 Phone Number</label>
                <input 
                  className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-lg px-4 text-base font-mono text-white outline-none focus:border-blue-500 placeholder:text-zinc-800 transition-all"
                  placeholder="+1..."
                  value={newNumber.number}
                  onChange={e => setNewNumber({...newNumber, number: e.target.value})}
                />
              </div>

               <button 
                  onClick={handleAddNumber}
                  disabled={loading}
                  className="btn-vapi w-full h-11"
                >
                  {loading ? <Loader2 className="animate-spin" size={16} /> : (
                    <>
                      <Smartphone size={16} />
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
