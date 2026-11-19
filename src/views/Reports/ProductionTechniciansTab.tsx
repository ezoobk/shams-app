import React, { useMemo } from 'react';
import { Factory, Clock, PackageCheck, Wrench, Layers } from 'lucide-react';
import { calculateDurationDays, formatCurrency } from '../../utils/formatters';
import { KpiCard, HorizontalBarList, DonutBreakdownChart } from './ReportCharts';
import { getItemLeadTimeDays, getWorkOrderItemCompletionDate, isWithinDateRange } from './reportUtils';

interface ProductionTechniciansTabProps {
  workOrders: any[];
  invoices: any[];
  worksOf: any[];
  startDate: string;
  endDate: string;
  canViewFinancials: boolean;
}

export const ProductionTechniciansTab: React.FC<ProductionTechniciansTabProps> = ({
  workOrders,
  invoices,
  worksOf,
  startDate,
  endDate,
  canViewFinancials,
}) => {
  const prod = useMemo(() => {
    const soldSNs = new Set<string>();
    (invoices || [])
      .filter(inv => inv && inv.type === 'نهائية' && Array.isArray(inv.items))
      .forEach(inv => {
        inv.items.forEach((it: any) => {
          if (it.serialNumber) soldSNs.add(String(it.serialNumber).trim());
          if (Array.isArray(it.serialNumbers)) {
            it.serialNumbers.forEach((sn: string) => {
              if (sn) soldSNs.add(String(sn).trim());
            });
          }
        });
      });

    let totalItems = 0;
    let readyCount = 0;
    let inProgressCount = 0;
    let soldCount = 0;
    let readyUnsoldCount = 0;
    const leadTimes: number[] = [];

    const sectionStatsMap = new Map<string, {
      name: string;
      completedCount: number;
      pendingCount: number;
      durationSum: number;
      durationCount: number;
    }>();

    const worksOfNameMap = new Map<string, string>();
    (worksOf || []).forEach(w => {
      if (w?.id) worksOfNameMap.set(String(w.id), w.name || 'قسم');
    });

    const readyUnsoldItems: Array<{
      woId: string;
      desc: string;
      serialNumber: string;
      chassis: string;
      readyDate: string;
      daysInStock: number | null;
    }> = [];

    const today = new Date();

    (workOrders || []).forEach(wo => {
      if (!wo || !isWithinDateRange(wo.date, startDate, endDate)) return;
      (wo.items || []).forEach((item: any) => {
        totalItems++;
        const mfgStatus = item.mfgStatus || (item.status === 'جاهز' ? 'جاهز' : 'قيد التصنيع');
        const sn = item.serialNumber ? String(item.serialNumber).trim() : '';
        const isSold = item.status === 'مباع' || (sn !== '' && soldSNs.has(sn));

        if (mfgStatus === 'جاهز') {
          readyCount++;
          const lt = getItemLeadTimeDays(wo.date, item);
          if (lt !== null) leadTimes.push(lt);

          if (isSold) {
            soldCount++;
          } else {
            readyUnsoldCount++;
            const readyDate = getWorkOrderItemCompletionDate(item) || wo.date || '';
            const daysInStock = readyDate ? calculateDurationDays(readyDate, today) : null;
            readyUnsoldItems.push({
              woId: wo.id,
              desc: item.desc || '--',
              serialNumber: sn || '--',
              chassis: item.chassis || '--',
              readyDate: readyDate ? String(readyDate).slice(0, 10) : '--',
              daysInStock
            });
          }
        } else {
          inProgressCount++;
        }

        if (Array.isArray(item.sectionStatuses)) {
          item.sectionStatuses.forEach((sec: any) => {
            if (!sec?.sectionId && !sec?.sectionName) return;
            const key = String(sec.sectionId || sec.sectionName);
            const name = worksOfNameMap.get(key) || sec.sectionName || `قسم ${key}`;
            const cur = sectionStatsMap.get(key) || {
              name,
              completedCount: 0,
              pendingCount: 0,
              durationSum: 0,
              durationCount: 0
            };
            if (sec.isCompleted) {
              cur.completedCount += 1;
              let dur = typeof sec.durationDays === 'number' ? sec.durationDays : null;
              if (dur === null && wo.date && sec.completedAt) {
                dur = calculateDurationDays(wo.date, sec.completedAt);
              }
              if (dur !== null && !isNaN(dur)) {
                cur.durationSum += dur;
                cur.durationCount += 1;
              }
            } else {
              cur.pendingCount += 1;
            }
            sectionStatsMap.set(key, cur);
          });
        }
      });
    });

    const avgLeadTime = leadTimes.length > 0
      ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
      : null;

    const sectionStats = Array.from(sectionStatsMap.values())
      .map(s => ({
        ...s,
        avgDays: s.durationCount > 0 ? s.durationSum / s.durationCount : 0
      }))
      .sort((a, b) => b.avgDays - a.avgDays);

    readyUnsoldItems.sort((a, b) => (b.daysInStock || 0) - (a.daysInStock || 0));

    // Technicians / Productivity Invoices
    const techMap = new Map<string, { name: string; invoiceCount: number; unitCount: number; totalCost: number; specialties: Set<string> }>();
    const specMap = new Map<string, { name: string; unitCount: number; totalCost: number }>();
    let totalProdCost = 0;
    let totalProdUnits = 0;

    (invoices || [])
      .filter(inv => inv && inv.type === 'إنتاجية' && isWithinDateRange(inv.date, startDate, endDate))
      .forEach(inv => {
        const items = Array.isArray(inv.items) ? inv.items : [];
        const invCost = Number(inv.netTotal ?? inv.total ?? 0);
        totalProdCost += invCost;

        if (items.length === 0) {
          const tName = (inv.customerName || 'فني غير محدد').trim();
          const cur = techMap.get(tName) || { name: tName, invoiceCount: 0, unitCount: 0, totalCost: 0, specialties: new Set<string>() };
          cur.invoiceCount += 1;
          cur.totalCost += invCost;
          techMap.set(tName, cur);
          return;
        }

        const seenInvsForTech = new Set<string>();
        items.forEach((it: any) => {
          const tName = (it.technicianName || inv.customerName || 'فني غير محدد').trim();
          const spec = (it.specialty || 'إنتاجية عامة').trim();
          const qty = Number(it.requestedQty || 1);
          const lineCost = Number(it.sellPrice || 0) * qty;
          totalProdUnits += qty;

          const curTech = techMap.get(tName) || { name: tName, invoiceCount: 0, unitCount: 0, totalCost: 0, specialties: new Set<string>() };
          if (!seenInvsForTech.has(tName)) {
            curTech.invoiceCount += 1;
            seenInvsForTech.add(tName);
          }
          curTech.unitCount += qty;
          curTech.totalCost += lineCost;
          curTech.specialties.add(spec);
          techMap.set(tName, curTech);

          const curSpec = specMap.get(spec) || { name: spec, unitCount: 0, totalCost: 0 };
          curSpec.unitCount += qty;
          curSpec.totalCost += lineCost;
          specMap.set(spec, curSpec);
        });
      });

    const technicians = Array.from(techMap.values()).sort((a, b) => b.totalCost - a.totalCost);
    const specialties = Array.from(specMap.values()).sort((a, b) => b.totalCost - a.totalCost);

    return {
      totalItems,
      readyCount,
      inProgressCount,
      soldCount,
      readyUnsoldCount,
      avgLeadTime,
      sectionStats,
      readyUnsoldItems,
      technicians,
      specialties,
      totalProdCost,
      totalProdUnits
    };
  }, [workOrders, invoices, worksOf, startDate, endDate]);

  const specColors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0d9488', '#e11d48'];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="إجمالي بنود التصنيع"
          value={`${prod.totalItems} وحدة`}
          subtitle={`جاهز: ${prod.readyCount} | قيد التصنيع: ${prod.inProgressCount}`}
          icon={Factory}
          theme="blue"
        />
        <KpiCard
          title="متوسط زمن دورة التصنيع"
          value={prod.avgLeadTime !== null ? `${prod.avgLeadTime.toFixed(1)} يوم` : '--'}
          subtitle="من تاريخ أمر التصنيع حتى الجاهزية"
          icon={Clock}
          theme="indigo"
        />
        <KpiCard
          title="المخزون الجاهز غير المباع"
          value={`${prod.readyUnsoldCount} وحدة`}
          subtitle={`تم بيع ${prod.soldCount} وحدة جاهزة`}
          icon={PackageCheck}
          theme="amber"
        />
        <KpiCard
          title="تكلفة إنتاجية الفنيين"
          value={canViewFinancials ? `${formatCurrency(prod.totalProdCost)} د.ل` : `${prod.totalProdUnits} وحدة منجزة`}
          subtitle={`عدد الفنيين النشطين: ${prod.technicians.length} | وحدات: ${prod.totalProdUnits}`}
          icon={Wrench}
          theme="teal"
        />
      </div>

      {/* Section Bottlenecks + Productivity by Specialty */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="font-black text-slate-900 text-base">متوسط مدة الإنجاز حسب القسم (اختناقات الإنتاج)</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">الأقسام التي تستغرق أطول وقت لإتمام مهامها داخل أوامر التصنيع</p>
          <HorizontalBarList
            items={prod.sectionStats.map(s => ({
              id: s.name,
              label: s.name,
              value: s.avgDays > 0 ? s.avgDays : s.completedCount,
              displayValue: s.durationCount > 0
                ? `${s.avgDays.toFixed(1)} يوم (${s.completedCount} منجز)`
                : `${s.completedCount} منجز / ${s.pendingCount} معلق`,
              subLabel: `معلق: ${s.pendingCount}`,
              colorClass: s.avgDays >= 7 ? 'bg-rose-500' : 'bg-indigo-600'
            }))}
            emptyMessage="لا توجد بيانات مراحل أقسام مسجلة في هذه الفترة"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h3 className="font-black text-slate-900 text-base mb-1">توزيع الإنتاجية حسب التخصص الفني</h3>
          <p className="text-xs text-slate-500 mb-4">حصة كل تخصص فني من فواتير الإنتاجية خلال الفترة</p>
          <DonutBreakdownChart
            slices={prod.specialties.map((sp, idx) => ({
              label: sp.name,
              value: canViewFinancials ? sp.totalCost : sp.unitCount,
              displayValue: canViewFinancials ? `${formatCurrency(sp.totalCost)} د.ل (${sp.unitCount})` : `${sp.unitCount} وحدة`,
              color: specColors[idx % specColors.length]
            }))}
            centerLabel={canViewFinancials ? 'الإجمالي' : 'الوحدات'}
            centerValue={canViewFinancials ? formatCurrency(prod.totalProdCost) : String(prod.totalProdUnits)}
            emptyMessage="لا توجد فواتير إنتاجية مسجلة في هذه الفترة"
          />
        </div>
      </div>

      {/* Technicians Table & Ready Unsold Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-black text-slate-900 text-base">أداء ومستحقات الفنيين</h3>
            <p className="text-xs text-slate-500">عدد الوحدات المنجزة والتخصصات من واقع فواتير الإنتاجية</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3.5 font-bold">اسم الفني</th>
                  <th className="p-3.5 font-bold">التخصصات</th>
                  <th className="p-3.5 font-bold text-center">الوحدات</th>
                  {canViewFinancials && <th className="p-3.5 font-bold">الإجمالي</th>}
                  {canViewFinancials && <th className="p-3.5 font-bold">متوسط/وحدة</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prod.technicians.length === 0 ? (
                  <tr>
                    <td colSpan={canViewFinancials ? 5 : 3} className="p-8 text-center text-slate-400">
                      لا توجد فواتير إنتاجية في هذه الفترة
                    </td>
                  </tr>
                ) : (
                  prod.technicians.map(t => (
                    <tr key={t.name} className="hover:bg-slate-50">
                      <td className="p-3.5 font-bold text-slate-900">{t.name}</td>
                      <td className="p-3.5 text-xs text-slate-600">{Array.from(t.specialties).join('، ') || '--'}</td>
                      <td className="p-3.5 text-center font-bold text-teal-700">{t.unitCount}</td>
                      {canViewFinancials && <td className="p-3.5 font-mono font-black">{formatCurrency(t.totalCost)} د.ل</td>}
                      {canViewFinancials && (
                        <td className="p-3.5 font-mono text-slate-600">
                          {t.unitCount > 0 ? formatCurrency(t.totalCost / t.unitCount) : '0.00'} د.ل
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-black text-slate-900 text-base">المخزون الجاهز غير المباع (عمر التخزين)</h3>
            <p className="text-xs text-slate-500">الوحدات الجاهزة التي لم تصدر لها فاتورة بيع نهائية بعد</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3.5 font-bold">الرقم التسلسلي</th>
                  <th className="p-3.5 font-bold">الوصف</th>
                  <th className="p-3.5 font-bold">تاريخ الجاهزية</th>
                  <th className="p-3.5 font-bold text-center">عمر البقاء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prod.readyUnsoldItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">
                      لا يوجد مخزون جاهز غير مباع في هذه الفترة
                    </td>
                  </tr>
                ) : (
                  prod.readyUnsoldItems.slice(0, 20).map((it, i) => (
                    <tr key={`${it.woId}-${it.serialNumber}-${i}`} className="hover:bg-slate-50">
                      <td className="p-3.5 font-mono font-bold text-blue-700">{it.serialNumber}</td>
                      <td className="p-3.5 font-bold text-slate-800">{it.desc}</td>
                      <td className="p-3.5 font-mono text-xs text-slate-500">{it.readyDate}</td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          (it.daysInStock || 0) >= 30
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {it.daysInStock !== null ? `${it.daysInStock} يوم` : '--'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
