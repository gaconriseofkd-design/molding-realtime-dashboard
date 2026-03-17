import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingDown, Target, Zap, LayoutGrid, Info } from 'lucide-react';
import type { Machine } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  machines: Machine[];
}

// Simple SVG Donut Chart
function DonutChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="text-slate-500 italic text-center py-16">Chưa có dữ liệu</p>;

  const cx = 100, cy = 100, r = 70, ir = 45;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const arcs = data.map(d => {
    const pct = d.value / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const arc = { dash, gap, offset: offset * circumference / (2 * Math.PI * r) * circumference, color: d.color, name: d.name, value: d.value, pct };
    offset += pct;
    return arc;
  });

  // Recompute properly
  let cumPct = 0;
  const arcs2 = data.map(d => {
    const pct = d.value / total;
    const startAngle = cumPct * 2 * Math.PI - Math.PI / 2;
    const endAngle = (cumPct + pct) * 2 * Math.PI - Math.PI / 2;
    cumPct += pct;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const x3 = cx + ir * Math.cos(endAngle);
    const y3 = cy + ir * Math.sin(endAngle);
    const x4 = cx + ir * Math.cos(startAngle);
    const y4 = cy + ir * Math.sin(startAngle);

    const large = pct > 0.5 ? 1 : 0;

    const pathD = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${ir} ${ir} 0 ${large} 0 ${x4} ${y4}`,
      'Z'
    ].join(' ');

    return { pathD, color: d.color, name: d.name, value: d.value, pct };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={200} height={200} viewBox="0 0 200 200">
        {arcs2.map((arc, i) => (
          <path key={i} d={arc.pathD} fill={arc.color} opacity={0.9} />
        ))}
        <text x={cx} y={cy - 8} textAnchor="middle" fill="#fff" fontSize="22" fontWeight="bold">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#94a3b8" fontSize="10">Tổng máy</text>
      </svg>
      <div className="space-y-3 flex-1">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-sm text-slate-300">{d.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{d.value}</span>
              <span className="text-xs text-slate-500">({Math.round(d.value / total * 100)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Simple horizontal bar chart
function HBarChart({ data, dataKey, nameKey, color }: { data: any[]; dataKey: string; nameKey: string; color: string }) {
  if (!data || data.length === 0) return <p className="text-slate-500 italic text-center py-8">Chưa có dữ liệu</p>;
  const max = Math.max(...data.map(d => d[dataKey]));

  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-[10px] text-slate-400 font-mono w-20 flex-shrink-0 text-right truncate" title={d[nameKey]}>{d[nameKey]}</span>
          <div className="flex-1 h-6 bg-slate-700/50 rounded overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(d[dataKey] / max) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="h-full rounded flex items-center justify-end pr-2"
              style={{ backgroundColor: color }}
            >
              <span className="text-[10px] font-bold text-white">{d[dataKey]}</span>
            </motion.div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Vertical bar chart
function VBarChart({ data, dataKey, nameKey, color, unit = '' }: { data: any[]; dataKey: string; nameKey: string; color: string; unit?: string }) {
  if (!data || data.length === 0) return <p className="text-slate-500 italic text-center py-8">Chưa có dữ liệu</p>;
  const max = Math.max(...data.map(d => d[dataKey]), 1);

  return (
    <div className="flex items-end gap-4 h-48 pt-4">
      {data.map((d, i) => {
        const heightPct = (d[dataKey] / max) * 100;
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <span className="text-[11px] font-bold" style={{ color }}>{d[dataKey]}{unit}</span>
            <div className="w-full bg-slate-700/50 rounded-t overflow-hidden" style={{ height: '140px' }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${heightPct}%` }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="w-full rounded-t mt-auto"
                style={{ backgroundColor: color, marginTop: `${100 - heightPct}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 text-center leading-tight">{d[nameKey]}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AnalyticsModal({ isOpen, onClose, machines }: AnalyticsModalProps) {
  const { t } = useLanguage();
  const [activeSegment, setActiveSegment] = useState<string | null>(null);

  const stats = useMemo(() => {
    const optimal = machines.filter(m => m.status === 'optimal');
    const warning = machines.filter(m => m.status === 'warning');
    const underutilized = machines.filter(m => m.status === 'underutilized');

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

    const capacityGroups: Record<number, { total: number; running: number }> = {};
    machines.forEach(m => {
      if (!capacityGroups[m.maxMolds]) capacityGroups[m.maxMolds] = { total: 0, running: 0 };
      capacityGroups[m.maxMolds].total += m.maxMolds;
      capacityGroups[m.maxMolds].running += m.moldsRunning;
    });

    const capacityData = Object.entries(capacityGroups)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([cap, data]) => ({
        name: `${cap} Khuôn`,
        efficiency: data.total > 0 ? Math.round((data.running / data.total) * 100) : 0,
      }));

    const statusData = [
      { name: t('optimal') || 'Tối ưu', value: optimal.length, ids: optimal.map(m => m.id), color: '#10b981' },
      { name: t('warning') || 'Cảnh báo', value: warning.length, ids: warning.map(m => m.id), color: '#f59e0b' },
      { name: t('underutilized') || 'Chưa tối ưu', value: underutilized.length, ids: underutilized.map(m => m.id), color: '#f43f5e' },
    ];

    return {
      statusData,
      topMolds,
      capacityData,
      underloadedMachines: machines
        .filter(m => m.loadPercentage < 30)
        .sort((a, b) => a.loadPercentage - b.loadPercentage)
        .slice(0, 5),
    };
  }, [machines, t]);

  if (!isOpen) return null;

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
          initial={{ scale: 0.95, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 16 }}
          transition={{ duration: 0.25 }}
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
                <p className="text-sm text-slate-400">Phân tích dữ liệu vận hành — {machines.length} máy đang giám sát</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* 1. Status Distribution */}
              <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/30">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" /> Trạng thái công suất máy
                </h3>
                <DonutChart data={stats.statusData} />
                {/* Clickable segment list */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {stats.statusData.map(s => (
                    <button
                      key={s.name}
                      onClick={() => setActiveSegment(activeSegment === s.name ? null : s.name)}
                      className="px-3 py-1 rounded-full text-xs font-bold border transition-all"
                      style={{
                        backgroundColor: activeSegment === s.name ? s.color + '30' : 'transparent',
                        borderColor: s.color + '60',
                        color: s.color,
                      }}
                    >
                      {s.name} ({s.value})
                    </button>
                  ))}
                </div>
                {activeSegment && (
                  <motion.div
                    key={activeSegment}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 p-3 bg-slate-900/60 rounded-xl border border-slate-700/40"
                  >
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Máy — {activeSegment}:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {stats.statusData.find(s => s.name === activeSegment)?.ids.map(id => (
                        <span key={id} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono border border-slate-700">{id}</span>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* 2. Top Molds */}
              <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/30">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Top 10 Khuôn Đang Chạy (Số lượng)
                </h3>
                <HBarChart data={stats.topMolds} dataKey="qty" nameKey="name" color="#6366f1" />
              </div>

              {/* 3. Capacity Efficiency */}
              <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/30">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <Target className="w-4 h-4" /> Hiệu suất theo nhóm công suất máy
                </h3>
                <VBarChart data={stats.capacityData} dataKey="efficiency" nameKey="name" color="#8b5cf6" unit="%" />
              </div>

              {/* 4. Underloaded Machines */}
              <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/30">
                <h3 className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                  <Info className="w-4 h-4" /> Máy thường xuyên dưới tải
                </h3>
                <p className="text-xs text-slate-500 mb-4">Top 5 máy hiệu suất thấp nhất (dưới 30%)</p>
                <div className="space-y-3">
                  {stats.underloadedMachines.length > 0 ? stats.underloadedMachines.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-rose-500/10">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center text-[9px] font-bold text-rose-400 border border-rose-500/20 leading-tight text-center px-1">
                          {m.id}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-200">{m.name}</p>
                          <p className="text-[10px] text-slate-500">Chỉ chạy {m.moldsRunning}/{m.maxMolds} khuôn</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-rose-500">{m.loadPercentage}%</p>
                        <div className="w-20 h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-rose-500 rounded-full" style={{ width: `${m.loadPercentage}%` }} />
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-slate-500 italic">Tất cả máy đều vận hành tốt hơn 30% tải.</div>
                  )}
                </div>
              </div>

            </div>
          </div>

          <div className="flex-shrink-0 p-3 bg-slate-900/80 text-center border-t border-slate-700/50 rounded-b-3xl">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Molding Realtime Analytics Dashboard v1.0</p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
