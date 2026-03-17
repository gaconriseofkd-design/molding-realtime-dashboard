import { useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingDown, Target, Zap, LayoutGrid, Info } from 'lucide-react';
import type { Machine } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  machines: Machine[];
}

export function AnalyticsModal({ isOpen, onClose, machines }: AnalyticsModalProps) {
  const { t } = useLanguage();
  const [activeSegment, setActiveSegment] = useState<string | null>(null);

  const stats = useMemo(() => {
    const optimal = machines.filter(m => m.status === 'optimal').map(m => m.id);
    const warning = machines.filter(m => m.status === 'warning').map(m => m.id);
    const underutilized = machines.filter(m => m.status === 'underutilized').map(m => m.id);

    // Molds distribution
    const moldCounts: Record<string, number> = {};
    machines.forEach(m => {
      m.molds.forEach(mold => {
        moldCounts[mold.id] = (moldCounts[mold.id] || 0) + mold.qty;
      });
    });

    const topMolds = Object.entries(moldCounts)
      .map(([id, qty]) => ({ name: id, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    // Productivity by capacity
    const capacityGroups: Record<number, { total: number, running: number, machines: number }> = {};
    machines.forEach(m => {
      if (!capacityGroups[m.maxMolds]) {
        capacityGroups[m.maxMolds] = { total: 0, running: 0, machines: 0 };
      }
      capacityGroups[m.maxMolds].total += m.maxMolds;
      capacityGroups[m.maxMolds].running += m.moldsRunning;
      capacityGroups[m.maxMolds].machines += 1;
    });

    const capacityData = Object.entries(capacityGroups).map(([cap, data]) => ({
      name: `${cap} Khuôn`,
      efficiency: Math.round((data.running / data.total) * 100),
      machines: data.machines,
      running: data.running
    }));

    const allStatusData = [
      { name: t('optimal') || 'Tối ưu', value: optimal.length, ids: optimal, color: '#10b981' },
      { name: t('warning') || 'Cảnh báo', value: warning.length, ids: warning, color: '#f59e0b' },
      { name: t('underutilized') || 'Chưa tối ưu', value: underutilized.length, ids: underutilized, color: '#f43f5e' }
    ];

    return {
      statusData: allStatusData.filter(s => s.value > 0),
      allStatusData,
      topMolds,
      capacityData,
      underloadedMachines: machines
        .filter(m => m.loadPercentage < 30)
        .sort((a, b) => a.loadPercentage - b.loadPercentage)
        .slice(0, 5)
    };
  }, [machines, t]);

  if (!isOpen) return null;

  const CHART_WIDTH = 420;
  const CHART_HEIGHT = 280;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-6xl max-h-[90vh] bg-slate-900 border border-slate-700/50 rounded-3xl shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-slate-800/40 rounded-t-3xl flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/20 p-2 rounded-xl">
                <TrendingDown className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Thống Kê Hiệu Suất Tải</h2>
                <p className="text-sm text-slate-400">Phân tích dữ liệu vận hành thời gian thực ({machines.length} máy)</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* Status Distribution Pie Chart */}
              <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/30">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" />
                  Trạng thái công suất máy
                </h3>
                <div className="flex items-center justify-center">
                  {stats.statusData.length > 0 ? (
                    <PieChart width={CHART_WIDTH} height={CHART_HEIGHT}>
                      <Pie
                        data={stats.statusData}
                        cx={210}
                        cy={120}
                        innerRadius={70}
                        outerRadius={105}
                        paddingAngle={4}
                        dataKey="value"
                        onClick={(data) => {
                          if (data && data.name) {
                            setActiveSegment(activeSegment === data.name ? null : data.name);
                          }
                        }}
                      >
                        {stats.statusData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke="rgba(0,0,0,0)"
                            style={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                        formatter={(value: any) => [value + ' máy', '']}
                      />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center">
                      <p className="text-slate-500 italic">Chưa có dữ liệu máy</p>
                    </div>
                  )}
                </div>
                {/* Clickable segment expanded list */}
                {activeSegment && (
                  <motion.div
                    key={activeSegment}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 p-3 bg-slate-900/50 rounded-xl border border-slate-700/50"
                  >
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Danh sách máy — {activeSegment}:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {stats.statusData.find(s => s.name === activeSegment)?.ids.map(id => (
                        <span key={id} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono border border-slate-700">
                          {id}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}
                {/* Summary row */}
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {stats.allStatusData.map(s => (
                    <div key={s.name} className="p-2 rounded-lg" style={{ backgroundColor: s.color + '18', border: `1px solid ${s.color}40` }}>
                      <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{s.name}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Molds Bar Chart */}
              <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/30">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Top 10 Khuôn Đang Chạy (Số lượng)
                </h3>
                <div className="flex items-center justify-center">
                  {stats.topMolds.length > 0 ? (
                    <BarChart width={CHART_WIDTH} height={CHART_HEIGHT} data={stats.topMolds} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                      <XAxis type="number" hide tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={75} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                        itemStyle={{ color: '#c4b5fd' }}
                        formatter={(val: any) => [val + ' cái', 'Số lượng']}
                      />
                      <Bar dataKey="qty" fill="#6366f1" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="qty" position="right" fill="#94a3b8" fontSize={11} />
                      </Bar>
                    </BarChart>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center">
                      <p className="text-slate-500 italic text-center">Chưa có khuôn nào đang chạy trên máy</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Efficiency by Capacity */}
              <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/30">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Hiệu suất theo nhóm công suất máy
                </h3>
                <div className="flex items-center justify-center">
                  {stats.capacityData.length > 0 ? (
                    <BarChart width={CHART_WIDTH} height={CHART_HEIGHT} data={stats.capacityData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} unit="%" domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                        formatter={(val: any) => [val + '%', 'Hiệu suất']}
                      />
                      <Bar dataKey="efficiency" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="efficiency" position="top" fill="#c4b5fd" fontSize={11} formatter={(v: any) => `${v}%`} />
                      </Bar>
                    </BarChart>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center">
                      <p className="text-slate-500 italic">Không có nhóm công suất máy</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Critical / Underloaded Machines */}
              <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/30">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2 text-rose-400">
                  <Info className="w-4 h-4" />
                  Máy thường xuyên dưới tải (Cảnh báo)
                </h3>
                <p className="text-xs text-slate-500 mb-4 font-medium">Top 5 máy có hiệu suất tải thấp nhất (Dưới 30%)</p>
                <div className="space-y-3">
                  {stats.underloadedMachines.length > 0 ? (
                    stats.underloadedMachines.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-rose-500/10">
                        <div className="flex items-center gap-3">
                          <span className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center text-[10px] font-bold text-rose-400 border border-rose-500/20 leading-tight text-center">
                            {m.id}
                          </span>
                          <div>
                            <p className="text-sm font-bold text-slate-200">{m.name}</p>
                            <p className="text-[10px] text-slate-500 font-medium">Chỉ chạy {m.moldsRunning}/{m.maxMolds} khuôn</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-rose-500">{m.loadPercentage}%</p>
                          <div className="w-20 h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-rose-500" style={{ width: `${m.loadPercentage}%` }}></div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500 italic">Tất cả máy đều đang vận hành trên mức 30% tải.</div>
                  )}
                </div>
              </div>

            </div>
          </div>

          <div className="p-4 bg-slate-900/80 text-center border-t border-slate-700/50 rounded-b-3xl flex-shrink-0">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Molding Realtime Analytics Dashboard v1.0</p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
