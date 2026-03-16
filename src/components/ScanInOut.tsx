import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Camera, Minus, Plus, Cpu, Package, ScanLine, Tag, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabaseClient';

export function ScanInOut() {
  const { t } = useLanguage();
  const [scanType, setScanType] = useState<'IN' | 'OUT'>('IN');
  const [qty, setQty] = useState(1);
  const [scanning, setScanning] = useState(true);
  
  const [machines, setMachines] = useState<{id: string, name: string}[]>([]);
  const [molds, setMolds] = useState<{id: string, size: string}[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [selectedMoldId, setSelectedMoldId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchMeta();
    
    // Simulate scanner animation
    const timer = setInterval(() => {
      setScanning(prev => !prev);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const fetchMeta = async () => {
    const { data: mData } = await supabase.from('machines').select('id, name').order('id');
    const { data: moData } = await supabase.from('mold_master').select('id, size').order('id');
    if (mData) setMachines(mData);
    if (moData) setMolds(moData);
  };

  const selectedMold = molds.find(m => m.id === selectedMoldId);

  const handleSubmit = async () => {
    if (!selectedMachineId || !selectedMoldId) {
      alert('Vui lòng chọn Máy và Khuôn');
      return;
    }

    try {
      setIsSubmitting(true);

      // Get current quantity on machine
      const { data: existing } = await supabase
        .from('running_molds')
        .select('uuid, quantity')
        .match({ machine_id: selectedMachineId, mold_id: selectedMoldId, mold_size: selectedMold?.size })
        .single();

      if (scanType === 'IN') {
        const newQty = (existing?.quantity || 0) + qty;
        const { error } = await supabase
          .from('running_molds')
          .upsert({
            machine_id: selectedMachineId,
            mold_id: selectedMoldId,
            mold_size: selectedMold?.size,
            quantity: newQty
          }, { onConflict: 'machine_id, mold_id, mold_size' });

        if (error) throw error;
      } else {
        // OUT
        if (!existing) {
          alert('Khuôn này không có trên máy!');
          return;
        }
        const newQty = existing.quantity - qty;
        if (newQty <= 0) {
          const { error } = await supabase
            .from('running_molds')
            .delete()
            .eq('uuid', existing.uuid);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('running_molds')
            .update({ quantity: newQty })
            .eq('uuid', existing.uuid);
          if (error) throw error;
        }
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      setQty(1);
    } catch (error: any) {
      console.error(error);
      alert(t('scanError') + ': ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto h-full flex flex-col space-y-6 animate-in fade-in duration-500 pb-20 sm:pb-0">
      
      {/* Scanner Viewport Placeholder */}
      <div className="relative w-full aspect-video sm:aspect-square bg-slate-800 rounded-3xl overflow-hidden border-4 border-slate-700/50 shadow-2xl flex items-center justify-center">
        {scanning ? (
          <div className="absolute inset-0 bg-black">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxyZWN0IHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0ibm9uZSIvPgo8Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz4KPC9zdmc+')] opacity-50"></div>
            
            <motion.div 
              animate={{ y: ['0%', '100%', '0%'] }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="absolute left-0 right-0 h-1 bg-green-500 shadow-[0_0_20px_rgba(34,197,94,1)] z-10"
              style={{ top: '0%' }}
            />
            
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-4">
              <ScanLine className="w-16 h-16 opacity-50" />
              <p className="font-medium animate-pulse">{t('barcodeScannerPlaceholder')}</p>
            </div>

            {/* Corner Markers */}
            <div className="absolute top-8 left-8 w-12 h-12 border-t-4 border-l-4 border-slate-500 rounded-tl-xl"></div>
            <div className="absolute top-8 right-8 w-12 h-12 border-t-4 border-r-4 border-slate-500 rounded-tr-xl"></div>
            <div className="absolute bottom-8 left-8 w-12 h-12 border-b-4 border-l-4 border-slate-500 rounded-bl-xl"></div>
            <div className="absolute bottom-8 right-8 w-12 h-12 border-b-4 border-r-4 border-slate-500 rounded-br-xl"></div>
          </div>
        ) : (
          <div className="text-center text-slate-500">
            <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Camera Disabled</p>
          </div>
        )}
      </div>

      {/* Scanned Data Inputs */}
      <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 shadow-lg space-y-4">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-500/10">
            <Cpu className="w-6 h-6 text-indigo-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('selectedMachine')}</p>
            <select 
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-2 text-white font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="">-- {t('selectMachine')} --</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.id} | {m.name}</option>)}
            </select>
          </div>
        </div>

        <div className="h-px w-full bg-slate-700/50"></div>

        <div className="flex items-center gap-4">
          <div className="bg-emerald-500/20 p-3 rounded-xl border border-emerald-500/10 flex-shrink-0">
            <Package className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('scannedMold')}</p>
            <div className="flex items-center gap-2">
              <select 
                value={selectedMoldId}
                onChange={(e) => setSelectedMoldId(e.target.value)}
                className="flex-1 bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-2 text-white font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="">-- {t('selectMold')} --</option>
                {molds.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
              </select>
              {selectedMold && (
                <div className="flex items-center gap-1.5 bg-indigo-500/20 px-3 py-2 rounded-xl border border-indigo-500/20 whitespace-nowrap">
                  <Tag className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-black text-indigo-300 uppercase">{selectedMold.size}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scan Actions & Quantity */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setScanType('IN')}
            className={`py-4 rounded-2xl font-black text-lg transition-all active:scale-95 ${
              scanType === 'IN' 
                ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900' 
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {t('scanIn')}
          </button>
          
          <button
            onClick={() => setScanType('OUT')}
            className={`py-4 rounded-2xl font-black text-lg transition-all active:scale-95 ${
              scanType === 'OUT' 
                ? 'bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)] ring-2 ring-rose-400 ring-offset-2 ring-offset-slate-900' 
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {t('scanOut')}
          </button>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 flex items-center justify-between shadow-inner">
          <span className="text-slate-400 font-bold uppercase tracking-wider">{t('quantity')}</span>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="w-14 h-14 bg-slate-700 rounded-2xl flex items-center justify-center hover:bg-slate-600 active:scale-90 transition-all shadow-md group"
            >
              <Minus className="w-6 h-6 text-white group-active:scale-125 transition-transform" />
            </button>
            <span className="text-4xl font-black min-w-[3ch] text-center text-white tabular-nums">{qty}</span>
            <button 
              onClick={() => setQty(qty + 1)}
              className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center hover:bg-indigo-400 active:scale-90 transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)] group"
            >
              <Plus className="w-6 h-6 text-white group-active:scale-125 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      <button 
        onClick={handleSubmit}
        disabled={isSubmitting || showSuccess}
        className={`w-full relative mt-auto py-6 rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 overflow-hidden ${
          showSuccess 
            ? 'bg-emerald-500 text-white' 
            : 'bg-slate-100 hover:bg-white text-slate-900'
        }`}
      >
        <AnimatePresence mode="wait">
          {isSubmitting ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Loader2 className="w-6 h-6 animate-spin" />
            </motion.div>
          ) : showSuccess ? (
            <motion.div key="success" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6" />
              <span>{t('scanSuccess')}</span>
            </motion.div>
          ) : (
            <motion.span key="label" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {t('confirmSubmit')}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

    </div>
  );
}
