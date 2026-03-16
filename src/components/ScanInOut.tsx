import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Camera, Minus, Plus, Cpu, Package, Tag, Loader2, CheckCircle2, AlertCircle, StopCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabaseClient';
import { Html5Qrcode } from 'html5-qrcode';

export function ScanInOut() {
  const { t } = useLanguage();
  const [scanType, setScanType] = useState<'IN' | 'OUT'>('IN');
  const [qty, setQty] = useState(1);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  const [machines, setMachines] = useState<{id: string, name: string}[]>([]);
  const [molds, setMolds] = useState<{id: string, size: string}[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [selectedMoldId, setSelectedMoldId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    fetchMeta();
    return () => {
      stopScanner();
    };
  }, []);

  const fetchMeta = async () => {
    const { data: mData } = await supabase.from('machines').select('id, name').order('id');
    const { data: moData } = await supabase.from('mold_master').select('id, size').order('id');
    if (mData) setMachines(mData);
    if (moData) setMolds(moData);
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Failed to stop scanner', err);
      }
    }
  };

  const startScanner = async () => {
    try {
      setValidationError(null);
      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;

      // Tối ưu cho công nghiệp: Quét nhanh (20fps), khung quét rộng 80% màn hình
      const config = { 
        fps: 20, 
        qrbox: (viewWidth: number, viewHeight: number) => {
          let size = Math.min(viewWidth, viewHeight) * 0.8;
          return { width: size, height: size };
        },
        aspectRatio: 1.0
      };

      await html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        (decodedText) => {
          handleScannedResult(decodedText);
          // Rung mạnh hơn để công nhân biết đã nhận mã
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        },
        () => {} 
      );
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Error starting camera", err);
      setValidationError("Không thể mở Camera. Vui lòng cấp quyền hoặc kiểm tra kết nối HTTPS.");
      setIsCameraActive(false);
    }
  };

  const handleScannedResult = (decodedText: string) => {
    const code = decodedText.trim().toUpperCase();
    
    // 1. Kiểm tra nếu chưa có Máy mà lại quét nhầm Khuôn
    if (!selectedMachineId) {
      if (!code.startsWith('M')) {
        setValidationError(t('scanMachineFirst'));
        return;
      }
      // Nếu đúng là mã máy (bắt đầu bằng M)
      // Kiểm tra xem máy có tồn tại trong hệ thống không
      const machineExists = machines.some(m => m.id === code);
      if (machineExists) {
        setSelectedMachineId(code);
        setValidationError(null);
      } else {
        setValidationError(`Máy ${code} không tồn tại trong hệ thống!`);
      }
    } else {
      // 2. Đã có máy, giờ quét Khuôn
      if (code.startsWith('M')) {
        // Nếu quét lại mã máy khác thì cập nhật máy
        const machineExists = machines.some(m => m.id === code);
        if (machineExists) {
          setSelectedMachineId(code);
          setSelectedMoldId('');
          setValidationError(null);
        }
      } else {
        // Quét khuôn
        const moldExists = molds.some(m => m.id === code);
        if (moldExists) {
          setSelectedMoldId(code);
          setValidationError(null);
        } else {
          setValidationError(`Khuôn ${code} không tồn tại trong danh mục!`);
        }
      }
    }
  };

  const selectedMold = molds.find(m => m.id === selectedMoldId);

  const handleSubmit = async () => {
    if (!selectedMachineId) {
      setValidationError(t('scanMachineFirst'));
      return;
    }
    if (!selectedMoldId) {
      alert(t('selectMold'));
      return;
    }

    try {
      setIsSubmitting(true);

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
      
      {/* Scanner Viewport */}
      <div className="relative w-full aspect-video sm:aspect-square bg-black rounded-3xl overflow-hidden border-4 border-slate-700/50 shadow-2xl flex items-center justify-center">
        
        {/* HTML5 QR Code Container */}
        <div id="reader" className="w-full h-full object-cover"></div>

        {!isCameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-400 gap-4 z-10">
            <Camera className="w-16 h-16 opacity-30" />
            <button 
              onClick={startScanner}
              className="bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-2 rounded-xl font-bold shadow-lg transition-transform active:scale-95"
            >
              Mở Camera Quét
            </button>
          </div>
        )}

        {/* Laser Animation Overlay */}
        {isCameraActive && (
          <>
            <motion.div 
               animate={{ y: ['0%', '98%', '0%'] }}
               transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
               className="absolute left-0 right-0 h-1 bg-green-500 shadow-[0_0_20px_rgba(34,197,94,1)] z-10 pointer-events-none"
               style={{ top: '0%' }}
            />
            <button 
              onClick={async () => {
                await stopScanner();
                setIsCameraActive(false);
              }}
              className="absolute top-4 right-4 z-20 bg-slate-900/50 p-2 rounded-full text-white hover:bg-rose-500 transition-colors"
            >
              <StopCircle className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Validation Overlay */}
        <AnimatePresence>
          {validationError && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-6 left-6 right-6 bg-rose-500 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 z-30 border border-rose-400"
            >
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <p className="text-sm font-bold leading-tight">{validationError}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scanned Data Inputs */}
      <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 shadow-lg space-y-4">
        {/* Machine Selection */}
        <div className={`flex items-center gap-4 transition-all duration-300 ${!selectedMachineId ? 'ring-2 ring-indigo-500/50 p-1 rounded-xl bg-indigo-500/5' : ''}`}>
          <div className={`p-3 rounded-xl border transition-colors ${selectedMachineId ? 'bg-indigo-500/20 border-indigo-500/10' : 'bg-slate-700/50 border-slate-600'}`}>
            <Cpu className={`w-6 h-6 ${selectedMachineId ? 'text-indigo-400' : 'text-slate-500'}`} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{t('selectedMachine')}</p>
            <select 
              value={selectedMachineId}
              onChange={(e) => {
                const val = e.target.value;
                if (val && !val.startsWith('M')) {
                  setValidationError(t('invalidMachineCode'));
                  return;
                }
                setSelectedMachineId(val);
                setValidationError(null);
              }}
              className={`w-full bg-slate-900/50 border rounded-xl px-4 py-2 text-white font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none cursor-pointer transition-all ${!selectedMachineId ? 'border-indigo-500/50 animate-pulse' : 'border-slate-600'}`}
            >
              <option value="">-- {t('selectMachine')} --</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.id} | {m.name}</option>)}
            </select>
          </div>
        </div>

        <div className="h-px w-full bg-slate-700/50"></div>

        {/* Mold Selection - Disabled if no machine */}
        <div className={`flex items-center gap-4 transition-opacity duration-300 ${!selectedMachineId ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
          <div className="bg-emerald-500/20 p-3 rounded-xl border border-emerald-500/10 flex-shrink-0">
            <Package className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{t('scannedMold')}</p>
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
      <div className={`space-y-4 transition-opacity ${!selectedMachineId || !selectedMoldId ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
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
        disabled={isSubmitting || showSuccess || !selectedMachineId || !selectedMoldId}
        className={`w-full relative mt-auto py-6 rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 overflow-hidden ${
          showSuccess 
            ? 'bg-emerald-500 text-white' 
            : !selectedMachineId || !selectedMoldId
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-600'
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

      <style dangerouslySetInnerHTML={{ __html: `
        #reader video {
          object-fit: cover !important;
          border-radius: 1.5rem;
        }
        #reader {
          border: none !important;
        }
      `}} />

    </div>
  );
}
