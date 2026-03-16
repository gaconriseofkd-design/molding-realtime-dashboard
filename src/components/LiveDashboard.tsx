import { Header } from './Header';
import { MachineList } from './MachineList';
import { mockDashboardStats, mockMachines } from '../data/mockData';
import { useLanguage } from '../contexts/LanguageContext';
import { Search, Filter, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';

export function LiveDashboard() {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredMachines = mockMachines.filter(machine => {
    const matchesSearch = machine.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          machine.molds.some(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'empty') return matchesSearch && machine.molds.length === 0;
    return matchesSearch && machine.status === statusFilter;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Header stats={mockDashboardStats} />
      
      <main>
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span className="w-2 h-8 bg-indigo-500 rounded-full block"></span>
              {t('liveMachineStatus')}
            </h2>
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
                  className="block w-full pl-9 pr-8 py-2 border border-slate-600 rounded-lg text-sm bg-slate-800/50 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                >
                  <option>{t('sortByCapacity')}</option>
                  <option value="high">High to Low</option>
                  <option value="low">Low to High</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        <MachineList machines={filteredMachines} />
      </main>
    </div>
  );
}
