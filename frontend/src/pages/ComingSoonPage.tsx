import { Construction, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ComingSoonPage = ({ title }: { title: string }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 relative overflow-hidden px-4">
      {/* GLOWING AMBIENT CORE */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[140px] -z-10 pointer-events-none animate-pulse-slow" />
      
      {/* FLOATING SPHERE WITH ROTATING BORDER */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-65 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
        <div className="relative w-20 h-20 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-primary shadow-2xl animate-neural-float duration-500">
          <Construction size={36} strokeWidth={1.5} className="text-primary" />
        </div>
      </div>
      
      <div className="space-y-3.5 relative z-10">
        <h1 className="text-2xl md:text-3xl font-heading font-black text-zinc-100 uppercase tracking-widest leading-tight">{title}</h1>
        <p className="text-zinc-500 max-w-sm mx-auto font-bold text-xs leading-relaxed uppercase tracking-wider opacity-85">
          Neural Blueprint Pending
        </p>
        <p className="text-zinc-600 max-w-md mx-auto font-medium text-sm leading-relaxed italic">
          "We're fine-tuning this cybernetic operator module. Link established but awaiting final signal dispatch."
        </p>
      </div>

      <button 
        onClick={() => navigate('/')}
        className="btn-back-premium !px-6 !py-2.5 relative z-10 group mt-4 hover:shadow-[0_0_25px_rgba(0,112,243,0.15)] hover:border-primary/20 transition-all duration-300"
      >
        <ArrowLeft size={14} />
        <span>Return to Overview</span>
      </button>

      {/* Cyber Grid Sub-overlay */}
      <div className="absolute inset-0 bg-cyber-grid opacity-20 pointer-events-none -z-20" />
    </div>
  );
};

export default ComingSoonPage;
