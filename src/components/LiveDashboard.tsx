import { Header } from './Header';
import { MachineList } from './MachineList';
import { useLanguage } from '../contexts/LanguageContext';
import { Search, Filter, ArrowUpDown, Loader2, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import type { Machine, DashboardStats } from '../types';
import { utils, writeFile } from 'xlsx';

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
      const { data: runningData, error: rError } = await supabase
        .from('running_molds')
        .select('*');

      if (rError) throw rError;

      // 3. Transform and Compute
      const transformedMachines: Machine[] = machinesData.map(m => {
        const moldsRunningOnThisMachine = (runningData || [])
          .filter(r => r.machine_id === m.id)
          .map(r => ({
            id: r.mold_id,
            name: r.mold_id,
            size: r.mold_size,
            qty: r.quantity
          }));

        const moldsCount = moldsRunningOnThisMachine.reduce((sum, mold) => sum + mold.qty, 0);
        const loadPercentage = Math.round((moldsCount / m.max_molds) * 100) || 0;

        return {
          id: m.id,
          name: m.name,
          status: m.status,
          loadPercentage,
          maxMolds: m.max_molds,
          moldsRunning: moldsCount,
          molds: moldsRunningOnThisMachine
        };
      });

      setMachines(transformedMachines);

      // Compute Global Stats
      const totalMoldsRunning = transformedMachines.reduce((sum, m) => sum + m.moldsRunning, 0);
      const totalMoldsCapacity = transformedMachines.reduce((sum, m) => sum + m.maxMolds, 0);
      const totalCapacityUtilization = Math.round((totalMoldsRunning / totalMoldsCapacity) * 100) || 0;

      setStats({
        totalMoldsRunning,
        totalMoldsCapacity,
        totalMachines: transformedMachines.length,
        totalCapacityUtilization
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = () => {
    const exportData = machines.flatMap(m => {
      if (m.molds.length === 0) {
        return [{
          Machine: m.id,
          Name: m.name,
          Status: m.status,
          Load: `${m.loadPercentage}%`,
          Mold: 'None',
          Size: '-',
          Quantity: 0
        }];
      }
      return m.molds.map(mold => ({
        Machine: m.id,
        Name: m.name,
        Status: m.status,
        Load: `${m.loadPercentage}%`,
        Mold: mold.id,
        Size: mold.size,
        Quantity: mold.qty
      }));
    });

    const ws = utils.json_to_sheet(exportData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Live Status");
    
    // Auto-size columns
    const colWidths = [
      { wch: 10 }, { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 }
    ];
    ws['!cols'] = colWidths;

    writeFile(wb, `Molding_Status_${new Date().toISOString().split('T')[0]}.xlsx`);
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
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-full text-sm font-bold transition-all active:scale-95 group shadow-lg shadow-emerald-500/5"
              >
                <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                {t('exportExcel')}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm font-medium">
              <div className="flex items-center gap-2 text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                <span className="w-3 h-3 rounded-full bg-emerald-500 block shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                {t('optimal')}
              </div>
              <div className="flex items-center gap-2 text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                <span className="w-3 h-3 rounded-full bg-amber-500 block shadow-[0_0_10px_rgba(245,158,11,0.5)]"></span>
                {t('warning')}
              </div>
              <div className="flex items-center gap-2 text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                <span className="w-3 h-3 rounded-full bg-rose-500 block shadow-[0_0_10px_rgba(244,63,94,0.5)]"></span>
                {t('underutilized')}
              </div>
            </div>
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
        ) : (
          <MachineList machines={filteredMachines} />
        )}
      </main>
    </div>
  );
}
