import { Cpu, Power, PauseCircle, StopCircle } from 'lucide-react';
import type { Machine } from '../types';
import { MoldChip } from './MoldChip';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';

interface MachineCardProps {
  machine: Machine;
  index: number;
  onClick?: () => void;
  onStatusChange?: (machine: Machine, newStatus: 'active' | 'stop' | 'pause') => void;
}


export function MachineCard({ machine, index, onClick, onStatusChange }: MachineCardProps) {
  const { t } = useLanguage();

  const OP_STATUS_CONFIG = {
    active: { label: t('opActive'), color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', dot: 'bg-emerald-400', Icon: Power },
    pause:  { label: t('opPause'),  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',   dot: 'bg-amber-400',   Icon: PauseCircle },
    stop:   { label: t('opStop'),   color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/30',     dot: 'bg-rose-500',    Icon: StopCircle },
  };

  const opCfg = OP_STATUS_CONFIG[machine.operationalStatus] ?? OP_STATUS_CONFIG.active;

  const getBarColor = (pct: number) => {
    if (machine.operationalStatus !== 'active') return 'bg-slate-600';
    if (pct > 80) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const isInactive = machine.operationalStatus !== 'active';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={onClick}
      className={`relative bg-slate-800/80 backdrop-blur border rounded-2xl p-5 shadow-lg transition-all group flex flex-col h-full
        ${onClick ? 'cursor-pointer' : ''}
        ${isInactive
          ? 'border-slate-700/50 opacity-60 hover:opacity-80'
          : 'border-slate-700 hover:shadow-indigo-500/10 hover:border-slate-600'
        }`}
    >
      {/* Operational Status Badge — top right */}
      <div className="absolute top-3 right-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onStatusChange) {
              onStatusChange(machine, machine.operationalStatus);
            }
          }}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide transition-all hover:scale-105 ${opCfg.bg} ${opCfg.color}`}
          title={t('clickToChangeStatus')}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${opCfg.dot} ${machine.operationalStatus === 'active' ? 'animate-pulse' : ''}`} />
          {opCfg.label}
        </button>
      </div>

      <div className="flex items-start justify-between mb-4 pr-28">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border transition-colors
            ${isInactive ? 'bg-slate-700/30 border-slate-600/20' : 'bg-slate-700/50 border-slate-600/30 group-hover:bg-slate-700'}`}>
            <Cpu className={`w-5 h-5 ${isInactive ? 'text-slate-500' : 'text-slate-300'}`} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">{machine.id}</h2>
            <p className="text-xs text-slate-400 font-medium">{machine.name}</p>
          </div>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-black ${isInactive ? 'text-slate-500' : 'text-white'}`}>
            {isInactive ? '—' : `${machine.loadPercentage}%`}
          </span>
          {isInactive && <p className="text-[10px] text-slate-600 uppercase tracking-wider mt-0.5">{t('notCounted')}</p>}
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
            animate={{ width: isInactive ? '0%' : `${machine.loadPercentage}%` }}
            transition={{ delay: index * 0.05 + 0.3, duration: 0.8, ease: 'easeOut' }}
            className={`h-full ${getBarColor(machine.loadPercentage)}`}
          />
        </div>
      </div>

      <div className="mt-auto">
        <h3 className="text-xs uppercase font-bold text-slate-500 tracking-wider mb-3 flex items-center justify-between">
          <span>{t('runningMolds')}</span>
          <span className="bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded-full text-[10px]">
            {machine.molds.length} {t('total')}
          </span>
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
