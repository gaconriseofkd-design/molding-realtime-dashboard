import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingDown, Target, Layers, Cpu, Info } from 'lucide-react';
import type { Machine } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  machines: Machine[];
}

// ── Custom SVG Donut Chart ─────────────────────────────────────────
function DonutChart({
  data,
  onSegmentClick,
  activeSegment,
}: {
  data: { name: string; value: number; color: string; ids: string[] }[];
  onSegmentClick: (name: string) => void;
  activeSegment: string | null;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0)
    return (
      <p className="text-slate-500 italic text-center py-16">Chưa có dữ liệu</p>
    );

  const cx = 100, cy = 100, r = 70, ir = 45;
  let cumPct = 0;

  const arcs = data.map((d) => {
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
      'Z',
    ].join(' ');
    return { pathD, ...d, pct };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={200} height={200} viewBox="0 0 200 200" className="flex-shrink-0">
        {arcs.map((arc, i) => (
          <path
            key={i}
            d={arc.pathD}
            fill={arc.color}
            opacity={activeSegment === null || activeSegment === arc.name ? 0.9 : 0.3}
            className="cursor-pointer transition-opacity"
            onClick={() => onSegmentClick(arc.name)}
          />
        ))}
        <text x={cx} y={cy - 8} textAnchor="middle" fill="#fff" fontSize="22" fontWeight="bold">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#94a3b8" fontSize="10">Tổng máy</text>
      </svg>
      <div className="space-y-3 flex-1 min-w-0">
        {data.map((d) => (
          <button
            key={d.name}
            onClick={() => onSegmentClick(d.name)}
            className="w-full flex items-center justify-between group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-sm text-slate-300 group-hover:text-white transition-colors truncate">
                {d.name}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-bold text-white">{d.value}</span>
              <span className="text-xs text-slate-500">({Math.round((d.value / total) * 100)}%)</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Scrollable Stats Table ─────────────────────────────────────────
function StatsTable({
  rows,
  col1Label,
  col2Label,
  emptyText,
  col1Color,
}: {
  rows: { label: string; value: number; sub?: string }[];
  col1Label: string;
  col2Label: string;
  emptyText: string;
  col1Color?: string;
}) {
  if (rows.length === 0)
    return <p className="text-slate-500 italic text-center py-10">{emptyText}</p>;

  const maxVal = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="overflow-y-auto max-h-[320px] space-y-1.5 pr-1 scrollbar-thin">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest sticky top-0 bg-slate-800/90">
        <span>{col1Label}</span>
        <span>{col2Label}</span>
      </div>
      {rows.map((row, i) => (
        <motion.div
          key={row.label}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.02 }}
          className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-700/20 rounded-lg border border-slate-700/30 hover:border-slate-600/50 hover:bg-slate-700/30 transition-all"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-200 truncate" style={col1Color ? { color: col1Color } : {}}>
                {row.label}
              </p>
              {row.sub && <p className="text-[10px] text-slate-500">{row.sub}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Mini bar */}
            <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden hidden sm:block">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(row.value / maxVal) * 100}%`,
                  backgroundColor: col1Color || '#6366f1',
                }}
              />
            </div>
            <span className="text-sm font-black text-white w-8 text-right">{row.value}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Vertical Bar Chart ─────────────────────────────────────────────
function VBarChart({
  data,
  dataKey,
  nameKey,
  color,
  unit = '',
}: {
  data: Record<string, any>[];
  dataKey: string;
  nameKey: string;
  color: string;
  unit?: string;
}) {
  if (!data || data.length === 0)
    return <p className="text-slate-500 italic text-center py-8">Chưa có dữ liệu</p>;
  const max = Math.max(...data.map((d) => d[dataKey]), 1);

  return (
    <div className="flex items-end gap-3 h-44">
      {data.map((d, i) => {
        const heightPct = (d[dataKey] / max) * 100;
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1 h-full justify-end">
            <span className="text-[11px] font-bold" style={{ color }}>
              {d[dataKey]}{unit}
            </span>
            <div className="w-full flex items-end" style={{ height: '120px' }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${heightPct}%` }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="w-full rounded-t"
                style={{ backgroundColor: color }}
              />
            </div>
            <span className="text-[10px] text-slate-400 text-center leading-tight">{d[nameKey]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────
export function AnalyticsModal({ isOpen, onClose, machines }: AnalyticsModalProps) {
  const { t } = useLanguage();
  const [activeSegment, setActiveSegment] = useState<string | null>(null);

  const stats = useMemo(() => {
    const optimal = machines.filter((m) => m.status === 'optimal');
    const warning = machines.filter((m) => m.status === 'warning');
    const underutilized = machines.filter((m) => m.status === 'underutilized');

    // All molds running (aggregated across machines)
    const moldCounts: Record<string, number> = {};
    machines.forEach((m) => {
      m.molds.forEach((mold) => {
        moldCounts[mold.id] = (moldCounts[mold.id] || 0) + mold.qty;
      });
    });
    const allMoldsRunning = Object.entries(moldCounts)
      .map(([id, qty]) => ({ label: id, value: qty }))
      .sort((a, b) => b.value - a.value);

    // All running machines (machines with at least 1 mold)
    const runningMachines = machines
      .filter((m) => m.moldsRunning > 0)
      .sort((a, b) => b.moldsRunning - a.moldsRunning)
      .map((m) => ({
        label: m.id,
        value: m.moldsRunning,
        sub: `${m.name} — ${m.loadPercentage}% tải`,
      }));

    // Capacity groups
    const capacityGroups: Record<number, { total: number; running: number }> = {};
    machines.forEach((m) => {
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
      { name: t('optimal') || 'Tối ưu', value: optimal.length, ids: optimal.map((m) => m.id), color: '#10b981' },
      { name: t('warning') || 'Cảnh báo', value: warning.length, ids: warning.map((m) => m.id), color: '#f59e0b' },
      { name: t('underutilized') || 'Chưa tối ưu', value: underutilized.length, ids: underutilized.map((m) => m.id), color: '#f43f5e' },
    ];

    return {
      statusData,
      allMoldsRunning,
      runningMachines,
      capacityData,
      underloadedMachines: machines
        .filter((m) => m.loadPercentage < 30)
        .sort((a, b) => a.loadPercentage - b.loadPercentage)
        .slice(0, 5),
    };
  }, [machines, t]);

  if (!isOpen) return null;

  const handleSegment = (name: string) =>
    setActiveSegment(activeSegment === name ? null : name);

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
                <p className="text-sm text-slate-400">
                  Phân tích thời gian thực —{' '}
                  <span className="text-indigo-400 font-bold">{machines.length} máy</span>,{' '}
                  <span className="text-emerald-400 font-bold">{stats.runningMachines.length} máy đang chạy</span>,{' '}
                  <span className="text-violet-400 font-bold">{stats.allMoldsRunning.length} loại khuôn</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* 1. Status Distribution Donut */}
              <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/30">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <Target className="w-4 h-4" /> Trạng thái công suất máy
                </h3>
                <DonutChart
                  data={stats.statusData}
                  onSegmentClick={handleSegment}
                  activeSegment={activeSegment}
                />
                {activeSegment && (
                  <motion.div
                    key={activeSegment}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-3 bg-slate-900/60 rounded-xl border border-slate-700/40"
                  >
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                      Danh sách máy — {activeSegment}:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {stats.statusData
                        .find((s) => s.name === activeSegment)
                        ?.ids.map((id) => (
                          <span
                            key={id}
                            className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono border border-slate-700"
                          >
                            {id}
                          </span>
                        ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* 2. All Molds Running */}
              <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/30">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-400" />
                  <span>Khuôn đang chạy</span>
                  <span className="ml-auto bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {stats.allMoldsRunning.length} loại
                  </span>
                </h3>
                <StatsTable
                  rows={stats.allMoldsRunning}
                  col1Label="Mã khuôn"
                  col2Label="Số lượng"
                  emptyText="Chưa có khuôn nào đang chạy"
                  col1Color="#a78bfa"
                />
              </div>

              {/* 3. All Running Machines */}
              <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/30">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>Máy đang hoạt động</span>
                  <span className="ml-auto bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {stats.runningMachines.length}/{machines.length} máy
                  </span>
                </h3>
                <StatsTable
                  rows={stats.runningMachines}
                  col1Label="Máy"
                  col2Label="Khuôn đang chạy"
                  emptyText="Không có máy nào đang hoạt động"
                  col1Color="#34d399"
                />
              </div>

              {/* 4. Efficiency by Capacity */}
              <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/30">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" /> Hiệu suất theo nhóm công suất máy
                </h3>
                <VBarChart
                  data={stats.capacityData}
                  dataKey="efficiency"
                  nameKey="name"
                  color="#8b5cf6"
                  unit="%"
                />
              </div>

            </div>

            {/* 5. Underloaded Alert — full width */}
            {stats.underloadedMachines.length > 0 && (
              <div className="mt-6 bg-slate-800/40 p-6 rounded-2xl border border-rose-500/20">
                <h3 className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" /> Máy đang dưới tải (dưới 30%)
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  {stats.underloadedMachines.length} máy cần xem xét phân bổ khuôn thêm
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                  {stats.underloadedMachines.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-col gap-2 p-3 bg-slate-900/40 rounded-xl border border-rose-500/10"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-[10px] font-bold font-mono">
                          {m.id}
                        </span>
                        <span className="text-xs font-bold text-rose-500">{m.loadPercentage}%</span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-medium leading-tight">{m.name}</p>
                      <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full"
                          style={{ width: `${m.loadPercentage}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500">{m.moldsRunning}/{m.maxMolds} khuôn</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 p-3 text-center border-t border-slate-700/50 rounded-b-3xl">
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.3em]">
              Molding Realtime Analytics Dashboard v1.0
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
