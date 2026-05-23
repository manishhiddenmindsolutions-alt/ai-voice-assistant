import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface DecommissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  itemName: string;
  loading?: boolean;
}

export const DecommissionModal: React.FC<DecommissionModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  itemName,
  loading = false 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-2xl flex items-center justify-center p-6 z-[300] animate-in fade-in duration-500">
      <div className="glass border border-red-500/20 w-full max-w-lg rounded-[3rem] p-12 shadow-[0_0_100px_rgba(239,68,68,0.1)] relative overflow-hidden">
        {/* NEURAL RED SCANNER */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-linear-to-r from-transparent via-red-500/40 to-transparent animate-shimmer" />
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-red-500/5 blur-[100px] rounded-full" />
        
        <div className="absolute top-0 right-0 p-8">
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col items-center text-center space-y-6 relative">
          <div className="w-24 h-24 rounded-[2rem] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-2xl relative">
            <div className="absolute inset-0 bg-red-500/20 rounded-[2rem] animate-pulse blur-xl" />
            <AlertTriangle size={48} className="relative z-10" />
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl font-heading font-bold text-zinc-100 tracking-tight uppercase tracking-[0.3em] ml-2">{title}</h2>
            <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-sm">
              Confirming this action will <span className="text-red-400 font-bold uppercase tracking-widest">permanently sever</span> the neural connection to <span className="text-zinc-100 font-bold bg-zinc-900 border border-zinc-850 px-2 py-1 rounded">"{itemName}"</span>.
            </p>
          </div>

          <div className="flex flex-col w-full gap-4 pt-6">
            <button 
              onClick={onConfirm}
              disabled={loading}
              className="w-full h-16 rounded-[1.25rem] bg-red-600 hover:bg-red-500 text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-4 overflow-hidden group shadow-[0_15px_30px_rgba(239,68,68,0.25)] relative"
            >
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
              <Trash2 size={20} className="group-hover:rotate-12 transition-transform" />
              {loading ? 'Powering Down...' : 'Confirm Termination'}
            </button>
            <button 
              onClick={onClose}
              className="w-full h-14 rounded-[1.25rem] border border-zinc-800 bg-zinc-900/10 hover:bg-zinc-900/30 text-zinc-500 hover:text-zinc-100 text-[11px] font-bold uppercase tracking-[0.2em] transition-all"
            >
              Abort Signal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
