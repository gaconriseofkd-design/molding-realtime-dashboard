import { Cpu } from 'lucide-react';
import type { Machine } from '../types';
import { MoldChip } from './MoldChip';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';

interface MachineCardProps {
  machine: Machine;
  index: number;
}

export function MachineCard({ machine, index }: MachineCardProps) {
  const { t } = useLanguage();
  const getStatusColor = (percentage: number) => {
    if (percentage > 80) return 'bg-emerald-500';
    if (percentage >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const statusColor = getStatusColor(machine.loadPercentage);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl p-5 shadow-lg hover:shadow-indigo-500/10 hover:border-slate-600 transition-all group flex flex-col h-full"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-slate-700/50 p-2.5 rounded-xl border border-slate-600/30 group-hover:bg-slate-700 transition-colors">
            <Cpu className="w-5 h-5 text-slate-300" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">{machine.id}</h2>
            <p className="text-xs text-slate-400 font-medium">{machine.name}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-white">
            {machine.loadPercentage}%
          </span>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-end mb-2">
          <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{t('capacityLoad')}</span>
          <span className="text-sm text-slate-400 font-mono">
            <strong className="text-slate-200">{machine.moldsRunning}</strong> / {machine.maxMolds} {t('molds')}
          </span>
        </div>
        <div className="h-2 w-full bg-slate-700/50 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${machine.loadPercentage}%` }}
            transition={{ delay: index * 0.1 + 0.3, duration: 0.8, ease: "easeOut" }}
            className={`h-full ${statusColor}`} 
          />
        </div>
      </div>

      <div className="mt-auto">
        <h3 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-3 flex items-center justify-between">
          <span>{t('runningMolds')}</span>
          <span className="bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded-full text-[10px]">{machine.molds.length} {t('total')}</span>
        </h3>
        <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto scrollbar-thin pr-1 pb-1">
          {machine.molds.map(mold => (
            <MoldChip key={mold.id} mold={mold} />
          ))}
          {machine.molds.length === 0 && (
            <div className="text-sm text-slate-500 italic py-2">{t('noMolds')}</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
