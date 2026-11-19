import React, { useMemo, useState } from 'react';
import { ShoppingBag, Truck, TrendingUp, AlertCircle, Search, MapPin } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { KpiCard, HorizontalBarList } from './ReportCharts';
import { getSafeAmount, isWithinDateRange } from './reportUtils';

interface PurchasesLogisticsTabProps {
  purchaseInvoices: any[];
  shippingOrders: any[];
  drivers: any[];
  startDate: string;
  endDate: string;
  canViewFinancials: boolean;
}

export const PurchasesLogisticsTab: React.FC<PurchasesLogisticsTabProps> = ({
  purchaseInvoices,
  shippingOrders,
  drivers,
  startDate,
  endDate,
  canViewFinancials,
}) => {
  const [materialSearch, setMaterialSearch] = useState('');

  const data = useMemo(() => {
    const filteredPurchases = (purchaseInvoices || []).filter(p => p && isWithinDateRange(p.date, startDate, endDate));
    const completed = filteredPurchases.filter(p => p.status !== 'draft');
    const drafts = filteredPurchases.filter(p => p.status === 'draft');

    let totalPurchases = 0;
    let totalPurchaseDiscounts = 0;

    const supplierMap = new Map<string, { name: string; count: number; totalNet: number; discount: number; lastDate: string }>();
    const materialPriceMap = new Map<string, {
      name: string;
      unit: string;
      totalQty: number;
      totalSpend: number;
      minPrice: number;
      maxPrice: number;
      firstDate: string;
      firstPrice: number;
      latestDate: string;
      latestPrice: number;
      occurrences: number;
    }>();

    completed.forEach(pinv => {
      const net = getSafeAmount(pinv, ['netTotal', 'total']);
      const disc = Number(pinv.discount || 0);
      totalPurchases += net;
      totalPurchaseDiscounts += disc;

      const sName = (pinv.supplierName || 'مورد غير محدد').trim();
      const sCur = supplierMap.get(sName) || { name: sName, count: 0, totalNet: 0, discount: 0, lastDate: '' };
      sCur.count += 1;
      sCur.totalNet += net;
      sCur.discount += disc;
      if (pinv.date && (!sCur.lastDate || String(pinv.date) > sCur.lastDate)) {
        sCur.lastDate = String(pinv.date);
      }
      supplierMap.set(sName, sCur);

      if (Array.isArray(pinv.items)) {
        pinv.items.forEach((it: any) => {
          const itemName = (it.itemName || '').trim();
          const unitPrice = Number(it.unitPrice || 0);
          const qty = Number(it.qty || 0);
          const totalPrice = Number(it.totalPrice || unitPrice * qty);
          if (!itemName) return;

          const pDate = String(pinv.date || '');
          const cur = materialPriceMap.get(itemName);
          if (!cur) {
            materialPriceMap.set(itemName, {
              name: itemName,
              unit: it.unit || '--',
              totalQty: qty,
              totalSpend: totalPrice,
              minPrice: unitPrice,
              maxPrice: unitPrice,
              firstDate: pDate,
              firstPrice: unitPrice,
              latestDate: pDate,
              latestPrice: unitPrice,
              occurrences: 1
            });
          } else {
            cur.totalQty += qty;
            cur.totalSpend += totalPrice;
            cur.occurrences += 1;
            if (unitPrice > 0 && (cur.minPrice === 0 || unitPrice < cur.minPrice)) cur.minPrice = unitPrice;
            if (unitPrice > cur.maxPrice) cur.maxPrice = unitPrice;
            if (pDate && (!cur.firstDate || pDate < cur.firstDate)) {
              cur.firstDate = pDate;
              cur.firstPrice = unitPrice;
            }
            if (pDate && (!cur.latestDate || pDate >= cur.latestDate)) {
              cur.latestDate = pDate;
              cur.latestPrice = unitPrice;
            }
          }
        });
      }
    });

    const suppliersList = Array.from(supplierMap.values()).sort((a, b) => b.totalNet - a.totalNet);
    const materialsList = Array.from(materialPriceMap.values())
      .map(m => {
        const changePct = m.firstPrice > 0 && m.occurrences > 1
          ? ((m.latestPrice - m.firstPrice) / m.firstPrice) * 100
          : 0;
        return { ...m, changePct };
      })
      .sort((a, b) => b.totalSpend - a.totalSpend);

    // Shipping & Drivers
    const filteredShipping = (shippingOrders || []).filter(so => so && isWithinDateRange(so.date, startDate, endDate));
    const driverInfoMap = new Map<string, any>();
    (drivers || []).forEach(d => {
      if (d?.name) driverInfoMap.set(d.name.trim(), d);
    });

    const driverTripsMap = new Map<string, { name: string; truckNumber: string; trips: number; itemsShipped: number }>();
    const destMap = new Map<string, number>();

    filteredShipping.forEach(so => {
      const dName = (so.driver?.name || so.driverName || 'سائق غير محدد').trim();
      const truck = so.driver?.truckNumber || so.truckNumber || driverInfoMap.get(dName)?.truckNumber || '--';
      const itemsCount = Array.isArray(so.items) ? so.items.length : 0;

      const curD = driverTripsMap.get(dName) || { name: dName, truckNumber: truck, trips: 0, itemsShipped: 0 };
      curD.trips += 1;
      curD.itemsShipped += itemsCount;
      driverTripsMap.set(dName, curD);

      const dest = (so.destination || 'غير محددة').trim();
      destMap.set(dest, (destMap.get(dest) || 0) + 1);
    });

    const driversRanking = Array.from(driverTripsMap.values()).sort((a, b) => b.trips - a.trips);
    const destinationsRanking = Array.from(destMap.entries())
      .map(([dest, count]) => ({ dest, count }))
      .sort((a, b) => b.count - a.count);

    return {
      completedCount: completed.length,
      draftCount: drafts.length,
      totalPurchases,
      totalPurchaseDiscounts,
      suppliersList,
      materialsList,
      shippingCount: filteredShipping.length,
      driversRanking,
      destinationsRanking
    };
  }, [purchaseInvoices, shippingOrders, drivers, startDate, endDate]);

  const filteredMaterials = useMemo(() => {
    const q = materialSearch.trim().toLowerCase();
    if (!q) return data.materialsList;
    return data.materialsList.filter(m => m.name.toLowerCase().includes(q));
  }, [data.materialsList, materialSearch]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="المشتريات المعتمدة"
          value={canViewFinancials ? `${formatCurrency(data.totalPurchases)} د.ل` : `${data.completedCount} فاتورة`}
          subtitle={`${data.completedCount} فاتورة | خصومات: ${canViewFinancials ? formatCurrency(data.totalPurchaseDiscounts) : '--'}`}
          icon={ShoppingBag}
          theme="amber"
        />
        <KpiCard
          title="فواتير مشتريات مسودة"
          value={`${data.draftCount} مسودة`}
          subtitle="بانتظار الاعتماد والاستكمال"
          icon={AlertCircle}
          theme={data.draftCount > 0 ? 'rose' : 'slate'}
        />
        <KpiCard
          title="أوامر النقل والشحن"
          value={`${data.shippingCount} رحلة`}
          subtitle={`سائقون نشطون: ${data.driversRanking.length}`}
          icon={Truck}
          theme="blue"
        />
        <KpiCard
          title="أكثر وجهة شحناً"
          value={data.destinationsRanking[0]?.dest || '--'}
          subtitle={data.destinationsRanking[0] ? `${data.destinationsRanking[0].count} أمر نقل` : 'لا توجد رحلات'}
          icon={MapPin}
          theme="teal"
        />
      </div>

      {/* Suppliers & Shipping Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h3 className="font-black text-slate-900 text-base mb-1">كبار الموردين</h3>
          <p className="text-xs text-slate-500 mb-4">أكثر الموردين تعاملاً من حيث القيمة وعدد فواتير الشراء</p>
          <HorizontalBarList
            items={data.suppliersList.slice(0, 7).map(s => ({
              id: s.name,
              label: s.name,
              value: canViewFinancials ? s.totalNet : s.count,
              displayValue: canViewFinancials ? `${formatCurrency(s.totalNet)} د.ل (${s.count})` : `${s.count} فاتورة`,
              subLabel: `آخر فاتورة: ${s.lastDate || '--'}`,
              colorClass: 'bg-amber-500'
            }))}
            emptyMessage="لا توجد فواتير مشتريات معتمدة في هذه الفترة"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-6">
          <div>
            <h3 className="font-black text-slate-900 text-base mb-1">أداء السائقين وأوامر النقل</h3>
            <p className="text-xs text-slate-500 mb-4">عدد الرحلات والوحدات المنقولة لكل سائق</p>
            <HorizontalBarList
              items={data.driversRanking.slice(0, 5).map(d => ({
                id: d.name,
                label: d.name,
                value: d.trips,
                displayValue: `${d.trips} رحلة (${d.itemsShipped} بند)`,
                subLabel: d.truckNumber !== '--' ? `شاحنة: ${d.truckNumber}` : undefined,
                colorClass: 'bg-blue-600'
              }))}
              emptyMessage="لا توجد أوامر نقل مسجلة في هذه الفترة"
            />
          </div>

          {data.destinationsRanking.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <div className="text-xs font-black text-slate-700 mb-2">أهم الوجهات:</div>
              <div className="flex flex-wrap gap-2">
                {data.destinationsRanking.slice(0, 8).map(d => (
                  <span key={d.dest} className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200">
                    {d.dest} <span className="text-blue-600 font-mono mr-1">({d.count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Material Price Variance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">تتبع أسعار المواد المشتراة ({filteredMaterials.length})</h3>
              <p className="text-xs text-slate-500">مقارنة أدنى وأعلى وآخر سعر شراء للمواد عبر فواتير الموردين</p>
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={materialSearch}
              onChange={e => setMaterialSearch(e.target.value)}
              placeholder="بحث باسم المادة..."
              className="w-full pr-9 pl-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3.5 font-bold">اسم الصنف / المادة</th>
                <th className="p-3.5 font-bold text-center">إجمالي الكمية</th>
                {canViewFinancials && <th className="p-3.5 font-bold">أدنى سعر</th>}
                {canViewFinancials && <th className="p-3.5 font-bold">أعلى سعر</th>}
                {canViewFinancials && <th className="p-3.5 font-bold">آخر سعر</th>}
                {canViewFinancials && <th className="p-3.5 font-bold text-center">التغيّر</th>}
                {canViewFinancials && <th className="p-3.5 font-bold">إجمالي الإنفاق</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={canViewFinancials ? 7 : 2} className="p-8 text-center text-slate-400">
                    لا توجد أصناف مشتراة مطابقة في هذه الفترة
                  </td>
                </tr>
              ) : (
                filteredMaterials.slice(0, 30).map(m => (
                  <tr key={m.name} className="hover:bg-slate-50">
                    <td className="p-3.5 font-bold text-slate-900">
                      {m.name}
                      <span className="text-[11px] font-normal text-slate-400 mr-1.5">({m.unit})</span>
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-slate-700">{m.totalQty}</td>
                    {canViewFinancials && <td className="p-3.5 font-mono text-emerald-700">{formatCurrency(m.minPrice)}</td>}
                    {canViewFinancials && <td className="p-3.5 font-mono text-rose-700">{formatCurrency(m.maxPrice)}</td>}
                    {canViewFinancials && <td className="p-3.5 font-mono font-bold text-slate-900">{formatCurrency(m.latestPrice)}</td>}
                    {canViewFinancials && (
                      <td className="p-3.5 text-center">
                        {m.occurrences > 1 && Math.abs(m.changePct) > 0.1 ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono ${
                            m.changePct > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {m.changePct > 0 ? `+${m.changePct.toFixed(1)}%` : `${m.changePct.toFixed(1)}%`}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">ثابت</span>
                        )}
                      </td>
                    )}
                    {canViewFinancials && <td className="p-3.5 font-mono font-black text-slate-900">{formatCurrency(m.totalSpend)} د.ل</td>}
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
