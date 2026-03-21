import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../utils/supabaseClient';
import { Server, Pencil, X, Plus, Loader2, Search, Lock, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function MachineDatabase() {
  const { t } = useLanguage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Machine Data state
  const [machines, setMachines] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Editing state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<any | null>(null);
  const [machineId, setMachineId] = useState('');
  const [machineName, setMachineName] = useState('');
  const [maxMolds, setMaxMolds] = useState<number>(12);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMachines();
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin') {
      setIsAuthenticated(true);
    } else {
      setPasswordError(true);
      setTimeout(() => setPasswordError(false), 2000);
    }
  };

  const fetchMachines = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .order('id', { ascending: true });
        
      if (error) throw error;
      setMachines(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (m: any) => {
    setEditingMachine(m);
    setMachineId(m.id);
    setMachineName(m.name || '');
    setMaxMolds(m.max_molds || 12);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    // 1. Check if there are molds on this machine
    const { data: running } = await supabase
      .from('running_molds')
      .select('uuid')
      .eq('machine_id', id)
      .limit(1);
    
    if (running && running.length > 0) {
      alert(t('errMachineHasRunningMolds'));
      return;
    }

    if (!confirm(t('confirmDeleteMachine'))) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('machines')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      fetchMachines();
    } catch (err: any) {
      console.error(err);
      alert('Error deleting machine: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!machineId.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('machines')
        .upsert({
          id: machineId.toUpperCase(),
          name: machineName,
          max_molds: maxMolds
        }, { onConflict: 'id' });
        
      if (error) throw error;
      setIsModalOpen(false);
      fetchMachines();
    } catch (error: any) {
      console.error(error);
      alert('Error updating machine: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-in fade-in duration-500">
        <div className="bg-slate-800/80 backdrop-blur-md p-8 rounded-3xl border border-slate-700/50 shadow-2xl max-w-sm w-full">
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-rose-500/20 rounded-2xl flex items-center justify-center border border-rose-500/30">
              <Lock className="w-8 h-8 text-rose-400" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-white">{t('machineDatabase')}</h2>
              <p className="text-slate-400 text-sm mt-1">{t('passwordRequired')}</p>
            </div>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('enterPassword')}
                className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white focus:outline-none transition-all text-center tracking-[0.5em] font-mono ${
                  passwordError 
                    ? 'border-rose-500 focus:ring-rose-500 animate-shake ring-2 ring-rose-500/50' 
                    : 'border-slate-700 focus:ring-2 focus:ring-indigo-500'
                }`}
                autoFocus
              />
              {passwordError && (
                <p className="text-rose-400 text-xs text-center font-bold">{t('incorrectPassword')}</p>
              )}
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
            >
              Cấp quyền Truy cập
            </button>
          </form>
        </div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            50% { transform: translateX(5px); }
            75% { transform: translateX(-5px); }
          }
          .animate-shake { animation: shake 0.4s ease-in-out; }
        `}} />
      </div>
    );
  }

  const filtered = machines.filter(m => 
    m.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-500/20">
            <Server className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{t('machineDatabase')}</h1>
            <p className="text-slate-400 text-sm">Quản lý tên và công suất tải tối đa của các Máy</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900/50 border border-slate-600 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm w-full sm:w-64"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
          <button 
            onClick={() => {
              setEditingMachine(null);
              setMachineId('');
              setMachineName('');
              setMaxMolds(12);
              setIsModalOpen(true);
            }}
            className="bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('addNewMachine')}</span>
          </button>
        </div>
      </div>

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
                <th className="px-6 py-4">Machine ID</th>
                <th className="px-6 py-4">{t('machineName')}</th>
                <th className="px-6 py-4 text-center">{t('maxCapacity')}</th>
                <th className="px-6 py-4">{t('status')}</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-sm font-medium">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4 font-bold text-white tracking-wider">{m.id}</td>
                  <td className="px-6 py-4 text-slate-300">{m.name}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-md text-xs font-black border ${
                      m.max_molds === 12 ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                      m.max_molds === 24 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      m.max_molds === 32 ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                      'bg-slate-700/50 text-slate-300 border-slate-600'
                    }`}>
                      {m.max_molds} {t('molds')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                     <span className={`text-xs font-bold uppercase inline-block text-center border rounded-full px-3 py-0.5 ${
                        m.operational_status === 'active' ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10' :
                        m.operational_status === 'pause' ? 'border-amber-500/20 text-amber-400 bg-amber-500/10' :
                        'border-rose-500/20 text-rose-400 bg-rose-500/10'
                     }`}>
                        {m.operational_status || 'active'}
                     </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleEdit(m)}
                      className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title={t('editMachine')}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(m.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ml-1"
                      title={t('delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && !isLoading && (
            <div className="p-8 text-center text-slate-500 italic">No machines found</div>
          )}
        </div>
      </div>

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
                <h2 className="text-xl font-bold text-white">{editingMachine ? t('editMachine') : t('addNewMachine')}</h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Machine ID (VD: M01, M45)</label>
                  <input 
                    type="text" 
                    value={machineId}
                    onChange={(e) => setMachineId(e.target.value)}
                    disabled={!!editingMachine}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono uppercase disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('machineName')}</label>
                  <input 
                    type="text" 
                    value={machineName}
                    onChange={(e) => setMachineName(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('maxCapacity')} (Khuôn)</label>
                  <input 
                    type="number" 
                    value={maxMolds}
                    onChange={(e) => setMaxMolds(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[12, 24, 32].map(cap => (
                      <button 
                        key={cap}
                        onClick={() => setMaxMolds(cap)}
                        className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${
                          maxMolds === cap 
                            ? 'bg-indigo-500 text-white border-indigo-400' 
                            : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-600'
                        }`}
                      >
                        {cap} Khuôn
                      </button>
                    ))}
                  </div>
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
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-3 rounded-xl font-bold bg-indigo-500 text-white shadow-[0_4px_14px_rgba(99,102,241,0.4)] hover:bg-indigo-400 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
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
