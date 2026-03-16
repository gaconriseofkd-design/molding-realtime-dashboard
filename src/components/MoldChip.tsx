import { Package } from 'lucide-react';
import type { Mold } from '../types';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';

interface MoldChipProps {
  mold: Mold;
}

export function MoldChip({ mold }: MoldChipProps) {
  const { t } = useLanguage();
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
      
      <div className="flex items-center gap-1 font-mono text-xs">
        <span className="text-slate-500">{t('qty')}:</span>
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
    </div>
  );
}
