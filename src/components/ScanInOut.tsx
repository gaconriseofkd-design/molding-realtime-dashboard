import { useState, useEffect, useRef, useMemo } from 'react';
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
  
  const [machines, setMachines] = useState<{id: string, name: string, max_molds: number, operational_status: string}[]>([]);
  const [molds, setMolds] = useState<{id: string, size: string}[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [selectedMoldId, setSelectedMoldId] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  
  const [moldSearchTerm, setMoldSearchTerm] = useState('');
  const [isSearchingMold, setIsSearchingMold] = useState(false);
  const [recentMolds, setRecentMolds] = useState<string[]>([]);
  const [machineCapacity, setMachineCapacity] = useState<{current: number, max: number} | null>(null);
  
  // Refs to allow camera callback to access latest state without stale closures
  const selectedMachineRef = useRef('');
  const selectedMoldRef = useRef('');
  const machinesRef = useRef<{id: string, name: string, max_molds: number, operational_status: string}[]>([]);
  const moldsRef = useRef<{id: string, size: string}[]>([]);

  useEffect(() => {
    selectedMachineRef.current = selectedMachineId;
    if (selectedMachineId) {
      fetchMachineCapacity(selectedMachineId);
    } else {
      setMachineCapacity(null);
    }
  }, [selectedMachineId]);

  useEffect(() => {
    selectedMoldRef.current = selectedMoldId;
  }, [selectedMoldId]);

  useEffect(() => {
    machinesRef.current = machines;
  }, [machines]);

  useEffect(() => {
    moldsRef.current = molds;
  }, [molds]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    fetchMeta();
    const savedRecents = localStorage.getItem('recent_molds');
    if (savedRecents) setRecentMolds(JSON.parse(savedRecents));

    return () => {
      stopScanner();
    };
  }, []);

  const fetchMeta = async () => {
    const { data: mData } = await supabase.from('machines').select('id, name, max_molds, operational_status').order('id');
    const { data: moData } = await supabase.from('mold_master').select('id, size').order('id');
    if (mData) {
      setMachines(mData);
      machinesRef.current = mData;
    }
    if (moData) {
      setMolds(moData);
      moldsRef.current = moData;
    }
  };

  const fetchMachineCapacity = async (machineId: string) => {
    if (!machineId) {
      setMachineCapacity(null);
      return;
    }
    const { data: machine } = await supabase.from('machines').select('max_molds').eq('id', machineId).single();
    const { data: running } = await supabase.from('running_molds').select('quantity').eq('machine_id', machineId);
    
    const current = running?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
    const max = machine?.max_molds || 12;
    setMachineCapacity({ current, max });
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
        setValidationError(t('errCameraOpen'));
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
    
    // Sử dụng Ref để lấy giá trị thực tế ngay lúc này
    const currentMachine = selectedMachineRef.current;
    const allMachines = machinesRef.current;
    const allMolds = moldsRef.current;

    if (!currentMachine) {
      if (!code.startsWith('M')) {
        setValidationError(t('scanMachineFirst'));
        return;
      }
      const machineExists = allMachines.some(m => m.id === code);
      if (machineExists) {
        setSelectedMachineId(code);
        setValidationError(null);
      } else {
        setValidationError(`${t('machine')} ${code} ${t('errMachineNotFound')}`);
      }
    } else {
      if (code.startsWith('M')) {
        const machineExists = allMachines.some(m => m.id === code);
        if (machineExists) {
          setSelectedMachineId(code);
          setSelectedMoldId('');
          setValidationError(null);
        }
      } else {
        const matchingMolds = allMolds.filter(m => m.id === code);
        if (matchingMolds.length > 0) {
          setSelectedMoldId(code);
          setValidationError(null);
          updateRecentMolds(code);
          
          if (matchingMolds.length === 1) {
            setSelectedSize(matchingMolds[0].size);
          } else {
            setSelectedSize(''); // Force size selection
          }
        } else {
          setValidationError(`${t('molds')} ${code} ${t('errMoldNotFound')}`);
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

  const availableSizes = useMemo(() => {
    return molds.filter(m => m.id === selectedMoldId).map(m => m.size);
  }, [molds, selectedMoldId]);

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
      const scanQty = Number(qty);

      // 1. Fetch fresh machine info and all currently running molds for this machine 
      // directly from Supabase to ensure we have the most recent data.
      const machineRes = await supabase.from('machines').select('max_molds, operational_status, name').eq('id', selectedMachineId).single();
      const runningRes = await supabase.from('running_molds').select('mold_id, mold_size, quantity, uuid').eq('machine_id', selectedMachineId);

      const moldMasterRes = await supabase
        .from('mold_master')
        .select('total_owned')
        .eq('id', selectedMoldId)
        .eq('size', selectedSize)
        .single();

      const allRunningForMoldRes = await supabase
        .from('running_molds')
        .select('quantity')
        .eq('mold_id', selectedMoldId)
        .eq('mold_size', selectedSize);

      if (machineRes.error) throw machineRes.error;
      if (runningRes.error) throw runningRes.error;

      const machineDetail = machineRes.data;
      const currentRunning = runningRes.data || [];

      // Determine Capacity (use actual DB value or the default logic if DB is null)
      const dbMax = machineDetail?.max_molds;
      const fallbackMax = (() => {
        const num = parseInt(selectedMachineId.replace(/\D/g, ''));
        if (num >= 33 && num <= 40) return 24;
        if (num >= 45 && num <= 50) return 32;
        return 12;
      })();
      const maxMolds = dbMax || fallbackMax;

      const opStatus = machineDetail?.operational_status || 'active';
      const currentTotal = currentRunning.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const existing = currentRunning.find(m => m.mold_id === selectedMoldId && m.mold_size === selectedSize);

      // RULE 1: Machine must be ACTIVE
      if (opStatus !== 'active') {
        const statusLabel = opStatus === 'stop' ? t('opStop') : t('opPause');
        alert(`${t('machine')} ${selectedMachineId} (${statusLabel}) - ${t('errMachineInactive')}`);
        setIsSubmitting(false);
        return;
      }

      if (scanType === 'IN') {
        // RULE 2: Cannot exceed capacity
        const newProposedTotal = currentTotal + scanQty;
        if (newProposedTotal > maxMolds) {
          alert(`${t('errCapacityExceeded').replace('{max}', maxMolds.toString())}\n(${t('total').toUpperCase()}: ${currentTotal} + ${scanQty} = ${newProposedTotal})`);
          setIsSubmitting(false);
          return;
        }

        // RULE 3: Cannot exceed overall total_owned across all machines
        // Only run this check if the mold exists in mold_master
        if (moldMasterRes.data) {
          const totalOwned = moldMasterRes.data.total_owned || 0;
          const totalCurrentlyRunning = (allRunningForMoldRes.data || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
          
          if (totalCurrentlyRunning + scanQty > totalOwned) {
            const warningMsg = t('errMoldQtyExceeded')
              .replace('{mold}', selectedMoldId)
              .replace('{size}', selectedSize)
              .replace('{owned}', totalOwned.toString())
              .replace('{running}', totalCurrentlyRunning.toString())
              .replace('{scanQty}', scanQty.toString());
              
            alert(warningMsg);
            setIsSubmitting(false);
            return;
          }
        }

        const newQty = (existing?.quantity || 0) + scanQty;
        const { error } = await supabase
          .from('running_molds')
          .upsert({
            machine_id: selectedMachineId,
            mold_id: selectedMoldId,
            mold_size: selectedSize,
            quantity: newQty,
            scanned_in_at: new Date().toISOString()
          }, { onConflict: 'machine_id, mold_id, mold_size' });

        if (error) throw error;
      } else {
        // SCAN OUT
        if (!existing) {
          alert(t('errMoldNotOnMachine'));
          setIsSubmitting(false);
          return;
        }
        const newQty = existing.quantity - scanQty;
        if (newQty <= 0) {
          const { error } = await supabase
            .from('running_molds')
            .delete()
            .eq('uuid', existing.uuid);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('running_molds')
            .update({ 
              quantity: newQty,
              scanned_in_at: new Date().toISOString() 
            })
            .eq('uuid', existing.uuid);
          if (error) throw error;
        }
      }

      setShowSuccess(true);
      if (selectedMachineId) fetchMachineCapacity(selectedMachineId); // Refresh UI capacity
      setTimeout(() => setShowSuccess(false), 2000);
      setQty(1);
    } catch (error: any) {
      console.error(error);
      alert(t('scanError') + ': ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tối ưu lọc danh sách: Phải dùng useMemo để React ép re-render ngay khi gõ phím
  const filteredMolds = (import.meta.env.SSR ? [] : (function() {
    const term = moldSearchTerm.toLowerCase().trim();
    if (!term) return molds.slice(0, 50);
    return molds.filter(m => m.id.toLowerCase().includes(term)).slice(0, 50);
  })());

  const moldResults = Array.isArray(filteredMolds) ? filteredMolds : [];

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
                {t('btnEnableCamera')}
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
              title={t('stopCamera')}
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
                {machines.map(m => (
                  <option key={m.id} value={m.id} className={m.operational_status !== 'active' ? 'text-slate-500 italic' : ''}>
                    {m.id} | {m.name} {m.operational_status !== 'active' ? `(${m.operational_status.toUpperCase()})` : ''}
                  </option>
                ))}
              </select>
              {selectedMachineId && (
                <button 
                  onClick={() => { 
                    setSelectedMachineId(''); 
                    setSelectedMoldId(''); 
                    setSelectedSize('');
                  }}
                  className="p-2 bg-slate-700/50 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-600 transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              )}
            </div>
            {selectedMachineId && machineCapacity && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2 space-y-1"
              >
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-slate-400">{t('curMoldsOnMachine')}:</span>
                  <span className="text-white">{machineCapacity.current} / {machineCapacity.max}</span>
                </div>
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-slate-400">{t('remCapacity')}:</span>
                  <span className={machineCapacity.max - machineCapacity.current > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {Math.max(0, machineCapacity.max - machineCapacity.current)}
                  </span>
                </div>
              </motion.div>
            )}
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
                      onClick={() => { 
                        setSelectedMoldId(''); 
                        setMoldSearchTerm(''); 
                        setSelectedSize('');
                      }}
                      className="p-2 bg-slate-700/50 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-600 transition-colors shadow-sm"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                  )}
                  {selectedSize && (
                    <div className="flex-shrink-0 flex items-center gap-1.5 bg-indigo-500/20 px-3 py-2 rounded-xl border border-indigo-500/20 whitespace-nowrap">
                      <Tag className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-black text-indigo-300 uppercase">{selectedSize}</span>
                    </div>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                <AnimatePresence>
                  {isSearchingMold && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsSearchingMold(false)}></div>
                      <motion.div 
                        key={`dropdown-${moldSearchTerm}`} // Bắt buộc React vẽ lại khi SearchTerm đổi
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-h-64 overflow-y-auto z-[100] scrollbar-hide"
                      >
                        {moldResults.length > 0 ? (
                          moldResults.map(m => (
                             <button
                               key={m.id}
                               onClick={() => {
                                 setSelectedMoldId(m.id);
                                 setSelectedSize(m.size);
                                 setMoldSearchTerm(m.id);
                                 setIsSearchingMold(false);
                                 updateRecentMolds(m.id);
                               }}
                               className="w-full text-left px-5 py-4 hover:bg-indigo-500/30 text-white font-bold border-b border-slate-800 last:border-0 flex items-center justify-between group transition-colors active:bg-indigo-500/50"
                             >
                               <span className="text-base">{m.id}</span>
                               <span className="text-[10px] bg-indigo-500/20 group-hover:bg-indigo-500/40 px-2 py-1 rounded-lg text-indigo-300 font-black uppercase ring-1 ring-indigo-500/30">{m.size}</span>
                             </button>
                          ))
                        ) : (
                          <div className="px-5 py-6 text-slate-400 text-center italic font-medium bg-slate-900/50">{t('noMoldFound')}</div>
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
                    // Handle size automatically if only 1 size, otherwise will prompt
                    const matching = molds.filter(m => m.id === rid);
                    if (matching.length === 1) setSelectedSize(matching[0].size);
                    else setSelectedSize('');
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

          {/* Size Choice Grid (if multiple sizes) */}
          {selectedMoldId && availableSizes.length > 1 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/30">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-14">{t('selectMoldSize')}</p>
              <div className="flex flex-wrap gap-2 pl-14">
                {availableSizes.map((size: string) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                      selectedSize === size
                        ? 'bg-indigo-500 text-white border-indigo-400 shadow-lg'
                        : 'bg-slate-700/50 text-slate-300 border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
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
        disabled={isSubmitting || showSuccess || !selectedMachineId || !selectedMoldId || !selectedSize}
        className={`w-full relative mt-auto py-6 rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 overflow-hidden ${
          showSuccess 
            ? 'bg-emerald-500 text-white' 
            : !selectedMachineId || !selectedMoldId || !selectedSize
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
