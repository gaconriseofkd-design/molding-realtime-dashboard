import { Package, Clock, AlertTriangle, Hammer, CheckCircle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Mold } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabaseClient';

interface MoldChipProps {
  mold: Mold;
  machineId: string;
  onStatusUpdate?: () => void;
}

export function MoldChip({ mold, machineId, onStatusUpdate }: MoldChipProps) {
  const [duration, setDuration] = useState<string>('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

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

      if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
      if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
      return `${diffMins}m`;
    };

    setDuration(calculateDuration());
    const timer = setInterval(() => {
      setDuration(calculateDuration());
    }, 60000);

    return () => clearInterval(timer);
  }, [mold.updatedAt]);

  const updateStatus = async (status: 'material_out' | 'broken_mold' | null) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('running_molds')
        .update({ status_note: status })
        .match({ machine_id: machineId, mold_id: mold.id, mold_size: mold.size });

      if (error) throw error;
      if (onStatusUpdate) onStatusUpdate();
      setShowStatusMenu(false);
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Lỗi cập nhật trạng thái');
    } finally {
      setIsUpdating(false);
    }
  };

  const hasStatus = !!mold.statusNote;

  return (
    <div className="relative">
      <div 
        onClick={(e) => {
          e.stopPropagation();
          setShowStatusMenu(!showStatusMenu);
        }}
        className={`inline-flex items-center gap-2 bg-slate-800 border rounded-md px-3 py-1.5 shadow-sm hover:bg-slate-700 transition-all cursor-pointer select-none
          ${hasStatus ? 'animate-pulse-mold border-rose-500/50' : 'border-slate-700'}`}
      >
        <div className="flex items-center gap-1.5 text-slate-300">
          <Package className={`w-3.5 h-3.5 ${hasStatus ? 'text-rose-400' : 'text-indigo-400'}`} />
          <span className={`text-xs font-semibold ${hasStatus ? 'text-rose-200' : ''}`}>{mold.name}</span>
        </div>
        
        <div className="h-3 w-px bg-slate-600"></div>
        
        <span className="text-xs text-slate-400 font-medium w-6 text-center">{mold.size}</span>
        
        <div className="h-3 w-px bg-slate-600"></div>
        
        <div className="flex items-center gap-1 font-mono text-xs">
          <motion.span 
            animate={hasStatus ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
            className={`font-bold px-1.5 py-0.5 rounded ${hasStatus ? 'bg-rose-500/30 text-rose-200' : 'bg-slate-700/50 text-slate-200'}`}
          >
            {mold.qty}
          </motion.span>
        </div>

        {hasStatus && (
          <>
            <div className="h-3 w-px bg-slate-600"></div>
            <div className="flex items-center gap-1">
              {mold.statusNote === 'material_out' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              ) : (
                <Hammer className="w-3.5 h-3.5 text-amber-500" />
              )}
            </div>
          </>
        )}

        <div className="h-3 w-px bg-slate-600"></div>

        <div className="flex items-center gap-1 font-mono text-[10px]">
          <Clock className="w-3 h-3 text-amber-400/80" />
          <span className="text-amber-200/90 font-bold whitespace-nowrap">{duration}</span>
        </div>
      </div>

      <AnimatePresence>
        {showStatusMenu && (
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setShowStatusMenu(false)}></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute bottom-full left-0 mb-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[101] overflow-hidden p-1"
            >
              <div className="flex items-center justify-between p-2 mb-1 border-b border-slate-800">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Trạng thái khuôn</span>
                <button onClick={() => setShowStatusMenu(false)} className="text-slate-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
              </div>
              <button
                disabled={isUpdating}
                onClick={(e) => { e.stopPropagation(); updateStatus('material_out'); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all text-left
                  ${mold.statusNote === 'material_out' ? 'bg-rose-500/20 text-rose-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <AlertTriangle className="w-4 h-4" />
                Hết liệu
              </button>
              <button
                disabled={isUpdating}
                onClick={(e) => { e.stopPropagation(); updateStatus('broken_mold'); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all text-left
                  ${mold.statusNote === 'broken_mold' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <Hammer className="w-4 h-4" />
                Khuôn hư
              </button>
              {hasStatus && (
                <button
                  disabled={isUpdating}
                  onClick={(e) => { e.stopPropagation(); updateStatus(null); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 transition-all border-t border-slate-800 mt-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  Xóa ghi chú (OK)
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
