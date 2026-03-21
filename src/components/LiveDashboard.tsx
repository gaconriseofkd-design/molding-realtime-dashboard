import { Header } from './Header';
import { MachineList } from './MachineList';
import { useLanguage } from '../contexts/LanguageContext';
import { Search, Filter, ArrowUpDown, Loader2, X, Save, Plus, Minus, PlusCircle, LayoutGrid, Monitor, BarChart as BarChartIcon, StopCircle, Clock, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import type { Machine, DashboardStats, Mold } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { AnalyticsModal } from './AnalyticsModal';
import { HistoryReportModal } from './HistoryReportModal';
import { SimpleMachineView } from './SimpleMachineView';

export function LiveDashboard() {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('none');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalMoldsRunning: 0,
    totalMoldsCapacity: 0,
    totalMachines: 0,
    totalCapacityUtilization: 0
  });

  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [editingMolds, setEditingMolds] = useState<Mold[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Machine Creation State
  const [isAddMachineModalOpen, setIsAddMachineModalOpen] = useState(false);
  const [newMachineId, setNewMachineId] = useState('');
  const [newMachineName, setNewMachineName] = useState('');
  const [newMachineMaxMolds, setNewMachineMaxMolds] = useState<number>(12);
  const [isAddingMachine, setIsAddingMachine] = useState(false);

  // Analytics Modal State
  const [showAnalytics, setShowAnalytics] = useState(false);

  // History Report Modal State
  const [showHistoryReport, setShowHistoryReport] = useState(false);

  // View mode state: grid (default) or simple (matrix)
  const [viewMode, setViewMode] = useState<'grid' | 'simple'>('grid');

  // Operational status change state
  const [statusChangeTarget, setStatusChangeTarget] = useState<Machine | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  useEffect(() => {
    fetchData();

    // Subscribe to real-time changes
    const runningMoldsSubscription = supabase
      .channel('public:running_molds')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'running_molds' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(runningMoldsSubscription);
    };
  }, []);

  const getMachineCapacity = (machineId: string): number => {
    // Extract numeric part of machine ID (e.g., "M-01" or "M01" -> 1)
    const num = parseInt(machineId.replace(/\D/g, ''));
    if (isNaN(num)) return 12; // Default fallback

    if ((num >= 1 && num <= 32) || (num >= 41 && num <= 44)) return 12;
    if (num >= 33 && num <= 40) return 24;
    if (num >= 45 && num <= 50) return 32;
    
    return 12; // Default for others
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // 1. Fetch all machines
      const { data: machinesData, error: mError } = await supabase
        .from('machines')
        .select('*')
        .order('id', { ascending: true });

      if (mError) throw mError;

      // 2. Fetch all running molds
      let allRunningData: any[] = [];
      let rPage = 0;
      const rPageSize = 1000;
      while (true) {
        const { data: pageData, error: rError } = await supabase
          .from('running_molds')
          .select('*')
          .range(rPage * rPageSize, (rPage + 1) * rPageSize - 1);
        
        if (rError) throw rError;
        if (!pageData || pageData.length === 0) break;
        allRunningData = [...allRunningData, ...pageData];
        if (pageData.length < rPageSize) break;
        rPage++;
      }
      const runningData = allRunningData;

      // 3. Transform and Compute
      const transformedMachines: Machine[] = machinesData.map(m => {
        const moldsRunningOnThisMachine = (runningData || [])
          .filter(r => r.machine_id === m.id)
          .map(r => ({
            id: r.mold_id,
            name: r.mold_id,
            size: r.mold_size,
            qty: r.quantity,
            updatedAt: r.scanned_in_at,
            statusNote: r.status_note,
            uuid: r.uuid
          }));

        const moldsCount = moldsRunningOnThisMachine.reduce((sum, mold) => sum + mold.qty, 0);
        const maxMolds = m.max_molds || getMachineCapacity(m.id);
        const loadPercentage = Math.round((moldsCount / maxMolds) * 100) || 0;
        const operationalStatus: 'active' | 'stop' | 'pause' = m.operational_status ?? 'active';

        let status: 'optimal' | 'warning' | 'underutilized' = 'underutilized';
        if (loadPercentage >= 80) status = 'optimal';
        else if (loadPercentage >= 50) status = 'warning';

        return {
          id: m.id,
          name: m.name,
          status,
          operationalStatus,
          loadPercentage,
          maxMolds,
          moldsRunning: moldsCount,
          molds: moldsRunningOnThisMachine
        };
      });

      setMachines(transformedMachines);

      // Compute Global Stats — only ACTIVE machines count toward efficiency
      const activeMachines = transformedMachines.filter(m => m.operationalStatus === 'active');
      const totalMoldsRunning = activeMachines.reduce((sum, m) => sum + m.moldsRunning, 0);
      const totalMoldsCapacity = activeMachines.reduce((sum, m) => sum + m.maxMolds, 0);
      const totalCapacityUtilization = Math.round((totalMoldsRunning / totalMoldsCapacity) * 100) || 0;

      setStats({
        totalMoldsRunning,
        totalMoldsCapacity,
        totalMachines: transformedMachines.length,
        totalCapacityUtilization
      });

      // 4. Upsert today's efficiency snapshot for historical chart
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      if (totalMoldsCapacity > 0) {
        await supabase.from('efficiency_log').upsert(
          {
            log_date: today,
            efficiency: totalCapacityUtilization,
            molds_running: totalMoldsRunning,
            total_capacity: totalMoldsCapacity,
          },
          { onConflict: 'log_date' }
        );
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOperationalStatusChange = async (machine: Machine, newStatus: 'active' | 'stop' | 'pause') => {
    setIsChangingStatus(true);
    try {
      await supabase
        .from('machines')
        .update({ operational_status: newStatus })
        .eq('id', machine.id);
      setStatusChangeTarget(null);
      await fetchData();
    } catch (err) {
      console.error('Failed to update operational status:', err);
    } finally {
      setIsChangingStatus(false);
    }
  };


  const filteredMachines = machines
    .filter(machine => {
      const matchesSearch = machine.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            machine.molds.some(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      if (statusFilter === 'all') return matchesSearch;
      if (statusFilter === 'empty') return matchesSearch && machine.molds.length === 0;
      return matchesSearch && machine.status === statusFilter;
    })
    .sort((a, b) => {
      if (sortBy === 'high') return b.loadPercentage - a.loadPercentage;
      if (sortBy === 'low') return a.loadPercentage - b.loadPercentage;
      return 0;
    });

  const handleEditMachine = (machine: Machine) => {
    setSelectedMachine(machine);
    setEditingMolds(machine.molds.map(m => ({ ...m })));
  };

  const handleUpdateMoldQty = (index: number, delta: number) => {
    setEditingMolds(prev => {
      const newMolds = [...prev];
      newMolds[index].qty = Math.max(0, newMolds[index].qty + delta);
      return newMolds;
    });
  };

  const setMoldQtyDirectly = (index: number, val: number) => {
    setEditingMolds(prev => {
      const newMolds = [...prev];
      newMolds[index].qty = Math.max(0, val);
      return newMolds;
    });
  };

  const handleSaveEdit = async () => {
    if (!selectedMachine) return;
    
    // 1. BLOCK if machine is not ACTIVE
    if (selectedMachine.operationalStatus !== 'active') {
      alert(t('errMachineInactive'));
      return;
    }

    const totalQty = editingMolds.reduce((sum, m) => sum + Number(m.qty || 0), 0);
    if (totalQty > selectedMachine.maxMolds) {
      alert(`${t('errCapacityExceeded').replace('{max}', selectedMachine.maxMolds.toString())}\n(${t('total').toUpperCase()}: ${totalQty} / ${selectedMachine.maxMolds})`);
      setIsSaving(false);
      return;
    }

    setIsSaving(true);
    try {
      const originalMolds = selectedMachine.molds;
      for (const m of editingMolds) {
        const orig = originalMolds.find(o => o.id === m.id && o.size === m.size);
        if (!orig || orig.qty !== m.qty) {
          if (m.qty > 0) {
            await supabase.from('running_molds').upsert({
              machine_id: selectedMachine.id,
              mold_id: m.id,
              mold_size: m.size,
              quantity: m.qty,
              scanned_in_at: new Date().toISOString()
            }, { onConflict: 'machine_id, mold_id, mold_size' });

            // Log history Delta
            const delta = m.qty - (orig?.qty || 0);
            if (delta !== 0) {
              await supabase.from('scan_logs').insert({
                machine_id: selectedMachine.id,
                mold_id: m.id,
                mold_size: m.size,
                quantity: Math.abs(delta),
                action_type: delta > 0 ? 'IN' : 'OUT',
                load_percentage: selectedMachine.loadPercentage
              });
            }
          } else if (m.qty === 0 && orig) {
            await supabase.from('running_molds')
              .delete()
              .match({ machine_id: selectedMachine.id, mold_id: m.id, mold_size: m.size });

            // Log history
            await supabase.from('scan_logs').insert({
              machine_id: selectedMachine.id,
              mold_id: m.id,
              mold_size: m.size,
              quantity: orig.qty,
              action_type: 'OUT',
              load_percentage: selectedMachine.loadPercentage
            });
          }
        }
      }
      setSelectedMachine(null);
      await fetchData();
    } catch (error) {
      console.error(error);
      alert(t('errUpdateMolds'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMachine = async () => {
    if (!newMachineId.trim()) {
      alert(t('errEnterMachineId'));
      return;
    }
    
    setIsAddingMachine(true);
    try {
      const { error } = await supabase.from('machines').insert([{
        id: newMachineId.trim().toUpperCase(),
        name: newMachineName.trim() || `Machine ${newMachineId}`,
        max_molds: newMachineMaxMolds,
        status: 'underutilized'
      }]);
      
      if (error) throw error;
      
      setIsAddMachineModalOpen(false);
      setNewMachineId('');
      setNewMachineName('');
      setNewMachineMaxMolds(12);
      await fetchData();
    } catch (error: any) {
      console.error(error);
      alert(t('errAddMachine') + ': ' + (error.message || 'Unknown error'));
    } finally {
      setIsAddingMachine(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Header stats={stats} />
      
      <main className="relative min-h-[400px]">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-slate-900/10 backdrop-blur-[2px] flex items-center justify-center rounded-2xl">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          </div>
        )}

        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span className="w-2 h-8 bg-indigo-500 rounded-full block"></span>
                {t('liveMachineStatus')}
              </h2>

              <button
                onClick={() => setShowHistoryReport(true)}
                className="flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-full text-sm font-bold transition-all active:scale-95 group shadow-lg shadow-indigo-500/5"
              >
                <FileText className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                {t('historyReport')}
              </button>

              <button
                onClick={() => setShowAnalytics(true)}
                className="flex items-center gap-2 px-4 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-full text-sm font-bold transition-all active:scale-95 group shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400/50"
              >
                <BarChartIcon className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                {t('analyticsBtn')}
              </button>
            </div>
          </div>

          {/* Warning Bars */}
          <div className="flex flex-col gap-3">
            {machines.flatMap(m => m.molds.filter(mold => mold.statusNote === 'material_out').map(mold => ({ mold, machine: m }))).length > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl flex items-center gap-3 animate-pulse shadow-lg shadow-rose-500/5"
              >
                <div className="bg-rose-500 p-1.5 rounded-lg">
                  <span className="text-white text-[10px] font-black uppercase tracking-tighter">HẾT LIỆU</span>
                </div>
                <div className="text-sm font-bold text-rose-400">
                  <span className="opacity-70 mr-2 uppercase tracking-wider text-[10px]">Cảnh báo hết liệu:</span>
                  {machines.flatMap(m => m.molds.filter(mold => mold.statusNote === 'material_out').map(mold => (
                    <span key={`${m.id}-${mold.id}-${mold.size}`} className="mr-3 inline-flex items-center gap-1">
                      <span className="text-white">{mold.id}</span>
                      <span className="text-indigo-400 opacity-80 text-xs">({mold.size})</span>
                      <span className="opacity-50">/</span>
                      <span className="text-emerald-400 font-black">{m.id}</span>
                    </span>
                  )))}
                </div>
              </motion.div>
            )}

            {machines.flatMap(m => m.molds.filter(mold => mold.statusNote === 'broken_mold').map(mold => ({ mold, machine: m }))).length > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl flex items-center gap-3 animate-pulse shadow-lg shadow-amber-500/5"
              >
                <div className="bg-amber-500 p-1.5 rounded-lg">
                  <span className="text-white text-[10px] font-black uppercase tracking-tighter">KHUÔN HƯ</span>
                </div>
                <div className="text-sm font-bold text-amber-400">
                  <span className="opacity-70 mr-2 uppercase tracking-wider text-[10px]">Cảnh báo khuôn hư:</span>
                  {machines.flatMap(m => m.molds.filter(mold => mold.statusNote === 'broken_mold').map(mold => (
                    <span key={`${m.id}-${mold.id}-${mold.size}`} className="mr-3 inline-flex items-center gap-1">
                      <span className="text-white">{mold.id}</span>
                      <span className="text-indigo-400 opacity-80 text-xs">({mold.size})</span>
                      <span className="opacity-50">/</span>
                      <span className="text-emerald-400 font-black">{m.id}</span>
                    </span>
                  )))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Sticky Filter Bar */}
          <div className="sticky top-[72px] z-40 bg-slate-900/95 backdrop-blur-xl p-4 rounded-xl border border-slate-700/50 flex flex-col sm:flex-row gap-4 shadow-xl">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-600 rounded-lg leading-5 bg-slate-800/50 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                placeholder={t('searchPlaceholder')}
              />
            </div>
            
            <div className="flex gap-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className="h-4 w-4 text-slate-400" />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="block w-full pl-9 pr-8 py-2 border border-slate-600 rounded-lg text-sm bg-slate-800/50 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                >
                  <option value="all">{t('status')} ({t('all')})</option>
                  <option value="optimal">{t('optimal')}</option>
                  <option value="warning">{t('warning')}</option>
                  <option value="underutilized">{t('underutilized')}</option>
                  <option value="empty">{t('empty')}</option>
                </select>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <ArrowUpDown className="h-4 w-4 text-slate-400" />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="block w-full pl-9 pr-8 py-2 border border-slate-600 rounded-lg text-sm bg-slate-800/50 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                >
                  <option value="none">{t('sortByCapacity')}</option>
                  <option value="high">High to Low</option>
                  <option value="low">Low to High</option>
                </select>
              </div>

              <div className="flex bg-slate-800/80 p-1 rounded-lg border border-slate-700 h-[38px] ml-auto sm:ml-0">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    viewMode === 'grid' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('gridView')}</span>
                </button>
                <button
                  onClick={() => setViewMode('simple')}
                  className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    viewMode === 'simple' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('simpleView')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {machines.length === 0 && !isLoading ? (
          <div className="text-center py-20 bg-slate-800/50 rounded-2xl border border-dashed border-slate-700">
            <div className="inline-flex p-4 bg-slate-900/50 rounded-full mb-4">
              <Search className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-400 font-medium">No machines found. Try seeding some data in SQL Editor.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <MachineList
              machines={filteredMachines}
              onMachineClick={handleEditMachine}
              onStatusChange={(machine) => setStatusChangeTarget(machine)}
              onRefresh={fetchData}
            />
            
            {/* Add Machine "Plus" Card */}
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ y: -4, scale: 1.02 }}
              onClick={() => {
                // Auto-suggest next ID based on existing count
                const nextId = machines.length + 1;
                setNewMachineId(`M-${nextId.toString().padStart(2, '0')}`);
                setNewMachineName(`Máy ${nextId}`);
                setIsAddMachineModalOpen(true);
              }}
              className="bg-slate-800/40 backdrop-blur border-2 border-dashed border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 hover:bg-slate-800/60 hover:border-indigo-500/50 transition-all group min-h-[280px]"
            >
              <div className="bg-slate-700/50 p-4 rounded-full group-hover:bg-indigo-500/20 transition-colors">
                <PlusCircle className="w-10 h-10 text-slate-500 group-hover:text-indigo-400" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-slate-400 group-hover:text-white transition-colors">{t('addNewMachine') || 'Thêm Máy Mới'}</p>
                <p className="text-xs text-slate-500 mt-1">{t('addMachineHint')}</p>
              </div>
            </motion.button>
          </div>
        ) : (
          <SimpleMachineView 
            machines={filteredMachines}
            onMachineClick={handleEditMachine}
            onStatusChange={(machine: Machine) => setStatusChangeTarget(machine)}
          />
        )}
      </main>

      {/* Operational Status Change Popover */}
      <AnimatePresence>
        {statusChangeTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setStatusChangeTarget(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
              <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 w-72 pointer-events-auto">
                <h3 className="text-base font-bold text-white mb-1">{statusChangeTarget.id}</h3>
                <p className="text-xs text-slate-400 mb-5">{t('opStatusTitle')}</p>
                <div className="space-y-2">
                  {(['active', 'pause', 'stop'] as const).map((s) => {
                    const cfgMap = {
                      active: { label: t('opActiveLabel'), color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' },
                      pause:  { label: t('opPauseLabel'),  color: 'border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' },
                      stop:   { label: t('opStopLabel'),   color: 'border-rose-500/50 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' },
                    };
                    const cfg = cfgMap[s];
                    const isCurrent = statusChangeTarget.operationalStatus === s;
                    return (
                      <button
                        key={s}
                        disabled={isChangingStatus}
                        onClick={() => handleOperationalStatusChange(statusChangeTarget, s)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border font-semibold text-sm transition-all
                          ${cfg.color}
                          ${isCurrent ? 'ring-2 ring-offset-1 ring-offset-slate-800' : ''}
                          disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <span>{cfg.label}</span>
                        {isCurrent && <span className="text-xs font-bold uppercase tracking-wider opacity-70">{t('opStatusCurrent')}</span>}
                        {isChangingStatus && !isCurrent && <></>}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setStatusChangeTarget(null)}
                  className="mt-4 w-full py-2 rounded-xl border border-slate-600 text-slate-400 text-sm hover:text-white hover:border-slate-500 transition-colors"
                >
                  {t('cancel')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Machine Modal */}
      <AnimatePresence>
        {isAddMachineModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddMachineModalOpen(false)}
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
                <h2 className="text-xl font-bold text-white">{t('addNewMachine') || 'Thêm Máy Mới'}</h2>
                <button 
                  onClick={() => setIsAddMachineModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 p-6 overflow-y-auto space-y-6 scrollbar-thin text-left">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">ID Máy (VD: M01)</label>
                  <input 
                    type="text" 
                    value={newMachineId}
                    onChange={(e) => setNewMachineId(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono uppercase"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tên Máy</label>
                  <input 
                    type="text" 
                    value={newMachineName}
                    onChange={(e) => setNewMachineName(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Công suất tải tối đa (Khuôn)</label>
                  <input 
                    type="number" 
                    value={newMachineMaxMolds}
                    onChange={(e) => setNewMachineMaxMolds(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[12, 24, 32].map(cap => (
                      <button 
                        key={cap}
                        onClick={() => setNewMachineMaxMolds(cap)}
                        className={`text-[10px] font-bold px-3 py-1 rounded-full transition-all ${newMachineMaxMolds === cap ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                      >
                        {cap} Khuôn
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-700/50 bg-slate-900/30 flex gap-4">
                <button 
                  onClick={() => setIsAddMachineModalOpen(false)}
                  className="flex-1 py-3 rounded-xl font-bold bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={handleAddMachine}
                  disabled={isAddingMachine}
                  className="flex-1 py-3 rounded-xl font-bold bg-indigo-500 text-white shadow-[0_4px_14px_rgba(99,102,241,0.4)] hover:bg-indigo-400 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isAddingMachine ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {t('save')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Slide-over Modal for Editing Molds on a Machine */}
      <AnimatePresence>
        {selectedMachine && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMachine(null)}
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
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wider uppercase">{selectedMachine.id}</h2>
                  <div className="flex items-center gap-1 font-mono text-xs" title={t('qty')}>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                      editingMolds.reduce((s, m) => s + (m.qty || 0), 0) > selectedMachine.maxMolds
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {editingMolds.reduce((s, m) => s + (m.qty || 0), 0)} / {selectedMachine.maxMolds}
                    </span>
                  </div>
                </div>
                {selectedMachine.operationalStatus !== 'active' && (
                  <div className="bg-rose-500/20 border border-rose-500/30 px-4 py-2 rounded-xl flex items-center gap-2 mt-2">
                    <StopCircle className="w-4 h-4 text-rose-400" />
                    <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider">{t('errMachineInactive')}</span>
                  </div>
                )}
                <button 
                  onClick={() => setSelectedMachine(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 p-6 overflow-y-auto overflow-x-hidden space-y-4 scrollbar-thin text-left">
                {editingMolds.length === 0 ? (
                  <div className="text-slate-400 text-center py-8 italic bg-slate-900/40 rounded-xl border border-slate-700/50">
                    {t('noMolds') || 'No molds currently running on this machine.'}
                  </div>
                ) : (
                  editingMolds.map((mold, idx) => (
                    <div key={`${mold.id}-${mold.size}`} className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-xl flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white">{mold.name}</span>
                        <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded text-xs font-mono border border-indigo-500/20">{mold.size}</span>
                      </div>
                      
                      {mold.updatedAt && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400/80 bg-amber-500/5 px-2 py-1 rounded-lg border border-amber-500/10 w-fit">
                          <Clock className="w-3 h-3" />
                          <span>{(() => {
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
                          })()}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-slate-400 text-sm">{t('quantity') || 'Quantity'}:</span>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => handleUpdateMoldQty(idx, -1)}
                            className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-white hover:bg-rose-500 hover:text-white transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input 
                            type="number" 
                            min="0"
                            value={mold.qty}
                            onChange={(e) => setMoldQtyDirectly(idx, parseInt(e.target.value) || 0)}
                            className="w-16 bg-slate-800 border border-slate-600 rounded-lg py-1 text-center text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button 
                            onClick={() => handleUpdateMoldQty(idx, 1)}
                            className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-white hover:bg-emerald-500 hover:text-white transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 border-t border-slate-700/50 bg-slate-900/30 flex gap-4">
                <button 
                  onClick={() => setSelectedMachine(null)}
                  className="flex-1 py-3 rounded-xl font-bold bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={handleSaveEdit}
                  disabled={isSaving || (selectedMachine.operationalStatus !== 'active') || (editingMolds.reduce((s, m) => s + Number(m.qty || 0), 0) > selectedMachine.maxMolds)}
                  className="flex-1 py-3 rounded-xl font-bold bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:bg-indigo-400 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {t('save')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Analytics Visualization Modal */}
      <AnalyticsModal 
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        machines={machines}
      />

      {/* History Report Modal */}
      {showHistoryReport && (
        <HistoryReportModal 
          isOpen={showHistoryReport} 
          onClose={() => setShowHistoryReport(false)} 
        />
      )}
    </div>
  );
}
