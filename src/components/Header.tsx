import type { DashboardStats } from '../types';
import { Activity, LayoutDashboard, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';

interface HeaderProps {
  stats: DashboardStats;
}

export function Header({ stats }: HeaderProps) {
  const { t } = useLanguage();
  const dashOffset = 283 - (283 * stats.totalCapacityUtilization) / 100;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col md:flex-row justify-between items-center bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 md:p-8 mb-8 border border-slate-700/50 shadow-xl shadow-black/20"
    >
      <div className="flex flex-col items-start w-full md:w-auto mb-6 md:mb-0">
        <div className="flex items-center gap-3 mb-2 text-slate-300">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <LayoutDashboard className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            {t('headerTitle')}
          </h1>
        </div>
        <p className="text-slate-400 font-medium">{t('headerSubtitle')}</p>
        
        <div className="flex gap-6 mt-6">
          <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30 flex items-center gap-4">
            <div className="bg-emerald-500/20 p-2 rounded-lg">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">{t('totalMoldsRunning')}</p>
              <p className="text-xl font-bold text-slate-200">
                {stats.totalMoldsRunning} <span className="text-sm font-medium text-slate-500">/ {stats.totalMoldsCapacity}</span>
              </p>
            </div>
          </div>
          <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30 flex items-center gap-4">
            <div className="bg-blue-500/20 p-2 rounded-lg">
              <Settings className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">{t('activeMachines')}</p>
              <p className="text-xl font-bold text-slate-200">{stats.totalMachines}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 bg-slate-800/80 p-6 rounded-2xl border border-slate-700/50">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="45"
              stroke="currentColor"
              strokeWidth="10"
              fill="transparent"
              className="text-slate-700"
            />
            <motion.circle
              cx="64"
              cy="64"
              r="45"
              stroke="currentColor"
              strokeWidth="10"
              fill="transparent"
              className="text-indigo-500"
              strokeDasharray="283"
              initial={{ strokeDashoffset: 283 }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-3xl font-black text-white"
            >
              {stats.totalCapacityUtilization}%
            </motion.span>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-200 uppercase tracking-wider mb-1">
            {t('capacity')}
          </h3>
          <p className="text-sm text-slate-400 font-medium">{t('systemUtilization')}</p>
        </div>
      </div>
    </motion.div>
  );
}
