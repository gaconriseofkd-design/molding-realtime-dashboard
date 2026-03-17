import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../utils/supabaseClient';
import { Plus, X, Server, Pencil, Trash2, Upload, Download, Loader2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import type { MoldMaster } from '../types';

export function MoldDatabase() {
  const { t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [molds, setMolds] = useState<MoldMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal State
  const [newMoldId, setNewMoldId] = useState('');
  const [newMoldSize1, setNewMoldSize1] = useState('');
  const [newMoldSize2, setNewMoldSize2] = useState('');
  const [newMoldQty, setNewMoldQty] = useState<number>(10);

  useEffect(() => {
    fetchMolds();
  }, []);

  const fetchMolds = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('mold_master')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;

      // Transform db items to match MoldMaster type if needed
      if (data) {
        const mappedData: MoldMaster[] = data.map((item: any) => ({
          id: item.id,
          size: item.size,
          totalOwned: item.total_owned,
          currentlyRunning: 0, // In a real app, this would be computed by joining running_molds
          status: item.status
        }));
        setMolds(mappedData);
      }
    } catch (error) {
      console.error('Error fetching molds:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { Mold: 'OV_0224', Size: '7Y', Quantity: 50 },
      { Mold: 'OV_0199', Size: '4.5#-5.5#', Quantity: 20 }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Mold_Master_Template.xlsx');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[];

      // Validate and format
      const formattedData = jsonData
        .filter(row => row.Mold && row.Size && row.Quantity !== undefined)
        .map(row => ({
          id: String(row.Mold).trim().toUpperCase(),
          size: String(row.Size).trim(),
          total_owned: parseInt(row.Quantity) || 0,
          status: 'active'
        }));

      if (formattedData.length === 0) {
        alert(t('invalidFormat'));
        return;
      }

      // Upsert to Supabase
      const { error } = await supabase
        .from('mold_master')
        .upsert(formattedData, { onConflict: 'id, size' })
        .select(); // selecting returns the inserted rows and helps surface deeper db errors

      if (error) {
        throw error;
      }
      
      alert(t('uploadSuccess'));
      fetchMolds();
    } catch (error: any) {
      console.error('Upload Error:', error);
      // Hiển thị trực tiếp mã lỗi của Supabase ra màn hình để báo cáo
      alert(t('uploadFailed') + '\n\nChi tiết lỗi Supabase: ' + (error?.message || error?.details || JSON.stringify(error)));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveManual = async () => {
    if (!newMoldId.trim() || !newMoldSize1.trim()) {
      alert("Vui lòng nhập Mã Khuôn và Size 1");
      return;
    }

    const finalSize = newMoldSize2.trim() !== '' 
      ? `${newMoldSize1.trim()}-${newMoldSize2.trim()}` 
      : newMoldSize1.trim();

    try {
      const { error } = await supabase.from('mold_master').insert([{
        id: newMoldId.trim().toUpperCase(),
        size: finalSize,
        total_owned: newMoldQty,
        status: 'active'
      }]);

      if (error) throw error;

      setIsModalOpen(false);
      setNewMoldId(''); setNewMoldSize1(''); setNewMoldSize2(''); setNewMoldQty(10);
      fetchMolds();
    } catch (error: any) {
      console.error(error);
      alert('Failed to save: ' + error.message);
    }
  };

  const filteredMolds = molds.filter(mold => mold.id.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header Area */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-500/20 p-3 rounded-xl">
            <Server className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{t('moldDatabase')}</h1>
            <p className="text-slate-400 text-sm">Manage master data catalog</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder={t('searchMoldCode') || 'Search Mold Code...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900/50 border border-slate-600 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm w-full sm:w-64"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx,.xls,.csv" 
            className="hidden" 
          />
          <button 
            onClick={handleDownloadTemplate}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t('downloadTemplate')}</span>
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-[0_4px_14px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span className="hidden sm:inline">{isUploading ? t('uploading') : t('importExcel')}</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-[0_4px_14px_rgba(99,102,241,0.4)] flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('addNewMold')}</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden relative min-h-[400px]">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        )}
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
              {filteredMolds.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 italic">
                    No data available or no match found. Add a mold manually or import from Excel.
                  </td>
                </tr>
              )}
              {filteredMolds.map((mold, idx) => (
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
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 rounded-lg transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={async () => {
                          if (confirm('Are you sure you want to delete this mold?')) {
                            await supabase.from('mold_master').delete().eq('id', mold.id);
                            fetchMolds();
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded-lg transition-colors"
                      >
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
          <span>Showing 1 to {filteredMolds.length} of {filteredMolds.length} entries</span>
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
                    value={newMoldId}
                    onChange={(e) => setNewMoldId(e.target.value)}
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
                        value={newMoldSize1}
                        onChange={(e) => setNewMoldSize1(e.target.value)}
                        placeholder="e.g. 4.5#"
                        className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono uppercase"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('size2Optional')}</label>
                      <input 
                        type="text" 
                        value={newMoldSize2}
                        onChange={(e) => setNewMoldSize2(e.target.value)}
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
                    value={newMoldQty}
                    onChange={(e) => setNewMoldQty(parseInt(e.target.value) || 0)}
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
                  onClick={handleSaveManual}
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
