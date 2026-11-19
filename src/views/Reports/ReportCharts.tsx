import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { MonthlySeriesPoint } from './reportUtils';

type ColorTheme = 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'purple' | 'slate' | 'teal';

const THEME_CLASSES: Record<ColorTheme, { bg: string; iconBg: string; iconText: string; badge: string }> = {
  blue:    { bg: 'border-blue-100',    iconBg: 'bg-blue-50',    iconText: 'text-blue-600',    badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  emerald: { bg: 'border-emerald-100', iconBg: 'bg-emerald-50', iconText: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  amber:   { bg: 'border-amber-100',   iconBg: 'bg-amber-50',   iconText: 'text-amber-600',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  rose:    { bg: 'border-rose-100',    iconBg: 'bg-rose-50',    iconText: 'text-rose-600',    badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  indigo:  { bg: 'border-indigo-100',  iconBg: 'bg-indigo-50',  iconText: 'text-indigo-600',  badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  purple:  { bg: 'border-purple-100',  iconBg: 'bg-purple-50',  iconText: 'text-purple-600',  badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  slate:   { bg: 'border-slate-200',   iconBg: 'bg-slate-100',  iconText: 'text-slate-600',   badge: 'bg-slate-100 text-slate-700 border-slate-200' },
  teal:    { bg: 'border-teal-100',    iconBg: 'bg-teal-50',    iconText: 'text-teal-600',    badge: 'bg-teal-50 text-teal-700 border-teal-200' },
};

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  badgeText?: string;
  icon: LucideIcon;
  theme?: ColorTheme;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  badgeText,
  icon: Icon,
  theme = 'blue',
}) => {
  const cls = THEME_CLASSES[theme];
  return (
    <div className={`bg-white rounded-2xl border ${cls.bg} p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-slate-500 mb-1.5 truncate">{title}</div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight break-words">{value}</div>
        </div>
        <div className={`w-10 h-10 rounded-xl ${cls.iconBg} ${cls.iconText} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {(subtitle || badgeText) && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          {subtitle && <span className="text-[11px] font-medium text-slate-500">{subtitle}</span>}
          {badgeText && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${cls.badge}`}>
              {badgeText}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export const EmptyReportState: React.FC<{ message?: string }> = ({
  message = 'لا توجد بيانات كافية لعرض هذا التقرير في الفترة المحددة'
}) => (
  <div className="py-10 px-4 text-center text-slate-400 text-sm font-medium bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
    {message}
  </div>
);

interface MonthlyComparisonChartProps {
  data: MonthlySeriesPoint[];
  canViewFinancials: boolean;
}

export const MonthlyComparisonChart: React.FC<MonthlyComparisonChartProps> = ({ data, canViewFinancials }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!canViewFinancials) {
    return <EmptyReportState message="عرض الرسوم المالية يتطلب صلاحية (عرض البيانات المالية)" />;
  }

  if (!data || data.length === 0) {
    return <EmptyReportState />;
  }

  const visibleData = data.slice(-12);
  const maxVal = Math.max(
    1,
    ...visibleData.map(d => Math.max(d.sales, d.purchases, d.payroll, d.productivity))
  );

  const chartH = 220;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" /> المبيعات النهائية</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> المشتريات</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-purple-600 inline-block" /> الرواتب والمخالصات</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-teal-500 inline-block" /> إنتاجية الفنيين</span>
      </div>

      <div className="relative overflow-x-auto pb-2">
        <div className="min-w-[560px] flex items-end justify-between gap-3 px-2 pt-8 border-b border-slate-200" style={{ height: chartH + 40 }}>
          {visibleData.map((point, idx) => {
            const hSales = Math.round((point.sales / maxVal) * chartH);
            const hPurchases = Math.round((point.purchases / maxVal) * chartH);
            const hPayroll = Math.round((point.payroll / maxVal) * chartH);
            const hProd = Math.round((point.productivity / maxVal) * chartH);
            const isHovered = hoveredIdx === idx;

            return (
              <div
                key={point.month}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`relative flex-1 flex flex-col items-center group rounded-t-xl transition-colors px-1 pt-2 ${
                  isHovered ? 'bg-slate-50' : ''
                }`}
              >
                {isHovered && (
                  <div className="absolute -top-2 z-20 -translate-y-full bg-slate-900 text-white text-[11px] rounded-xl p-2.5 shadow-xl min-w-[175px] pointer-events-none">
                    <div className="font-black text-blue-300 mb-1 border-b border-slate-700 pb-1">{point.label}</div>
                    <div className="flex justify-between gap-3"><span>مبيعات:</span><span className="font-mono">{formatCurrency(point.sales)}</span></div>
                    <div className="flex justify-between gap-3"><span>مشتريات:</span><span className="font-mono">{formatCurrency(point.purchases)}</span></div>
                    <div className="flex justify-between gap-3"><span>رواتب:</span><span className="font-mono">{formatCurrency(point.payroll)}</span></div>
                    <div className="flex justify-between gap-3"><span>إنتاجية:</span><span className="font-mono">{formatCurrency(point.productivity)}</span></div>
                    <div className={`flex justify-between gap-3 mt-1 pt-1 border-t border-slate-700 font-bold ${point.netCashFlow >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      <span>الصافي:</span>
                      <span className="font-mono">{formatCurrency(point.netCashFlow)}</span>
                    </div>
                  </div>
                )}

                <div className="w-full flex items-end justify-center gap-1" style={{ height: chartH }}>
                  <div className="w-3 sm:w-3.5 bg-blue-600 rounded-t-md transition-all" style={{ height: Math.max(point.sales > 0 ? 4 : 0, hSales) }} title={`مبيعات: ${formatCurrency(point.sales)}`} />
                  <div className="w-3 sm:w-3.5 bg-amber-500 rounded-t-md transition-all" style={{ height: Math.max(point.purchases > 0 ? 4 : 0, hPurchases) }} title={`مشتريات: ${formatCurrency(point.purchases)}`} />
                  <div className="w-3 sm:w-3.5 bg-purple-600 rounded-t-md transition-all" style={{ height: Math.max(point.payroll > 0 ? 4 : 0, hPayroll) }} title={`رواتب: ${formatCurrency(point.payroll)}`} />
                  <div className="w-3 sm:w-3.5 bg-teal-500 rounded-t-md transition-all" style={{ height: Math.max(point.productivity > 0 ? 4 : 0, hProd) }} title={`إنتاجية: ${formatCurrency(point.productivity)}`} />
                </div>

                <div className="mt-2 text-[10px] sm:text-[11px] font-bold text-slate-600 whitespace-nowrap text-center">
                  {point.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export interface HorizontalBarItem {
  id: string;
  label: string;
  value: number;
  displayValue: string;
  subLabel?: string;
  colorClass?: string;
}

export const HorizontalBarList: React.FC<{
  items: HorizontalBarItem[];
  emptyMessage?: string;
  defaultColorClass?: string;
}> = ({ items, emptyMessage, defaultColorClass = 'bg-blue-600' }) => {
  if (!items || items.length === 0) {
    return <EmptyReportState message={emptyMessage} />;
  }

  const maxVal = Math.max(1, ...items.map(i => i.value));

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const pct = Math.max(3, Math.min(100, (item.value / maxVal) * 100));
        return (
          <div key={item.id || idx} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="font-bold text-slate-800 truncate">{item.label}</span>
                {item.subLabel && <span className="text-[11px] text-slate-400 truncate hidden sm:inline">({item.subLabel})</span>}
              </div>
              <span className="font-black text-slate-900 font-mono whitespace-nowrap">{item.displayValue}</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${item.colorClass || defaultColorClass}`}
                style={{ width: `${item.value <= 0 ? 0 : pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export interface DonutSlice {
  label: string;
  value: number;
  displayValue: string;
  color: string;
}

export const DonutBreakdownChart: React.FC<{
  slices: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
  emptyMessage?: string;
}> = ({ slices, centerLabel, centerValue, emptyMessage }) => {
  const validSlices = (slices || []).filter(s => s.value > 0);
  const total = validSlices.reduce((s, i) => s + i.value, 0);

  if (validSlices.length === 0 || total <= 0) {
    return <EmptyReportState message={emptyMessage} />;
  }

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-36 h-36 flex-shrink-0">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="18" />
          {validSlices.map((slice, i) => {
            const pct = slice.value / total;
            const dash = pct * circumference;
            const strokeDasharray = `${dash} ${circumference - dash}`;
            const strokeDashoffset = -offset;
            offset += dash;
            return (
              <circle
                key={i}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth="18"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="butt"
              />
            );
          })}
        </svg>
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
            {centerLabel && <span className="text-[10px] font-bold text-slate-400">{centerLabel}</span>}
            {centerValue && <span className="text-xs font-black text-slate-800 leading-tight mt-0.5">{centerValue}</span>}
          </div>
        )}
      </div>

      <div className="flex-1 w-full space-y-2">
        {validSlices.map((slice, idx) => {
          const pct = Math.round((slice.value / total) * 1000) / 10;
          return (
            <div key={idx} className="flex items-center justify-between gap-2 text-xs bg-slate-50/70 px-3 py-2 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: slice.color }} />
                <span className="font-bold text-slate-700 truncate">{slice.label}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-black text-slate-900 font-mono">{slice.displayValue}</span>
                <span className="text-[11px] font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
