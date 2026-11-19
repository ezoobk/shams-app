import * as XLSX from 'xlsx';
import { calculateDurationDays, parseDateSafely } from '../../utils/formatters';

export type DatePreset = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all' | 'custom';

export interface DateRangeFilter {
  preset: DatePreset;
  startDate: string; // YYYY-MM-DD or ''
  endDate: string;   // YYYY-MM-DD or ''
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export const toISODate = (d: Date): string => {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const getPresetDates = (preset: DatePreset): { startDate: string; endDate: string } => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case 'this_month': {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      return { startDate: toISODate(start), endDate: toISODate(end) };
    }
    case 'last_month': {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { startDate: toISODate(start), endDate: toISODate(end) };
    }
    case 'this_quarter': {
      const qStartMonth = Math.floor(m / 3) * 3;
      const start = new Date(y, qStartMonth, 1);
      const end = new Date(y, qStartMonth + 3, 0);
      return { startDate: toISODate(start), endDate: toISODate(end) };
    }
    case 'this_year': {
      return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
    }
    case 'all':
    default:
      return { startDate: '', endDate: '' };
  }
};

export const getSafeAmount = (obj: any, keys: string[] = ['netTotal', 'total', 'totalAmount', 'amount']): number => {
  if (!obj) return 0;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      const n = Number(obj[k]);
      if (!isNaN(n)) return n;
    }
  }
  return 0;
};

export const extractDateObj = (val: any): Date | null => {
  if (!val) return null;
  const d = parseDateSafely(val);
  if (d.getTime() <= 0 || d.getFullYear() < 2000 || d.getFullYear() > 2100) return null;
  return d;
};

export const isWithinDateRange = (dateVal: any, startDate: string, endDate: string): boolean => {
  if (!startDate && !endDate) return true;
  const d = extractDateObj(dateVal);
  if (!d) return false;
  const iso = toISODate(d);
  if (startDate && iso < startDate) return false;
  if (endDate && iso > endDate) return false;
  return true;
};

export const getMonthKey = (dateVal: any): string | null => {
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}/.test(dateVal.trim())) {
    return dateVal.trim().slice(0, 7);
  }
  const d = extractDateObj(dateVal);
  if (!d) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export const formatMonthLabel = (ym: string): string => {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  const monthIdx = Number(m[2]) - 1;
  return `${ARABIC_MONTHS[monthIdx] || m[2]} ${m[1]}`;
};

export interface MonthlySeriesPoint {
  month: string;
  label: string;
  sales: number;
  purchases: number;
  payroll: number;
  productivity: number;
  totalExpenses: number;
  netCashFlow: number;
}

export const buildMonthlyFinancialSeries = (params: {
  invoices: any[];
  purchaseInvoices: any[];
  payrollRecords: any[];
  settlements: any[];
  startDate: string;
  endDate: string;
}): MonthlySeriesPoint[] => {
  const map = new Map<string, MonthlySeriesPoint>();
  const ensure = (ym: string): MonthlySeriesPoint => {
    let entry = map.get(ym);
    if (!entry) {
      entry = {
        month: ym,
        label: formatMonthLabel(ym),
        sales: 0,
        purchases: 0,
        payroll: 0,
        productivity: 0,
        totalExpenses: 0,
        netCashFlow: 0
      };
      map.set(ym, entry);
    }
    return entry;
  };

  (params.invoices || []).forEach(inv => {
    if (!inv || !isWithinDateRange(inv.date, params.startDate, params.endDate)) return;
    const ym = getMonthKey(inv.date);
    if (!ym) return;
    const amt = getSafeAmount(inv, ['netTotal', 'total', 'totalAmount']);
    if (inv.type === 'نهائية') {
      ensure(ym).sales += amt;
    } else if (inv.type === 'إنتاجية') {
      ensure(ym).productivity += amt;
    }
  });

  (params.purchaseInvoices || []).forEach(pinv => {
    if (!pinv || pinv.status === 'draft') return;
    if (!isWithinDateRange(pinv.date, params.startDate, params.endDate)) return;
    const ym = getMonthKey(pinv.date);
    if (!ym) return;
    ensure(ym).purchases += getSafeAmount(pinv, ['netTotal', 'total']);
  });

  (params.payrollRecords || []).forEach(pr => {
    if (!pr || !pr.month) return;
    const prDate = `${pr.month}-01`;
    if (!isWithinDateRange(prDate, params.startDate, params.endDate)) return;
    ensure(pr.month).payroll += Number(pr.totalNet || 0);
  });

  (params.settlements || []).forEach(st => {
    if (!st) return;
    const d = st.settlementDate || st.payoutDate;
    if (!isWithinDateRange(d, params.startDate, params.endDate)) return;
    const ym = st.month || getMonthKey(d);
    if (!ym) return;
    ensure(ym).payroll += Number(st.netPayable || 0);
  });

  return Array.from(map.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(p => {
      const totalExpenses = p.purchases + p.payroll + p.productivity;
      return {
        ...p,
        totalExpenses,
        netCashFlow: p.sales - totalExpenses
      };
    });
};

export const getWorkOrderItemCompletionDate = (item: any): string | null => {
  if (!item) return null;
  if (Array.isArray(item.sectionStatuses) && item.sectionStatuses.length > 0) {
    const dates = item.sectionStatuses
      .filter((s: any) => s?.isCompleted && s?.completedAt)
      .map((s: any) => ({ raw: String(s.completedAt), ts: parseDateSafely(s.completedAt).getTime() }))
      .filter((d: any) => d.ts > 0)
      .sort((a: any, b: any) => b.ts - a.ts);
    if (dates.length > 0) return dates[0].raw;
  }
  return item.completedAt || null;
};

export const getItemLeadTimeDays = (woDate: any, item: any): number | null => {
  if (typeof item?.completionDays === 'number' && !isNaN(item.completionDays) && item.completionDays >= 0) {
    return item.completionDays;
  }
  const endRaw = getWorkOrderItemCompletionDate(item);
  if (!woDate || !endRaw) return null;
  return calculateDurationDays(woDate, endRaw);
};

export interface ExcelSheetPayload {
  sheetName: string;
  rows: Record<string, any>[];
}

export const exportMultiSheetExcel = (fileNamePrefix: string, sheets: ExcelSheetPayload[]) => {
  const wb = XLSX.utils.book_new();
  let added = 0;

  sheets.forEach(({ sheetName, rows }) => {
    if (!rows || rows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const safeName = sheetName.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || `Sheet${added + 1}`;
    XLSX.utils.book_append_sheet(wb, ws, safeName);
    added++;
  });

  if (added === 0) {
    const ws = XLSX.utils.json_to_sheet([{ ملاحظة: 'لا توجد بيانات مطابقة للفترة المحددة' }]);
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير');
  }

  const stamp = toISODate(new Date());
  XLSX.writeFile(wb, `${fileNamePrefix}_${stamp}.xlsx`);
};
