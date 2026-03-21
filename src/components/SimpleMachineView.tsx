import { motion } from 'framer-motion';
import type { Machine } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface SimpleMachineViewProps {
  machines: Machine[];
  onMachineClick: (machine: Machine) => void;
  onStatusChange: (machine: Machine, newStatus: 'active' | 'stop' | 'pause') => void;
}

export function SimpleMachineView({ machines, onMachineClick, onStatusChange }: SimpleMachineViewProps) {
  const { t } = useLanguage();

  const getStatusColor = (machine: Machine) => {
    // Priority 1: Mold status alerts
    const hasAlert = machine.molds.some(m => !!m.statusNote);
    if (hasAlert) return 'bg-rose-500/30 border-rose-500 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse-red';

    if (machine.operationalStatus === 'stop') return 'bg-rose-500/20 border-rose-500/50 text-rose-400';
    if (machine.operationalStatus === 'pause') return 'bg-amber-500/20 border-amber-500/50 text-amber-400';
    
    const pct = machine.loadPercentage;
    if (machine.moldsRunning > machine.maxMolds) return 'bg-rose-500/30 border-rose-500 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/50';
    if (pct >= 80) return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400';
    if (pct >= 50) return 'bg-amber-500/20 border-amber-500/50 text-amber-400';
    return 'bg-rose-500/20 border-rose-500/50 text-rose-400';
  };

  const getDotColor = (machine: Machine) => {
    if (machine.operationalStatus === 'stop') return 'bg-rose-500';
    if (machine.operationalStatus === 'pause') return 'bg-amber-500';
    const pct = machine.loadPercentage;
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 xxl:grid-cols-10 gap-3">
      {machines.map((machine, idx) => (
        <motion.div
          key={machine.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: idx * 0.01 }}
          whileHover={{ scale: 1.05, zIndex: 10 }}
          className={`relative cursor-pointer group p-3 rounded-xl border backdrop-blur-sm transition-all shadow-lg ${getStatusColor(machine)}`}
          onClick={() => onMachineClick(machine)}
        >
          <div className="flex flex-col items-center text-center gap-1">
            <span className="text-[10px] font-black uppercase tracking-tighter opacity-60 leading-none">
              {machine.id}
            </span>
            <span className="text-xl font-black leading-none py-1">
              {machine.operationalStatus === 'active' ? `${machine.loadPercentage}%` : t('offLabel')}
            </span>
            <div className="flex items-center gap-1 mt-1" title={t('status')}>
               <span className={`w-1.5 h-1.5 rounded-full ${getDotColor(machine)} ${machine.operationalStatus === 'active' ? 'animate-pulse' : ''}`} />
               <button 
                 onClick={(e) => {
                   e.stopPropagation();
                   onStatusChange(machine, machine.operationalStatus);
                 }}
                 className="text-[9px] font-bold uppercase hover:underline"
               >
                 {machine.name.split(' ').pop()}
               </button>
            </div>
          </div>
          
          {/* Progress mini bar at the bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 rounded-b-xl overflow-hidden">
             <motion.div 
               initial={{ width: 0 }}
               animate={{ width: machine.operationalStatus === 'active' ? `${machine.loadPercentage}%` : '0%' }}
               className={`h-full ${getDotColor(machine)}`}
             />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
