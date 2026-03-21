import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Download, Loader2, FileText, Clock } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import * as XLSX from 'xlsx';

interface HistoryReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HistoryReportModal({ isOpen, onClose }: HistoryReportModalProps) {
  const { t, language } = useLanguage();
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isExporting, setIsExporting] = useState(false);

  const calculateNormalShift = (date: Date): string => {
    const hours = date.getHours();
    if (hours >= 6 && hours < 14) return 'Ca 1';
    if (hours >= 14 && hours < 22) return 'Ca 2';
    return 'Ca 3';
  };

  const calculate247Shift = (date: Date): string => {
    const hours = date.getHours();
    if (hours >= 6 && hours < 18) return 'Ca 1';
    return 'Ca 2';
  };

  const handleDownload = async () => {
    try {
      setIsExporting(true);
      
      // Fetch data from scan_logs
      let allLogs: any[] = [];
      let page = 0;
      const pageSize = 1000;
      
      // Format dates to cover full day (from 00:00:00 of start to 23:59:59 of end)
      const startIso = `${startDate}T00:00:00.000Z`;
      const endIso = `${endDate}T23:59:59.999Z`;

      while (true) {
        const { data, error } = await supabase
          .from('scan_logs')
          .select('*')
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allLogs = [...allLogs, ...data];
        if (data.length < pageSize) break;
        page++;
      }

      if (allLogs.length === 0) {
        alert(t('noLogsFound'));
        return;
      }

      // Transform data for Excel with Session Load logic
      const logsByMachine: Record<string, any[]> = {};
      allLogs.forEach(log => {
        if (!logsByMachine[log.machine_id]) logsByMachine[log.machine_id] = [];
        logsByMachine[log.machine_id].push(log);
      });

      const processedLogs: any[] = [];
      const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes

      Object.keys(logsByMachine).forEach(machineId => {
        const machineLogs = logsByMachine[machineId].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        if (machineLogs.length === 0) return;

        let currentSession: any[] = [machineLogs[0]];
        
        for (let i = 1; i <= machineLogs.length; i++) {
          const log = machineLogs[i];
          const prevLog = machineLogs[i-1];
          
          const isNewSession = !log || (new Date(log.created_at).getTime() - new Date(prevLog.created_at).getTime() > SESSION_GAP_MS);
          
          if (isNewSession) {
            const finalLoad = currentSession[currentSession.length - 1].load_percentage;
            currentSession.forEach(sLog => {
              processedLogs.push({ ...sLog, session_load: finalLoad });
            });
            if (log) currentSession = [log];
          } else {
            currentSession.push(log);
          }
        }
      });

      processedLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const excelData = processedLogs.map(log => {
        const date = new Date(log.created_at);
        const timeStr = date.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US');
        
        return {
          'Machine': log.machine_id,
          'Load': log.session_load ? `${log.session_load}%` : (log.load_percentage ? `${log.load_percentage}%` : '-'),
          'Mold ID': log.mold_id,
          'Size': log.mold_size,
          'Quantity': log.quantity,
          'Status (Action)': log.action_type === 'IN' ? 'SCAN IN' : 'SCAN OUT',
          'Time': timeStr,
          'Ca Thường (Normal Shift)': calculateNormalShift(date),
          'Ca 24/7 (24/7 Shift)': calculate247Shift(date)
        };
      });

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Scan History");
      
      // Auto-size columns
      const colWidths = [
        { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 25 }
      ];
      ws['!cols'] = colWidths;

      XLSX.writeFile(wb, `Molding_History_${startDate}_to_${endDate}.xlsx`);
      
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export history. Please check console for details.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-lg bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="p-6 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/20 p-2 rounded-xl">
                <FileText className="w-6 h-6 text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">{t('historyReport')}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> {t('startDate')}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> {t('endDate')}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                />
              </div>
            </div>

            <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-700/50 space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                <Clock className="w-3 h-3" /> Shift Rules
              </h3>
              <div className="grid grid-cols-2 gap-4 text-[11px]">
                <div className="space-y-1">
                  <p className="font-bold text-indigo-400 underline">{t('shiftNormal')}</p>
                  <p className="text-slate-400">C1: 06:00 - 14:00</p>
                  <p className="text-slate-400">C2: 14:00 - 22:00</p>
                  <p className="text-slate-400">C3: 22:00 - 06:00</p>
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-emerald-400 underline">{t('shift247')}</p>
                  <p className="text-slate-400">C1: 06:00 - 18:00</p>
                  <p className="text-slate-400">C2: 18:00 - 06:00</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleDownload}
              disabled={isExporting}
              className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-500/30 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Download className="w-6 h-6" />
              )}
              {t('downloadReport')}
            </button>
          </div>
          
          <div className="p-4 bg-slate-900/40 text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest border-t border-slate-700/30">
            CSV / XLSX Data Export System
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
