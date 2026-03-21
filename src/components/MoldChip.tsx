import { Package, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Mold } from '../types';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';

interface MoldChipProps {
  mold: Mold;
}

export function MoldChip({ mold }: MoldChipProps) {
  const { t } = useLanguage();
  const [duration, setDuration] = useState<string>('');

  useEffect(() => {
    const calculateDuration = () => {
      if (!mold.updatedAt) return '--';
      const start = new Date(mold.updatedAt).getTime();
      const now = new Date().getTime();
      const diffMs = now - start;
      
      if (diffMs < 0) return '0m';

      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) {
        return `${diffDays}d ${diffHours % 24}h`;
      }
      if (diffHours > 0) {
        return `${diffHours}h ${diffMins % 60}m`;
      }
      return `${diffMins}m`;
    };

    setDuration(calculateDuration());
    const timer = setInterval(() => {
      setDuration(calculateDuration());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [mold.updatedAt]);

  return (
    <div 
      className="inline-flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 shadow-sm hover:border-slate-600 transition-colors"
    >
      <div className="flex items-center gap-1.5 text-slate-300">
        <Package className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-xs font-semibold">{mold.name}</span>
      </div>
      
      <div className="h-3 w-px bg-slate-600"></div>
      
      <span className="text-xs text-slate-400 font-medium w-6 text-center">{mold.size}</span>
      
      <div className="h-3 w-px bg-slate-600"></div>
      
      <div className="flex items-center gap-1 font-mono text-xs" title={t('qty')}>
        <motion.span 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ 
            duration: 1, 
            repeat: Infinity, 
            repeatDelay: Math.random() * 3 + 1, // Random delay between pulses
            ease: "easeInOut"
          }}
          className="font-bold text-slate-200 bg-slate-700/50 px-1.5 py-0.5 rounded"
        >
          {mold.qty}
        </motion.span>
      </div>

      <div className="h-3 w-px bg-slate-600"></div>

      <div className="flex items-center gap-1 font-mono text-[10px]" title={mold.updatedAt ? new Date(mold.updatedAt).toLocaleString('vi-VN') : ''}>
        <Clock className="w-3 h-3 text-amber-400/80" />
        <span className="text-amber-200/90 font-bold whitespace-nowrap">{duration}</span>
      </div>
    </div>
  );
}
