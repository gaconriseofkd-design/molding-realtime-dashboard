import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Camera, Minus, Plus, Cpu, Package, Tag, Loader2, CheckCircle2, AlertCircle, StopCircle, RefreshCw, Search, Power } from 'lucide-react';
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
  
  const [moldSearchTerm, setMoldSearchTerm] = useState('');
  const [isSearchingMold, setIsSearchingMold] = useState(false);
  const [recentMolds, setRecentMolds] = useState<string[]>([]);
  
  // Refs to allow camera callback to access latest state without stale closures
  const selectedMachineRef = useRef('');
  const selectedMoldRef = useRef('');

  useEffect(() => {
    selectedMachineRef.current = selectedMachineId;
  }, [selectedMachineId]);

  useEffect(() => {
    selectedMoldRef.current = selectedMoldId;
  }, [selectedMoldId]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    fetchMeta();
    const savedRecents = localStorage.getItem('recent_molds');
    if (savedRecents) setRecentMolds(JSON.parse(savedRecents));

    // Khởi tạo camera lần đầu
    const timeoutId = setTimeout(() => {
      startScanner();
    }, 500); // Đợi DOM ổn định một chút

    return () => {
      clearTimeout(timeoutId);
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
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
        scannerRef.current = null;
        setIsCameraActive(false);
      } catch (err) {
        console.error('Failed to stop scanner', err);
      }
    }
  };

  const startScanner = async () => {
    if (scannerRef.current?.isScanning) return; // Tránh bật chồng máy ảnh

    try {
      setValidationError(null);
      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;

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
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        },
        () => {} 
      );
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Error starting camera", err);
      // Nếu lỗi là do element chưa sẵn sàng, thử lại sau 1s
      if (err.includes?.("reader")) {
         setTimeout(startScanner, 1000);
      } else {
        setValidationError("Không thể mở Camera. Vui lòng cấp quyền hoặc kiểm tra kết nối HTTPS.");
      }
      setIsCameraActive(false);
    }
  };

  const handleToggleCamera = async () => {
    if (isCameraActive) {
      await stopScanner();
      setIsCameraActive(false);
    } else {
      await startScanner();
    }
  };

  const handleScannedResult = (decodedText: string) => {
    const code = decodedText.trim().toUpperCase();
    const currentMachine = selectedMachineRef.current;

    if (!currentMachine) {
      if (!code.startsWith('M')) {
        setValidationError(t('scanMachineFirst'));
        return;
      }
      const machineExists = machines.some(m => m.id === code);
      if (machineExists) {
        setSelectedMachineId(code);
        setValidationError(null);
      } else {
        setValidationError(`Máy ${code} không tồn tại!`);
      }
    } else {
      if (code.startsWith('M')) {
        const machineExists = machines.some(m => m.id === code);
        if (machineExists) {
          setSelectedMachineId(code);
          setSelectedMoldId('');
          setValidationError(null);
        }
      } else {
        const moldExists = molds.some(m => m.id === code);
        if (moldExists) {
          setSelectedMoldId(code);
          setValidationError(null);
          // Add to recent
          updateRecentMolds(code);
        } else {
          setValidationError(`Khuôn ${code} không tồn tại!`);
        }
      }
    }
  };

  const updateRecentMolds = (moldId: string) => {
    setRecentMolds(prev => {
      const filtered = prev.filter(m => m !== moldId);
      const updated = [moldId, ...filtered].slice(0, 5);
      localStorage.setItem('recent_molds', JSON.stringify(updated));
      return updated;
    });
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

  const filteredMolds = molds.filter(m => 
    m.id.toLowerCase().includes(moldSearchTerm.toLowerCase())
  ).slice(0, 50);

  return (
    <div className="max-w-md mx-auto h-full flex flex-col space-y-6 animate-in fade-in duration-500 pb-20 sm:pb-0">
      
      {/* Scanner Viewport */}
      <div className="relative w-full aspect-video sm:aspect-square bg-black rounded-3xl overflow-hidden border-4 border-slate-700/50 shadow-2xl flex items-center justify-center">
        
        {/* HTML5 QR Code Container */}
        <div id="reader" className="w-full h-full object-cover"></div>

        {!isCameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-400 gap-4 z-10">
            <Camera className="w-16 h-16 opacity-30" />
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">Camera Off</p>
              <button 
                onClick={handleToggleCamera}
                className="bg-indigo-500 hover:bg-indigo-400 text-white px-8 py-3 rounded-2xl font-black shadow-lg transition-all active:scale-95 flex items-center gap-2"
              >
                <Power className="w-5 h-5" />
                BẬT CAMERA
              </button>
            </div>
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
              onClick={handleToggleCamera}
              className="absolute top-4 right-4 z-20 bg-rose-500/20 hover:bg-rose-500 backdrop-blur-md p-3 rounded-2xl text-rose-400 hover:text-white transition-all shadow-lg border border-rose-500/20 group"
              title="Tắt Camera"
            >
              <StopCircle className="w-6 h-6 group-active:scale-90 transition-transform" />
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
          <div className="flex-1 text-left relative">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{t('selectedMachine')}</p>
            <div className="flex gap-2">
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
                className={`flex-1 bg-slate-900/50 border rounded-xl px-4 py-2 text-white font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none cursor-pointer transition-all ${!selectedMachineId ? 'border-indigo-500/50 animate-pulse' : 'border-slate-600'}`}
              >
                <option value="">-- {t('selectMachine')} --</option>
                {machines.map(m => <option key={m.id} value={m.id}>{m.id} | {m.name}</option>)}
              </select>
              {selectedMachineId && (
                <button 
                  onClick={() => { setSelectedMachineId(''); setSelectedMoldId(''); }}
                  className="p-2 bg-slate-700/50 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-600 transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-slate-700/50"></div>

        {/* Mold Selection - Enhanced with Search and Recents */}
        <div className={`flex flex-col gap-3 transition-opacity duration-300 ${!selectedMachineId ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'}`}>
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500/20 p-3 rounded-xl border border-emerald-500/10 flex-shrink-0">
              <Package className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{t('scannedMold')}</p>
              
              <div className="relative">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text"
                      value={selectedMoldId || moldSearchTerm}
                      placeholder={t('searchMold')}
                      onFocus={() => setIsSearchingMold(true)}
                      onChange={(e) => {
                        setMoldSearchTerm(e.target.value);
                        setSelectedMoldId('');
                        setIsSearchingMold(true);
                      }}
                      className="w-full bg-slate-900/50 border border-slate-600 rounded-xl pl-10 pr-4 py-2 text-white font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                    />
                  </div>
                  {selectedMoldId && (
                    <button 
                      onClick={() => { setSelectedMoldId(''); setMoldSearchTerm(''); }}
                      className="p-2 bg-slate-700/50 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-600 transition-colors shadow-sm"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                  )}
                  {selectedMold && (
                    <div className="flex-shrink-0 flex items-center gap-1.5 bg-indigo-500/20 px-3 py-2 rounded-xl border border-indigo-500/20 whitespace-nowrap">
                      <Tag className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-black text-indigo-300 uppercase">{selectedMold.size}</span>
                    </div>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                <AnimatePresence>
                  {isSearchingMold && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsSearchingMold(false)}></div>
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-60 overflow-y-auto z-50 scrollbar-hide"
                      >
                        {filteredMolds.length > 0 ? (
                          filteredMolds.map(m => (
                            <button
                              key={m.id}
                              onClick={() => {
                                setSelectedMoldId(m.id);
                                setIsSearchingMold(false);
                                setMoldSearchTerm('');
                                updateRecentMolds(m.id);
                              }}
                              className="w-full text-left px-5 py-3 hover:bg-indigo-500/20 text-slate-300 font-bold border-b border-slate-800/50 flex items-center justify-between group transition-colors"
                            >
                              <span>{m.id}</span>
                              <span className="text-xs bg-slate-800 group-hover:bg-indigo-500/40 px-2 py-0.5 rounded text-slate-500 group-hover:text-indigo-200 uppercase">{m.size}</span>
                            </button>
                          ))
                        ) : (
                          <div className="px-5 py-4 text-slate-500 text-center italic">Không tìm thấy mã khuôn này</div>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Recent Molds Chips */}
          {recentMolds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pl-14">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{t('recentMolds')}:</span>
              {recentMolds.map(rid => (
                <button
                  key={rid}
                  onClick={() => {
                    setSelectedMoldId(rid);
                    setMoldSearchTerm('');
                    updateRecentMolds(rid);
                  }}
                  className={`px-3 py-1 rounded-full text-[10px] font-black transition-all border ${
                    selectedMoldId === rid 
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20' 
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {rid}
                </button>
              ))}
            </div>
          )}
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
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />

    </div>
  );
}
