import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Camera, Minus, Plus, Cpu, Package, ScanLine, Tag } from 'lucide-react';
import { motion } from 'framer-motion';

export function ScanInOut() {
  const { t } = useLanguage();
  const [scanType, setScanType] = useState<'IN' | 'OUT'>('IN');
  const [qty, setQty] = useState(1);
  const [scanning, setScanning] = useState(true);

  // Simulate scanning for visual effect
  useEffect(() => {
    const timer = setInterval(() => {
      setScanning(prev => !prev);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="max-w-md mx-auto h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      
      {/* Scanner Viewport Placeholder */}
      <div className="relative w-full aspect-square bg-slate-800 rounded-3xl overflow-hidden border-4 border-slate-700/50 shadow-2xl flex items-center justify-center">
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

      {/* Scanned Data */}
      <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 shadow-lg space-y-4">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-500/20 p-3 rounded-xl">
            <Cpu className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-400">{t('selectedMachine')}</p>
            <p className="text-2xl font-black text-white">M-01</p>
          </div>
        </div>

        <div className="h-px w-full bg-slate-700"></div>

        <div className="flex items-center gap-4">
          <div className="bg-emerald-500/20 p-3 rounded-xl flex-shrink-0">
            <Package className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-400">{t('scannedMold')}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xl font-bold text-slate-200 truncate">OV_0224</p>
              <div className="flex items-center gap-1.5 bg-slate-700/50 px-2.5 py-1 rounded-lg">
                <Tag className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-300">7Y</span>
              </div>
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

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 flex items-center justify-between">
          <span className="text-slate-400 font-semibold uppercase">{t('quantity')}</span>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="w-14 h-14 bg-slate-700 rounded-2xl flex items-center justify-center hover:bg-slate-600 active:scale-90 transition-all shadow-md"
            >
              <Minus className="w-6 h-6 text-white" />
            </button>
            <span className="text-4xl font-black min-w-[3ch] text-center">{qty}</span>
            <button 
              onClick={() => setQty(qty + 1)}
              className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center hover:bg-indigo-400 active:scale-90 transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)]"
            >
              <Plus className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>

      <button className="w-full mt-auto bg-slate-200 hover:bg-white text-slate-900 py-6 rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl transition-all active:scale-[0.98]">
        {t('confirmSubmit')}
      </button>

    </div>
  );
}
