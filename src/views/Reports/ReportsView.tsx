import React, { useState, useMemo } from 'react';
import {
  BarChart3, TrendingUp, Factory, ShoppingBag, Users, Calendar, Download, Printer, Filter
} from 'lucide-react';
import { SubTabNav } from '../../components/ui/SubTabNav';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useAuth } from '../../context/AuthContext';
import { useInvoices } from '../../context/InvoicesContext';
import { usePurchases } from '../../context/PurchasesContext';
import { useWorkOrders } from '../../context/WorkOrdersContext';
import { useEstimates } from '../../context/EstimatesContext';
import { useMaterials } from '../../context/MaterialsContext';
import { useShippingOrders } from '../../context/ShippingOrdersContext';
import { useDrivers } from '../../context/DriversContext';
import { useHR } from '../../context/HRContext';
import { useAuditLog, logAudit } from '../../context/AuditLogContext';
import {
  type DatePreset,
  getPresetDates,
  isWithinDateRange,
  getSafeAmount,
  buildMonthlyFinancialSeries,
  getItemLeadTimeDays,
  exportMultiSheetExcel
} from './reportUtils';
import { ExecutiveTab } from './ExecutiveTab';
import { SalesCustomersTab } from './SalesCustomersTab';
import { ProductionTechniciansTab } from './ProductionTechniciansTab';
import { PurchasesLogisticsTab } from './PurchasesLogisticsTab';
import { HRAuditTab } from './HRAuditTab';
import { calculateDurationDays } from '../../utils/formatters';

interface ReportsViewProps {
  setActiveTab?: (tab: string) => void;
  printStats?: Record<string, { count: number; lastPrintedAt?: string; lastPrintedBy?: string }>;
}

const PRESET_OPTIONS: Array<{ id: DatePreset; label: string }> = [
  { id: 'this_month', label: 'هذا الشهر' },
  { id: 'last_month', label: 'الشهر الماضي' },
  { id: 'this_quarter', label: 'هذا الربع' },
  { id: 'this_year', label: 'هذا العام' },
  { id: 'all', label: 'كافة السجلات' },
  { id: 'custom', label: 'فترة مخصصة' },
];

export const ReportsView: React.FC<ReportsViewProps> = ({ setActiveTab, printStats = {} }) => {
  const { hasPermission } = useAuth();
  const canViewFinancials = hasPermission('reports', 'view_financials');
  const canExport = hasPermission('reports', 'export');

  const { invoices, deletedInvoices } = useInvoices();
  const { purchaseInvoices } = usePurchases();
  const { workOrders } = useWorkOrders();
  const { estimates, estimateCategories } = useEstimates();
  const { worksOf } = useMaterials();
  const { shippingOrders } = useShippingOrders();
  const { drivers } = useDrivers();
  const { employees, payrollRecords, transactions, leaves, settlements } = useHR();
  const { logs: auditLogs } = useAuditLog();

  const [subTab, setSubTab] = useLocalStorage<string>('shams_reports_subtab', 'executive');
  const [preset, setPreset] = useState<DatePreset>('this_year');
  const initialDates = useMemo(() => getPresetDates('this_year'), []);
  const [startDate, setStartDate] = useState<string>(initialDates.startDate);
  const [endDate, setEndDate] = useState<string>(initialDates.endDate);

  const handlePresetChange = (nextPreset: DatePreset) => {
    setPreset(nextPreset);
    if (nextPreset !== 'custom') {
      const range = getPresetDates(nextPreset);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  };

  // Executive & cross-module summary calculations
  const executiveMetrics = useMemo(() => {
    const filteredInv = (invoices || []).filter(inv => inv && isWithinDateRange(inv.date, startDate, endDate));
    const finalInvs = filteredInv.filter(inv => inv.type === 'نهائية');
    const prelimInvs = filteredInv.filter(inv => inv.type === 'مبدئية');
    const prodInvs = filteredInv.filter(inv => inv.type === 'إنتاجية');
    const filteredDeleted = (deletedInvoices || []).filter(inv => inv && isWithinDateRange(inv.date, startDate, endDate));

    const totalSales = finalInvs.reduce((s, i) => s + getSafeAmount(i, ['netTotal', 'total', 'totalAmount']), 0);
    const totalDiscounts = finalInvs.reduce((s, i) => s + Number(i.discount || 0), 0);
    const preliminaryTotal = prelimInvs.reduce((s, i) => s + getSafeAmount(i, ['netTotal', 'total', 'totalAmount']), 0);
    const totalProductivityCost = prodInvs.reduce((s, i) => s + getSafeAmount(i, ['netTotal', 'total', 'totalAmount']), 0);

    const filteredPurchases = (purchaseInvoices || []).filter(p => p && isWithinDateRange(p.date, startDate, endDate));
    const completedPurchases = filteredPurchases.filter(p => p.status !== 'draft');
    const draftPurchases = filteredPurchases.filter(p => p.status === 'draft');
    const totalPurchases = completedPurchases.reduce((s, p) => s + getSafeAmount(p, ['netTotal', 'total']), 0);

    const filteredPayrolls = (payrollRecords || []).filter(pr => pr && pr.month && isWithinDateRange(`${pr.month}-01`, startDate, endDate));
    const filteredSettlements = (settlements || []).filter(st => st && isWithinDateRange(st.settlementDate || st.payoutDate, startDate, endDate));
    const totalPayrollAndSettlements =
      filteredPayrolls.reduce((s, p) => s + Number(p.totalNet || 0), 0) +
      filteredSettlements.reduce((s, st) => s + Number(st.netPayable || 0), 0);

    const netOperatingCashFlow = totalSales - (totalPurchases + totalPayrollAndSettlements + totalProductivityCost);

    // Work orders metrics
    const soldSNs = new Set<string>();
    (invoices || [])
      .filter(inv => inv && inv.type === 'نهائية' && Array.isArray(inv.items))
      .forEach(inv => {
        inv.items.forEach((it: any) => {
          if (it.serialNumber) soldSNs.add(String(it.serialNumber).trim());
          if (Array.isArray(it.serialNumbers)) {
            it.serialNumbers.forEach((sn: string) => { if (sn) soldSNs.add(String(sn).trim()); });
          }
        });
      });

    let readyUnsoldCount = 0;
    let inProgressWorkOrdersCount = 0;
    const leadTimes: number[] = [];
    const secDurations = new Map<string, { name: string; sum: number; count: number }>();

    const worksOfMap = new Map<string, string>();
    (worksOf || []).forEach(w => { if (w?.id) worksOfMap.set(String(w.id), w.name); });

    (workOrders || []).forEach(wo => {
      if (!wo || !isWithinDateRange(wo.date, startDate, endDate)) return;
      (wo.items || []).forEach((it: any) => {
        const mfg = it.mfgStatus || (it.status === 'جاهز' ? 'جاهز' : 'قيد التصنيع');
        const sn = it.serialNumber ? String(it.serialNumber).trim() : '';
        const isSold = it.status === 'مباع' || (sn !== '' && soldSNs.has(sn));
        if (mfg === 'جاهز') {
          const lt = getItemLeadTimeDays(wo.date, it);
          if (lt !== null) leadTimes.push(lt);
          if (!isSold) readyUnsoldCount++;
        } else {
          inProgressWorkOrdersCount++;
        }

        if (Array.isArray(it.sectionStatuses)) {
          it.sectionStatuses.forEach((sec: any) => {
            if (!sec?.isCompleted) return;
            const key = String(sec.sectionId || sec.sectionName || '');
            if (!key) return;
            const name = worksOfMap.get(key) || sec.sectionName || key;
            let dur = typeof sec.durationDays === 'number' ? sec.durationDays : null;
            if (dur === null && wo.date && sec.completedAt) {
              dur = calculateDurationDays(wo.date, sec.completedAt);
            }
            if (dur !== null && !isNaN(dur)) {
              const cur = secDurations.get(key) || { name, sum: 0, count: 0 };
              cur.sum += dur;
              cur.count += 1;
              secDurations.set(key, cur);
            }
          });
        }
      });
    });

    const avgCompletionDays = leadTimes.length > 0
      ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
      : null;

    let bottleneckSectionName: string | null = null;
    let bottleneckAvgDays: number | null = null;
    secDurations.forEach(v => {
      const avg = v.count > 0 ? v.sum / v.count : 0;
      if (bottleneckAvgDays === null || avg > bottleneckAvgDays) {
        bottleneckAvgDays = avg;
        bottleneckSectionName = v.name;
      }
    });

    const monthlySeries = buildMonthlyFinancialSeries({
      invoices,
      purchaseInvoices,
      payrollRecords,
      settlements,
      startDate,
      endDate
    });

    return {
      totalSales,
      finalInvoicesCount: finalInvs.length,
      preliminaryInvoicesCount: prelimInvs.length,
      preliminaryTotal,
      totalPurchases,
      purchasesCount: completedPurchases.length,
      draftPurchasesCount: draftPurchases.length,
      totalPayrollAndSettlements,
      totalProductivityCost,
      netOperatingCashFlow,
      totalDiscounts,
      deletedInvoicesCount: filteredDeleted.length,
      readyUnsoldCount,
      inProgressWorkOrdersCount,
      avgCompletionDays,
      bottleneckSectionName,
      bottleneckAvgDays,
      monthlySeries
    };
  }, [invoices, deletedInvoices, purchaseInvoices, payrollRecords, settlements, workOrders, worksOf, startDate, endDate]);

  const handleExportAll = () => {
    if (!canExport) return;

    const monthlyRows = canViewFinancials
      ? executiveMetrics.monthlySeries.map(m => ({
          'الشهر': m.label,
          'المبيعات النهائية': m.sales,
          'المشتريات المعتمدة': m.purchases,
          'الرواتب والمخالصات': m.payroll,
          'إنتاجية الفنيين': m.productivity,
          'إجمالي المصروفات': m.totalExpenses,
          'صافي التدفق': m.netCashFlow
        }))
      : [];

    const invoiceRows = (invoices || [])
      .filter(inv => inv && isWithinDateRange(inv.date, startDate, endDate))
      .map(inv => ({
        'رقم الفاتورة': inv.id,
        'التاريخ': inv.date,
        'النوع': inv.type,
        'العميل / الفني': inv.customerName || '--',
        ...(canViewFinancials ? {
          'الإجمالي': getSafeAmount(inv, ['total']),
          'الخصم': Number(inv.discount || 0),
          'الصافي': getSafeAmount(inv, ['netTotal', 'total'])
        } : {}),
        'عدد البنود': Array.isArray(inv.items) ? inv.items.length : 0
      }));

    const purchaseRows = (purchaseInvoices || [])
      .filter(p => p && isWithinDateRange(p.date, startDate, endDate))
      .map(p => ({
        'المعرف': p.id,
        'التاريخ': p.date,
        'المورد': p.supplierName || '--',
        'الحالة': p.status === 'draft' ? 'مسودة' : 'معتمدة',
        ...(canViewFinancials ? {
          'الصافي': getSafeAmount(p, ['netTotal', 'total']),
          'الخصم': Number(p.discount || 0)
        } : {}),
        'عدد الأصناف': Array.isArray(p.items) ? p.items.length : 0
      }));

    const woRows: Record<string, any>[] = [];
    (workOrders || [])
      .filter(wo => wo && isWithinDateRange(wo.date, startDate, endDate))
      .forEach(wo => {
        (wo.items || []).forEach((it: any) => {
          woRows.push({
            'أمر التصنيع': wo.id,
            'تاريخ البدء': wo.date,
            'الرقم التسلسلي': it.serialNumber || '--',
            'الوصف': it.desc || '--',
            'حالة التصنيع': it.mfgStatus || it.status || 'قيد التصنيع',
            'حالة البيع': it.status === 'مباع' ? 'مباع' : 'غير مباع',
            'مدة الإنجاز (أيام)': getItemLeadTimeDays(wo.date, it) ?? '--'
          });
        });
      });

    exportMultiSheetExcel('تقرير_الأداء_الشامل_شمس', [
      { sheetName: 'التدفق الشهري', rows: monthlyRows },
      { sheetName: 'فواتير الصادر والإنتاجية', rows: invoiceRows },
      { sheetName: 'فواتير المشتريات', rows: purchaseRows },
      { sheetName: 'أوامر التصنيع', rows: woRows }
    ]);

    logAudit({
      actionType: 'export',
      entityType: 'التقارير والأداء',
      title: 'تصدير تقرير الأداء الشامل (Excel)',
      details: `الفترة: ${startDate || 'البداية'} إلى ${endDate || 'الآن'}`
    });
  };

  const tabs = [
    { id: 'executive', label: 'الملخص التنفيذي', icon: BarChart3 },
    { id: 'sales', label: 'المبيعات والعملاء', icon: TrendingUp },
    { id: 'production', label: 'الإنتاج والفنيين', icon: Factory },
    { id: 'purchases', label: 'المشتريات والشحن', icon: ShoppingBag },
    { id: 'hr_audit', label: 'الموارد البشرية والرقابة', icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header & Unified Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">التقارير وتحليل الأداء</h1>
              <p className="text-xs text-slate-500">تحليلات شاملة للمبيعات، الإنتاج، الفنيين، المشتريات، الشحن، والموارد البشرية</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {canExport && (
              <button
                onClick={handleExportAll}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>تصدير Excel شامل</span>
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير</span>
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs font-bold text-slate-500 ml-1">
              <Filter className="w-3.5 h-3.5" />
              الفترة:
            </span>
            {PRESET_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => handlePresetChange(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  preset === opt.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-bold text-slate-500">من</span>
              <input
                type="date"
                value={startDate}
                onChange={e => { setPreset('custom'); setStartDate(e.target.value); }}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-bold text-slate-500">إلى</span>
              <input
                type="date"
                value={endDate}
                onChange={e => { setPreset('custom'); setEndDate(e.target.value); }}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation */}
      <SubTabNav
        tabs={tabs}
        activeTab={subTab}
        onChange={setSubTab}
        title="أقسام التحليل"
        description={startDate || endDate ? `النطاق: ${startDate || 'البداية'} ← ${endDate || 'اليوم'}` : 'كافة السجلات التاريخية'}
      />

      {/* Tab Content */}
      {subTab === 'executive' && (
        <ExecutiveTab
          canViewFinancials={canViewFinancials}
          totalSales={executiveMetrics.totalSales}
          finalInvoicesCount={executiveMetrics.finalInvoicesCount}
          preliminaryInvoicesCount={executiveMetrics.preliminaryInvoicesCount}
          preliminaryTotal={executiveMetrics.preliminaryTotal}
          totalPurchases={executiveMetrics.totalPurchases}
          purchasesCount={executiveMetrics.purchasesCount}
          draftPurchasesCount={executiveMetrics.draftPurchasesCount}
          totalPayrollAndSettlements={executiveMetrics.totalPayrollAndSettlements}
          totalProductivityCost={executiveMetrics.totalProductivityCost}
          netOperatingCashFlow={executiveMetrics.netOperatingCashFlow}
          totalDiscounts={executiveMetrics.totalDiscounts}
          deletedInvoicesCount={executiveMetrics.deletedInvoicesCount}
          readyUnsoldCount={executiveMetrics.readyUnsoldCount}
          inProgressWorkOrdersCount={executiveMetrics.inProgressWorkOrdersCount}
          avgCompletionDays={executiveMetrics.avgCompletionDays}
          monthlySeries={executiveMetrics.monthlySeries}
          bottleneckSectionName={executiveMetrics.bottleneckSectionName}
          bottleneckAvgDays={executiveMetrics.bottleneckAvgDays}
          onNavigateTab={setActiveTab}
        />
      )}

      {subTab === 'sales' && (
        <SalesCustomersTab
          invoices={invoices}
          deletedInvoices={deletedInvoices}
          estimates={estimates}
          estimateCategories={estimateCategories}
          startDate={startDate}
          endDate={endDate}
          canViewFinancials={canViewFinancials}
        />
      )}

      {subTab === 'production' && (
        <ProductionTechniciansTab
          workOrders={workOrders}
          invoices={invoices}
          worksOf={worksOf}
          startDate={startDate}
          endDate={endDate}
          canViewFinancials={canViewFinancials}
        />
      )}

      {subTab === 'purchases' && (
        <PurchasesLogisticsTab
          purchaseInvoices={purchaseInvoices}
          shippingOrders={shippingOrders}
          drivers={drivers}
          startDate={startDate}
          endDate={endDate}
          canViewFinancials={canViewFinancials}
        />
      )}

      {subTab === 'hr_audit' && (
        <HRAuditTab
          employees={employees}
          payrollRecords={payrollRecords}
          transactions={transactions}
          leaves={leaves}
          settlements={settlements}
          auditLogs={auditLogs}
          printStats={printStats}
          startDate={startDate}
          endDate={endDate}
          canViewFinancials={canViewFinancials}
        />
      )}
    </div>
  );
};
