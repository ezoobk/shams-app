import React, { useMemo, useState } from 'react';
import { FileCheck2, FileText, Percent, Trash2, Users, Search, Calculator } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { KpiCard, HorizontalBarList, DonutBreakdownChart, EmptyReportState } from './ReportCharts';
import { getSafeAmount, isWithinDateRange } from './reportUtils';

interface SalesCustomersTabProps {
  invoices: any[];
  deletedInvoices: any[];
  estimates: any[];
  estimateCategories: any[];
  startDate: string;
  endDate: string;
  canViewFinancials: boolean;
}

export const SalesCustomersTab: React.FC<SalesCustomersTabProps> = ({
  invoices,
  deletedInvoices,
  estimates,
  estimateCategories,
  startDate,
  endDate,
  canViewFinancials,
}) => {
  const [customerSearch, setCustomerSearch] = useState('');

  const data = useMemo(() => {
    const filteredInv = (invoices || []).filter(inv => inv && isWithinDateRange(inv.date, startDate, endDate));
    const finalInvs = filteredInv.filter(inv => inv.type === 'نهائية');
    const prelimInvs = filteredInv.filter(inv => inv.type === 'مبدئية');
    const filteredDeleted = (deletedInvoices || []).filter(inv => inv && isWithinDateRange(inv.date, startDate, endDate));

    let finalTotal = 0;
    let finalGross = 0;
    let totalDiscounts = 0;
    let productRev = 0;
    let customRev = 0;
    let materialRev = 0;

    const customerMap = new Map<string, {
      name: string;
      invoiceCount: number;
      prelimCount: number;
      totalNet: number;
      totalDiscount: number;
      lastDate: string;
    }>();

    finalInvs.forEach(inv => {
      const net = getSafeAmount(inv, ['netTotal', 'total', 'totalAmount']);
      const gross = getSafeAmount(inv, ['total', 'netTotal']);
      const disc = Number(inv.discount || 0);
      finalTotal += net;
      finalGross += gross;
      totalDiscounts += disc;

      const cName = (inv.customerName || 'عميل غير محدد').trim();
      const prev = customerMap.get(cName) || {
        name: cName,
        invoiceCount: 0,
        prelimCount: 0,
        totalNet: 0,
        totalDiscount: 0,
        lastDate: ''
      };
      prev.invoiceCount += 1;
      prev.totalNet += net;
      prev.totalDiscount += disc;
      if (inv.date && (!prev.lastDate || String(inv.date) > prev.lastDate)) {
        prev.lastDate = String(inv.date);
      }
      customerMap.set(cName, prev);

      if (Array.isArray(inv.items)) {
        inv.items.forEach((item: any) => {
          const lineAmt = Number(item.sellPrice || 0) * Number(item.requestedQty || 1);
          if (item.isMaterial) materialRev += lineAmt;
          else if (item.isCustom) customRev += lineAmt;
          else productRev += lineAmt;
        });
      }
    });

    prelimInvs.forEach(inv => {
      const cName = (inv.customerName || 'عميل غير محدد').trim();
      const prev = customerMap.get(cName) || {
        name: cName,
        invoiceCount: 0,
        prelimCount: 0,
        totalNet: 0,
        totalDiscount: 0,
        lastDate: ''
      };
      prev.prelimCount += 1;
      customerMap.set(cName, prev);
    });

    const customersList = Array.from(customerMap.values()).sort((a, b) => b.totalNet - a.totalNet);

    // Estimates analysis
    const filteredEstimates = (estimates || []).filter(est => est && isWithinDateRange(est.date, startDate, endDate));
    const catNameMap = new Map<string, string>();
    (estimateCategories || []).forEach(c => {
      if (c?.id) catNameMap.set(String(c.id), c.name || 'غير مصنف');
    });

    const catStatsMap = new Map<string, { name: string; count: number; totalSell: number; totalCost: number; avgProfitSum: number }>();
    filteredEstimates.forEach(est => {
      const catId = est.categoryId ? String(est.categoryId) : 'uncategorized';
      const catName = catNameMap.get(catId) || 'غير مصنف';
      const cur = catStatsMap.get(catId) || { name: catName, count: 0, totalSell: 0, totalCost: 0, avgProfitSum: 0 };
      cur.count += 1;
      cur.totalSell += Number(est.sellPrice || 0);
      cur.totalCost += Number(est.totalCost || 0);
      cur.avgProfitSum += Number(est.profitPercentage || 0);
      catStatsMap.set(catId, cur);
    });

    const categoryStats = Array.from(catStatsMap.values()).sort((a, b) => b.count - a.count);
    const avgEstimateProfit = filteredEstimates.length > 0
      ? filteredEstimates.reduce((s, e) => s + Number(e.profitPercentage || 0), 0) / filteredEstimates.length
      : 0;

    const discountPct = finalGross > 0 ? (totalDiscounts / finalGross) * 100 : 0;

    return {
      finalCount: finalInvs.length,
      prelimCount: prelimInvs.length,
      deletedCount: filteredDeleted.length,
      deletedTotal: filteredDeleted.reduce((s, d) => s + getSafeAmount(d, ['netTotal', 'total']), 0),
      finalTotal,
      totalDiscounts,
      discountPct,
      avgInvoice: finalInvs.length > 0 ? finalTotal / finalInvs.length : 0,
      productRev,
      customRev,
      materialRev,
      customersList,
      filteredEstimatesCount: filteredEstimates.length,
      avgEstimateProfit,
      categoryStats
    };
  }, [invoices, deletedInvoices, estimates, estimateCategories, startDate, endDate]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return data.customersList;
    return data.customersList.filter(c => c.name.toLowerCase().includes(q));
  }, [data.customersList, customerSearch]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="الفواتير النهائية"
          value={`${data.finalCount} فاتورة`}
          subtitle={canViewFinancials ? `متوسط الفاتورة: ${formatCurrency(data.avgInvoice)} د.ل` : 'إجمالي الفواتير المعتمدة'}
          badgeText={canViewFinancials ? `${formatCurrency(data.finalTotal)} د.ل` : undefined}
          icon={FileCheck2}
          theme="blue"
        />
        <KpiCard
          title="الفواتير المبدئية والمحذوفة"
          value={`${data.prelimCount} مبدئية`}
          subtitle={`محذوفة: ${data.deletedCount} فاتورة`}
          badgeText={canViewFinancials && data.deletedCount > 0 ? `محذوف: ${formatCurrency(data.deletedTotal)}` : undefined}
          icon={data.deletedCount > 0 ? Trash2 : FileText}
          theme="amber"
        />
        <KpiCard
          title="نسبة وحجم الخصومات"
          value={canViewFinancials ? `${data.discountPct.toFixed(1)}%` : '--'}
          subtitle={canViewFinancials ? `إجمالي الخصم: ${formatCurrency(data.totalDiscounts)} د.ل` : 'يتطلب صلاحية مالية'}
          icon={Percent}
          theme="rose"
        />
        <KpiCard
          title="المقايسات وهامش الربح"
          value={`${data.filteredEstimatesCount} مقايسة`}
          subtitle={canViewFinancials ? `متوسط هامش الربح: ${data.avgEstimateProfit.toFixed(1)}%` : 'تقديرات التكلفة المسجلة'}
          icon={Calculator}
          theme="emerald"
        />
      </div>

      {/* Revenue Mix & Estimates by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h3 className="font-black text-slate-900 text-base mb-1">مصادر إيرادات المبيعات</h3>
          <p className="text-xs text-slate-500 mb-4">توزيع بنود الفواتير النهائية بين المنتجات المصنّعة، البنود المخصصة، والمواد</p>
          {canViewFinancials ? (
            <DonutBreakdownChart
              slices={[
                { label: 'منتجات مصنّعة (برقم تسلسلي)', value: data.productRev, displayValue: `${formatCurrency(data.productRev)} د.ل`, color: '#2563eb' },
                { label: 'بنود مخصصة / خدمات', value: data.customRev, displayValue: `${formatCurrency(data.customRev)} د.ل`, color: '#8b5cf6' },
                { label: 'مواد خام وقطع', value: data.materialRev, displayValue: `${formatCurrency(data.materialRev)} د.ل`, color: '#10b981' },
              ]}
              centerLabel="إجمالي البنود"
              centerValue={formatCurrency(data.productRev + data.customRev + data.materialRev)}
            />
          ) : (
            <EmptyReportState message="يتطلب صلاحية عرض البيانات المالية" />
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h3 className="font-black text-slate-900 text-base mb-1">المقايسات حسب الفئة</h3>
          <p className="text-xs text-slate-500 mb-4">أكثر تصنيفات المقايسات طلباً ومتوسط هامش الربح المستهدف فيها</p>
          <HorizontalBarList
            items={data.categoryStats.slice(0, 6).map(cat => ({
              id: cat.name,
              label: cat.name,
              value: cat.count,
              displayValue: canViewFinancials
                ? `${cat.count} مقايسة (${(cat.avgProfitSum / cat.count).toFixed(1)}% ربح)`
                : `${cat.count} مقايسة`,
              subLabel: canViewFinancials ? `إجمالي البيع: ${formatCurrency(cat.totalSell)}` : undefined,
              colorClass: 'bg-emerald-600'
            }))}
            emptyMessage="لا توجد مقايسات في هذه الفترة"
          />
        </div>
      </div>

      {/* Customers Ranking Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">تقرير أداء العملاء ({filteredCustomers.length})</h3>
              <p className="text-xs text-slate-500">ترتيب العملاء حسب إجمالي المشتريات وعدد الفواتير وتاريخ آخر تعامل</p>
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={customerSearch}
              onChange={e => setCustomerSearch(e.target.value)}
              placeholder="بحث باسم العميل..."
              className="w-full pr-9 pl-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3.5 font-bold">#</th>
                <th className="p-3.5 font-bold">اسم العميل</th>
                <th className="p-3.5 font-bold text-center">فواتير نهائية</th>
                <th className="p-3.5 font-bold text-center">فواتير مبدئية</th>
                {canViewFinancials && <th className="p-3.5 font-bold">إجمالي المبيعات</th>}
                {canViewFinancials && <th className="p-3.5 font-bold">الخصومات</th>}
                <th className="p-3.5 font-bold">آخر تعامل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={canViewFinancials ? 7 : 5} className="p-8 text-center text-slate-400 font-medium">
                    لا توجد معاملات عملاء مطابقة للبحث أو الفترة المحددة
                  </td>
                </tr>
              ) : (
                filteredCustomers.slice(0, 30).map((c, idx) => (
                  <tr key={c.name} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono text-slate-400 font-bold">{idx + 1}</td>
                    <td className="p-3.5 font-bold text-slate-900">{c.name}</td>
                    <td className="p-3.5 text-center">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-xs">{c.invoiceCount}</span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold text-xs">{c.prelimCount}</span>
                    </td>
                    {canViewFinancials && (
                      <td className="p-3.5 font-mono font-black text-slate-900">{formatCurrency(c.totalNet)} د.ل</td>
                    )}
                    {canViewFinancials && (
                      <td className="p-3.5 font-mono text-rose-600">{formatCurrency(c.totalDiscount)} د.ل</td>
                    )}
                    <td className="p-3.5 font-mono text-slate-500 text-xs">{c.lastDate || '--'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
