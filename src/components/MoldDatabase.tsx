import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { mockMoldDatabase } from '../data/mockData';
import { Plus, X, Server, Pencil, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function MoldDatabase() {
  const { t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-500/20 p-3 rounded-xl">
            <Server className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{t('moldDatabase')}</h1>
            <p className="text-slate-400 text-sm">Manage master data catalog</p>
          </div>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-[0_4px_14px_rgba(99,102,241,0.4)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.5)] active:scale-95 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('addNewMold')}
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-700/80 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">{t('moldId')}</th>
                <th className="px-6 py-4">{t('size')}</th>
                <th className="px-6 py-4 text-center">{t('totalOwnedQty')}</th>
                <th className="px-6 py-4 text-center">{t('currentlyRunningQty')}</th>
                <th className="px-6 py-4">{t('status')}</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm font-medium">
              {mockMoldDatabase.map((mold, idx) => (
                <tr key={`${mold.id}-${idx}`} className="hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-slate-600 block"></span>
                    <span className="text-slate-200 font-bold">{mold.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-700/50 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded-md text-xs font-mono">
                      {mold.size}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-300 font-mono">
                    {mold.totalOwned}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded">
                      {mold.currentlyRunning}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {mold.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/20 uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Maintenance
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 rounded-lg transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination placeholder */}
        <div className="bg-slate-900/40 p-4 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>Showing 1 to {mockMoldDatabase.length} of {mockMoldDatabase.length} entries</span>
          <div className="flex gap-1">
            <button className="px-3 py-1 bg-slate-800 rounded-md border border-slate-700 hover:text-white transition-colors">Prev</button>
            <button className="px-3 py-1 bg-indigo-500 text-white rounded-md border border-indigo-400 shadow-sm">1</button>
            <button className="px-3 py-1 bg-slate-800 rounded-md border border-slate-700 hover:text-white transition-colors">Next</button>
          </div>
        </div>
      </div>

      {/* Slide-over Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-800 border-l border-slate-700 shadow-2xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
                <h2 className="text-xl font-bold text-white">{t('addNewMold')}</h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 p-6 overflow-y-auto overflow-x-hidden space-y-6 scrollbar-thin text-left">
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('moldId')}</label>
                  <input 
                    type="text" 
                    placeholder="e.g. OV_0455"
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('size1')}</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 4.5#"
                        className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono uppercase"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('size2Optional')}</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 5.5#"
                        className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono uppercase"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                    💡 {t('sizeHint')}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('initialQuantity')}</label>
                  <input 
                    type="number" 
                    min="1"
                    defaultValue="10"
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono"
                  />
                </div>

              </div>

              <div className="p-6 border-t border-slate-700/50 bg-slate-900/30 flex gap-4">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl font-bold bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl font-bold bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:bg-indigo-400 active:scale-95 transition-all"
                >
                  {t('save')}
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
