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
      let query = supabase.from('running_molds').update({ status_note: status });
      
      if (mold.uuid) {
        query = query.eq('uuid', mold.uuid);
      } else {
        query = query.match({ 
          machine_id: machineId, 
          mold_id: mold.id, 
          mold_size: mold.size 
        });
      }

      const { error } = await query;

      if (error) throw error;
      if (onStatusUpdate) onStatusUpdate();
      setShowStatusMenu(false);
    } catch (err: any) {
      console.error('Failed to update status:', err);
      alert('Lỗi cập nhật trạng thái: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setIsUpdating(false);
    }
  };

  const hasStatus = !!mold.statusNote;

  return (
    <div className="relative">
      <div 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowStatusMenu(true);
        }}
        className={`inline-flex items-center gap-2 bg-slate-800 border rounded-md px-3 py-1.5 shadow-sm hover:bg-slate-700 transition-all cursor-pointer select-none
          ${mold.statusNote === 'material_out' ? 'animate-pulse-mold border-rose-500/50' : 
            mold.statusNote === 'broken_mold' ? 'animate-pulse-mold-yellow border-amber-500/50' : 
            'border-slate-700'}`}
      >
        <div className="flex items-center gap-1.5 text-slate-300">
          <Package className={`w-3.5 h-3.5 ${
            mold.statusNote === 'material_out' ? 'text-rose-400' : 
            mold.statusNote === 'broken_mold' ? 'text-amber-400' : 
            'text-indigo-400'}`} />
          <span className={`text-xs font-semibold ${
            mold.statusNote === 'material_out' ? 'text-rose-200' : 
            mold.statusNote === 'broken_mold' ? 'text-amber-200' : 
            ''}`}>{mold.name}</span>
        </div>
        
        <div className="h-3 w-px bg-slate-600"></div>
        
        <span className="text-xs text-slate-400 font-medium w-6 text-center">{mold.size}</span>
        
        <div className="h-3 w-px bg-slate-600"></div>
        
        <div className="flex items-center gap-1 font-mono text-xs">
          <motion.span 
            animate={hasStatus ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
            className={`font-bold px-1.5 py-0.5 rounded ${
              mold.statusNote === 'material_out' ? 'bg-rose-500/30 text-rose-200' : 
              mold.statusNote === 'broken_mold' ? 'bg-amber-500/30 text-amber-200' : 
              'bg-slate-700/50 text-slate-200'
            }`}
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
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => { e.stopPropagation(); setShowStatusMenu(false); }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[320px] bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden p-3"
            >
              <div className="flex flex-col items-center p-4 mb-4 border-b border-slate-800 text-center">
                <div className="bg-indigo-500/10 p-3 rounded-2xl mb-3">
                  <Package className="w-6 h-6 text-indigo-400" />
                </div>
                <h4 className="text-base font-black text-white">{mold.name}</h4>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1.5">
                  Size: {mold.size} | Máy: {machineId}
                </p>
                <button 
                  onClick={() => setShowStatusMenu(false)} 
                  className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-full transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <button
                  disabled={isUpdating}
                  onClick={(e) => { e.stopPropagation(); updateStatus('material_out'); }}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-black transition-all text-left
                    ${mold.statusNote === 'material_out' 
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' 
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'}`}
                >
                  <div className={`p-2 rounded-lg ${mold.statusNote === 'material_out' ? 'bg-white/20' : 'bg-rose-500/10'}`}>
                    <AlertTriangle className={`w-5 h-5 ${mold.statusNote === 'material_out' ? 'text-white' : 'text-rose-500'}`} />
                  </div>
                  Hết liệu
                </button>

                <button
                  disabled={isUpdating}
                  onClick={(e) => { e.stopPropagation(); updateStatus('broken_mold'); }}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-black transition-all text-left
                    ${mold.statusNote === 'broken_mold' 
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' 
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'}`}
                >
                  <div className={`p-2 rounded-lg ${mold.statusNote === 'broken_mold' ? 'bg-white/20' : 'bg-amber-500/10'}`}>
                    <Hammer className={`w-5 h-5 ${mold.statusNote === 'broken_mold' ? 'text-white' : 'text-amber-500'}`} />
                  </div>
                  Khuôn hư
                </button>

                {hasStatus && (
                  <button
                    disabled={isUpdating}
                    onClick={(e) => { e.stopPropagation(); updateStatus(null); }}
                    className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-sm font-black text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10 transition-all mt-4"
                  >
                    <div className="p-2 rounded-lg bg-emerald-500/20">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    </div>
                    Xóa ghi chú (Đã xử lý xong)
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
