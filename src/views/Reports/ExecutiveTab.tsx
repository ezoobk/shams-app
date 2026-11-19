import React from 'react';
import {
  TrendingUp, TrendingDown, ShoppingBag, Factory, AlertTriangle, CheckCircle2, FileWarning, DollarSign
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { KpiCard, MonthlyComparisonChart, DonutBreakdownChart, HorizontalBarList } from './ReportCharts';
import type { MonthlySeriesPoint } from './reportUtils';

interface ExecutiveTabProps {
  canViewFinancials: boolean;
  totalSales: number;
  finalInvoicesCount: number;
  preliminaryInvoicesCount: number;
  preliminaryTotal: number;
  totalPurchases: number;
  purchasesCount: number;
  draftPurchasesCount: number;
  totalPayrollAndSettlements: number;
  totalProductivityCost: number;
  netOperatingCashFlow: number;
  totalDiscounts: number;
  deletedInvoicesCount: number;
  readyUnsoldCount: number;
  inProgressWorkOrdersCount: number;
  avgCompletionDays: number | null;
  monthlySeries: MonthlySeriesPoint[];
  bottleneckSectionName: string | null;
  bottleneckAvgDays: number | null;
  onNavigateTab?: (tabId: string) => void;
}

export const ExecutiveTab: React.FC<ExecutiveTabProps> = ({
  canViewFinancials,
  totalSales,
  finalInvoicesCount,
  preliminaryInvoicesCount,
  preliminaryTotal,
  totalPurchases,
  purchasesCount,
  draftPurchasesCount,
  totalPayrollAndSettlements,
  totalProductivityCost,
  netOperatingCashFlow,
  totalDiscounts,
  deletedInvoicesCount,
  readyUnsoldCount,
  inProgressWorkOrdersCount,
  avgCompletionDays,
  monthlySeries,
  bottleneckSectionName,
  bottleneckAvgDays,
}) => {
  const totalOutflows = totalPurchases + totalPayrollAndSettlements + totalProductivityCost;
  const conversionRate = (finalInvoicesCount + preliminaryInvoicesCount) > 0
    ? Math.round((finalInvoicesCount / (finalInvoicesCount + preliminaryInvoicesCount)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="إجمالي المبيعات النهائية"
          value={canViewFinancials ? `${formatCurrency(totalSales)} د.ل` : `${finalInvoicesCount} فاتورة`}
          subtitle={canViewFinancials ? `${finalInvoicesCount} فاتورة نهائية` : 'مخفي حسب الصلاحية'}
          badgeText={`تحويل ${conversionRate}%`}
          icon={TrendingUp}
          theme="blue"
        />
        <KpiCard
          title="إجمالي المصروفات التشغيلية"
          value={canViewFinancials ? `${formatCurrency(totalOutflows)} د.ل` : `${purchasesCount} فاتورة شراء`}
          subtitle={canViewFinancials ? 'مشتريات + رواتب + إنتاجية' : 'مخفي حسب الصلاحية'}
          badgeText={`${purchasesCount} مشتريات`}
          icon={ShoppingBag}
          theme="amber"
        />
        <KpiCard
          title="صافي التدفق التشغيلي"
          value={canViewFinancials ? `${formatCurrency(netOperatingCashFlow)} د.ل` : '--'}
          subtitle={canViewFinancials ? 'المبيعات النهائية − المصروفات' : 'يتطلب صلاحية مالية'}
          badgeText={canViewFinancials ? (netOperatingCashFlow >= 0 ? 'فائض' : 'عجز') : undefined}
          icon={netOperatingCashFlow >= 0 ? DollarSign : TrendingDown}
          theme={netOperatingCashFlow >= 0 ? 'emerald' : 'rose'}
        />
        <KpiCard
          title="سرعة ومخزون التصنيع"
          value={avgCompletionDays !== null ? `${avgCompletionDays.toFixed(1)} يوم` : `${readyUnsoldCount} جاهز`}
          subtitle={`متوسط إنجاز الوحدة | قيد التصنيع: ${inProgressWorkOrdersCount}`}
          badgeText={`${readyUnsoldCount} جاهز غير مباع`}
          icon={Factory}
          theme="indigo"
        />
      </div>

      {/* Monthly Chart + Cost Structure Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-black text-slate-900 text-base">المقارنة الشهرية للتدفقات المالية</h3>
              <p className="text-xs text-slate-500">مقارنة المبيعات النهائية مع المشتريات والرواتب وفواتير الإنتاجية (آخر 12 شهراً في النطاق)</p>
            </div>
          </div>
          <MonthlyComparisonChart data={monthlySeries} canViewFinancials={canViewFinancials} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-black text-slate-900 text-base mb-1">هيكل التكاليف والمصروفات</h3>
            <p className="text-xs text-slate-500 mb-5">توزيع المصروفات التشغيلية المسجلة خلال الفترة</p>
          </div>
          {canViewFinancials ? (
            <DonutBreakdownChart
              slices={[
                { label: 'فواتير المشتريات المعتمدة', value: totalPurchases, displayValue: `${formatCurrency(totalPurchases)} د.ل`, color: '#f59e0b' },
                { label: 'الرواتب والمخالصات', value: totalPayrollAndSettlements, displayValue: `${formatCurrency(totalPayrollAndSettlements)} د.ل`, color: '#7c3aed' },
                { label: 'إنتاجية الفنيين', value: totalProductivityCost, displayValue: `${formatCurrency(totalProductivityCost)} د.ل`, color: '#14b8a6' },
              ]}
              centerLabel="الإجمالي"
              centerValue={`${formatCurrency(totalOutflows)}`}
              emptyMessage="لا توجد مصروفات مسجلة في هذه الفترة"
            />
          ) : (
            <div className="text-xs text-slate-400 text-center py-10">يتطلب صلاحية عرض البيانات المالية</div>
          )}
        </div>
      </div>

      {/* Operational Insights & Monthly Net Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Smart Operational Alerts */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h3 className="font-black text-slate-900 text-base mb-1">تنبيهات ومؤشرات ذكية</h3>
          <p className="text-xs text-slate-500 mb-4">ملخص تلقائي للنقاط التي تستحق المتابعة من بيانات النظام الحالية</p>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-bold text-slate-900">فواتير مبدئية معلّقة: {preliminaryInvoicesCount} فاتورة</div>
                <div className="text-slate-600 mt-0.5">
                  {canViewFinancials
                    ? `بقيمة إجمالية قدرها ${formatCurrency(preliminaryTotal)} د.ل بانتظار التحويل إلى نهائية.`
                    : 'توجد فواتير مبدئية بانتظار المراجعة والتحويل.'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/70 border border-blue-200/80">
              <Factory className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-bold text-slate-900">
                  {bottleneckSectionName
                    ? `أطول مرحلة تصنيع: قسم "${bottleneckSectionName}"`
                    : 'كفاءة خط التصنيع'}
                </div>
                <div className="text-slate-600 mt-0.5">
                  {bottleneckSectionName && bottleneckAvgDays !== null
                    ? `بمتوسط ${bottleneckAvgDays.toFixed(1)} يوم للإنجاز. المخزون الجاهز غير المباع حالياً: ${readyUnsoldCount} وحدة.`
                    : `المخزون الجاهز غير المباع: ${readyUnsoldCount} وحدة | قيد التصنيع: ${inProgressWorkOrdersCount} وحدة.`}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <FileWarning className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-bold text-slate-900">
                  المسودات والمحذوفات والخصومات
                </div>
                <div className="text-slate-600 mt-0.5">
                  مشتريات مسودة: <span className="font-bold">{draftPurchasesCount}</span> | فواتير مبيعات محذوفة: <span className="font-bold">{deletedInvoicesCount}</span>
                  {canViewFinancials && ` | إجمالي الخصومات الممنوحة: ${formatCurrency(totalDiscounts)} د.ل`}
                </div>
              </div>
            </div>

            {canViewFinancials && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-slate-900">توزيع التكلفة المباشرة</div>
                  <div className="text-slate-600 mt-0.5">
                    فواتير إنتاجية الفنيين: {formatCurrency(totalProductivityCost)} د.ل | الرواتب والمخالصات: {formatCurrency(totalPayrollAndSettlements)} د.ل
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Monthly Breakdown Summary List */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h3 className="font-black text-slate-900 text-base mb-1">أفضل الأشهر مبيعاً</h3>
          <p className="text-xs text-slate-500 mb-4">ترتيب الأشهر الأعلى تحقيقاً للمبيعات النهائية ضمن الفترة</p>
          {canViewFinancials ? (
            <HorizontalBarList
              items={[...monthlySeries]
                .sort((a, b) => b.sales - a.sales)
                .slice(0, 6)
                .map(m => ({
                  id: m.month,
                  label: m.label,
                  value: m.sales,
                  displayValue: `${formatCurrency(m.sales)} د.ل`,
                  subLabel: `صافي التدفق: ${formatCurrency(m.netCashFlow)}`,
                  colorClass: 'bg-blue-600'
                }))}
              emptyMessage="لا توجد مبيعات شهرية مسجلة في الفترة المختارة"
            />
          ) : (
            <div className="text-xs text-slate-400 text-center py-10">يتطلب صلاحية عرض البيانات المالية</div>
          )}
        </div>
      </div>
    </div>
  );
};
