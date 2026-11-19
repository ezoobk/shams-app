import React, { useMemo } from 'react';
import { Users, DollarSign, Calendar, ShieldCheck, Printer, Clock } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { KpiCard, HorizontalBarList, DonutBreakdownChart } from './ReportCharts';
import { formatMonthLabel, isWithinDateRange } from './reportUtils';

interface HRAuditTabProps {
  employees: any[];
  payrollRecords: any[];
  transactions: any[];
  leaves: any[];
  settlements: any[];
  auditLogs: any[];
  printStats: Record<string, { count: number; lastPrintedAt?: string; lastPrintedBy?: string }>;
  startDate: string;
  endDate: string;
  canViewFinancials: boolean;
}

const LEAVE_LABELS: Record<string, string> = {
  paid: 'إجازة مدفوعة',
  unpaid: 'إجازة بدون راتب',
  sick: 'إجازة مرضية',
  permission: 'إذن ساعات',
};

const ACTION_LABELS_AR: Record<string, string> = {
  create: 'إضافة / إنشاء',
  edit: 'تعديل',
  delete: 'حذف',
  print: 'طباعة',
  status_change: 'تغيير حالة',
  login: 'تسجيل دخول',
  export: 'تصدير',
};

export const HRAuditTab: React.FC<HRAuditTabProps> = ({
  employees,
  payrollRecords,
  transactions,
  leaves,
  settlements,
  auditLogs,
  printStats,
  startDate,
  endDate,
  canViewFinancials,
}) => {
  const hr = useMemo(() => {
    const activeEmployees = (employees || []).filter(e => e.isActive !== false).length;
    const inactiveEmployees = (employees || []).filter(e => e.isActive === false).length;

    const filteredPayrolls = (payrollRecords || [])
      .filter(pr => pr && pr.month && isWithinDateRange(`${pr.month}-01`, startDate, endDate))
      .sort((a, b) => a.month.localeCompare(b.month));

    const totalPayrollNet = filteredPayrolls.reduce((s, p) => s + Number(p.totalNet || 0), 0);
    const totalOvertime = filteredPayrolls.reduce((s, p) => s + Number(p.totalOvertime || 0), 0);
    const totalDelayDeductions = filteredPayrolls.reduce((s, p) => s + Number(p.totalDelayDeductions || 0), 0);

    const filteredTrans = (transactions || []).filter(t => t && t.status !== 'cancelled' && isWithinDateRange(t.date, startDate, endDate));
    const transSums = { advance: 0, deduction: 0, bonus: 0, allowance: 0 };
    filteredTrans.forEach(t => {
      const tp = t.type as keyof typeof transSums;
      if (tp in transSums) transSums[tp] += Number(t.amount || 0);
    });

    const filteredLeaves = (leaves || []).filter(l => l && l.status !== 'rejected' && isWithinDateRange(l.startDate, startDate, endDate));
    const leaveCounts = new Map<string, number>();
    filteredLeaves.forEach(l => {
      const lbl = LEAVE_LABELS[l.type] || l.type || 'أخرى';
      leaveCounts.set(lbl, (leaveCounts.get(lbl) || 0) + 1);
    });

    const filteredSettlements = (settlements || []).filter(s => s && isWithinDateRange(s.settlementDate || s.payoutDate, startDate, endDate));
    const totalSettlementsNet = filteredSettlements.reduce((s, st) => s + Number(st.netPayable || 0), 0);

    // Department breakdown
    const deptMap = new Map<string, number>();
    (employees || []).filter(e => e.isActive !== false).forEach(e => {
      const dept = (e.deptName || 'عام / غير محدد').trim();
      deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
    });
    const deptList = Array.from(deptMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    return {
      activeEmployees,
      inactiveEmployees,
      filteredPayrolls,
      totalPayrollNet,
      totalOvertime,
      totalDelayDeductions,
      transSums,
      filteredLeavesCount: filteredLeaves.length,
      leaveBreakdown: Array.from(leaveCounts.entries()).map(([label, count]) => ({ label, count })),
      filteredSettlementsCount: filteredSettlements.length,
      totalSettlementsNet,
      deptList
    };
  }, [employees, payrollRecords, transactions, leaves, settlements, startDate, endDate]);

  const audit = useMemo(() => {
    const filteredLogs = (auditLogs || []).filter(l => l && isWithinDateRange(l.timestamp, startDate, endDate));
    const userActMap = new Map<string, { name: string; total: number; prints: number; edits: number; creates: number; deletes: number }>();
    const actionMap = new Map<string, number>();
    let revertedCount = 0;

    filteredLogs.forEach(l => {
      if (l.isReverted) revertedCount++;
      const uName = l.userDisplayName || l.userName || 'نظام';
      const cur = userActMap.get(uName) || { name: uName, total: 0, prints: 0, edits: 0, creates: 0, deletes: 0 };
      cur.total += 1;
      if (l.actionType === 'print') cur.prints += 1;
      else if (l.actionType === 'edit') cur.edits += 1;
      else if (l.actionType === 'create') cur.creates += 1;
      else if (l.actionType === 'delete') cur.deletes += 1;
      userActMap.set(uName, cur);

      const actLbl = ACTION_LABELS_AR[l.actionType] || l.actionType || 'أخرى';
      actionMap.set(actLbl, (actionMap.get(actLbl) || 0) + 1);
    });

    const topUsers = Array.from(userActMap.values()).sort((a, b) => b.total - a.total);
    const actionBreakdown = Array.from(actionMap.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

    const topPrinted = Object.entries(printStats || {})
      .map(([docId, st]) => ({ docId, count: st?.count || 0, lastPrintedBy: st?.lastPrintedBy || '--', lastPrintedAt: st?.lastPrintedAt || '' }))
      .filter(p => p.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalLogs: filteredLogs.length,
      revertedCount,
      topUsers,
      actionBreakdown,
      topPrinted
    };
  }, [auditLogs, printStats, startDate, endDate]);

  const leaveColors = ['#2563eb', '#f59e0b', '#e11d48', '#10b981'];
  const actColors = ['#10b981', '#2563eb', '#f59e0b', '#7c3aed', '#e11d48', '#0d9488', '#64748b'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="القوى العاملة"
          value={`${hr.activeEmployees} موظف نشط`}
          subtitle={`غير نشط / منتهي خدمة: ${hr.inactiveEmployees}`}
          icon={Users}
          theme="blue"
        />
        <KpiCard
          title="إجمالي مسيرات الرواتب"
          value={canViewFinancials ? `${formatCurrency(hr.totalPayrollNet)} د.ل` : `${hr.filteredPayrolls.length} مسير`}
          subtitle={canViewFinancials ? `إضافي: ${formatCurrency(hr.totalOvertime)} | خصم تأخير: ${formatCurrency(hr.totalDelayDeductions)}` : 'يتطلب صلاحية مالية'}
          badgeText={`${hr.filteredPayrolls.length} شهر`}
          icon={DollarSign}
          theme="purple"
        />
        <KpiCard
          title="الإجازات والمخالصات"
          value={`${hr.filteredLeavesCount} إجازة`}
          subtitle={`مخالصات نهاية خدمة: ${hr.filteredSettlementsCount}${canViewFinancials ? ` (${formatCurrency(hr.totalSettlementsNet)} د.ل)` : ''}`}
          icon={Calendar}
          theme="teal"
        />
        <KpiCard
          title="حركات النظام والتدقيق"
          value={`${audit.totalLogs} حركة`}
          subtitle={`عمليات تراجع (Undo): ${audit.revertedCount}`}
          icon={ShieldCheck}
          theme="slate"
        />
      </div>

      {/* Payroll Evolution & Departments / Leaves */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h3 className="font-black text-slate-900 text-base mb-1">توزيع الموظفين حسب الأقسام</h3>
          <p className="text-xs text-slate-500 mb-4">عدد الموظفين النشطين حالياً في كل قسم</p>
          <HorizontalBarList
            items={hr.deptList.map(d => ({
              id: d.name,
              label: d.name,
              value: d.count,
              displayValue: `${d.count} موظف`,
              colorClass: 'bg-blue-600'
            }))}
            emptyMessage="لا يوجد موظفون مسجلون"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h3 className="font-black text-slate-900 text-base mb-1">توزيع الإجازات المعتمدة</h3>
          <p className="text-xs text-slate-500 mb-4">حسب نوع الإجازة خلال الفترة المختارة</p>
          <DonutBreakdownChart
            slices={hr.leaveBreakdown.map((l, idx) => ({
              label: l.label,
              value: l.count,
              displayValue: `${l.count} طلب`,
              color: leaveColors[idx % leaveColors.length]
            }))}
            centerLabel="الإجازات"
            centerValue={String(hr.filteredLeavesCount)}
            emptyMessage="لا توجد إجازات مسجلة في هذه الفترة"
          />
        </div>
      </div>

      {/* Payroll History Table */}
      {canViewFinancials && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-black text-slate-900 text-base">تطور مسيرات الرواتب الشهرية</h3>
              <p className="text-xs text-slate-500">تفاصيل الأساسي والإضافي والمكافآت والسلفيات وخصومات التأخير</p>
            </div>
            <div className="text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              حركات الفترة — سلفيات: <span className="font-mono text-rose-600">{formatCurrency(hr.transSums.advance)}</span> | مكافآت/بدلات: <span className="font-mono text-emerald-700">{formatCurrency(hr.transSums.bonus + hr.transSums.allowance)}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3.5 font-bold">الشهر</th>
                  <th className="p-3.5 font-bold text-center">الموظفين</th>
                  <th className="p-3.5 font-bold">الأساسي</th>
                  <th className="p-3.5 font-bold">الإضافي</th>
                  <th className="p-3.5 font-bold">المكافآت</th>
                  <th className="p-3.5 font-bold">السلفيات</th>
                  <th className="p-3.5 font-bold">خصم التأخير</th>
                  <th className="p-3.5 font-bold">الصافي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hr.filteredPayrolls.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      لا توجد مسيرات رواتب محفوظة في هذه الفترة
                    </td>
                  </tr>
                ) : (
                  hr.filteredPayrolls.map(pr => (
                    <tr key={pr.id || pr.month} className="hover:bg-slate-50">
                      <td className="p-3.5 font-bold text-slate-900">{formatMonthLabel(pr.month)}</td>
                      <td className="p-3.5 text-center font-mono">{Array.isArray(pr.data) ? pr.data.length : '--'}</td>
                      <td className="p-3.5 font-mono">{formatCurrency(pr.totalBase || 0)}</td>
                      <td className="p-3.5 font-mono text-emerald-700">{formatCurrency(pr.totalOvertime || 0)}</td>
                      <td className="p-3.5 font-mono text-blue-700">{formatCurrency(pr.totalBonuses || 0)}</td>
                      <td className="p-3.5 font-mono text-amber-700">{formatCurrency(pr.totalAdvances || 0)}</td>
                      <td className="p-3.5 font-mono text-rose-600">{formatCurrency(pr.totalDelayDeductions || 0)}</td>
                      <td className="p-3.5 font-mono font-black text-slate-900">{formatCurrency(pr.totalNet || 0)} د.ل</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Activity & Print Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-slate-600" />
            <h3 className="font-black text-slate-900 text-base">نشاط المستخدمين في النظام</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">أكثر المستخدمين تفاعلاً من واقع سجل حركات النظام</p>
          <HorizontalBarList
            items={audit.topUsers.slice(0, 7).map(u => ({
              id: u.name,
              label: u.name,
              value: u.total,
              displayValue: `${u.total} حركة`,
              subLabel: `إنشاء ${u.creates} | تعديل ${u.edits} | طباعة ${u.prints}`,
              colorClass: 'bg-slate-700'
            }))}
            emptyMessage="لا توجد حركات مسجلة في سجل النظام لهذه الفترة"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
          <div>
            <h3 className="font-black text-slate-900 text-base mb-1">توزيع أنواع العمليات</h3>
            <p className="text-xs text-slate-500 mb-4">نسبة عمليات الإنشاء، التعديل، الطباعة، والحذف</p>
            <DonutBreakdownChart
              slices={audit.actionBreakdown.map((a, idx) => ({
                label: a.label,
                value: a.count,
                displayValue: `${a.count}`,
                color: actColors[idx % actColors.length]
              }))}
              centerLabel="الحركات"
              centerValue={String(audit.totalLogs)}
              emptyMessage="لا توجد عمليات مسجلة في هذه الفترة"
            />
          </div>

          {audit.topPrinted.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 mb-2">
                <Printer className="w-3.5 h-3.5 text-blue-600" />
                <span>أكثر المستندات طباعة (إجمالاً):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {audit.topPrinted.slice(0, 6).map(p => (
                  <span key={p.docId} className="text-[11px] font-bold bg-slate-50 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 font-mono">
                    {p.docId} <span className="text-blue-600">({p.count}×)</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
