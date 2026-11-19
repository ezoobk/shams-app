import React, { useState, useMemo } from 'react';
import { useHR } from '../../context/HRContext';
import { useAuth } from '../../context/AuthContext';
import { usePrint } from '../../context/PrintContext';
import {
  Clock, Calendar, CheckCircle2, XCircle, AlertCircle,
  Check, X, RotateCcw, Printer, Search, Filter, ShieldCheck,
  TrendingUp, DollarSign, ChevronRight, ChevronLeft, ArrowRight,
  Info, Sparkles, User, AlertTriangle
} from 'lucide-react';
import type { HRDetectedOvertimePeriod, HROvertimeRecord } from '../../types';
import { formatCurrency } from '../../utils/formatters';

export const OvertimeView: React.FC = () => {
  const {
    detectDayOvertimePeriods,
    overtimeRecords,
    saveOvertimeRecord,
    saveOvertimeRecordsBulk,
    deleteOvertimeRecord,
    hrSettings
  } = useHR();
  const { currentUser, hasPermission } = useAuth();
  const { setPrintData } = usePrint();

  // Selected date (defaults to today)
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [minMinutesFilter, setMinMinutesFilter] = useState<'all' | '5' | '10' | '15' | '30'>('5');

  // Modal / Prompt for rejection reason
  const [rejectingPeriod, setRejectingPeriod] = useState<HRDetectedOvertimePeriod | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // Editing reason for approved / pending period
  const [editingReasonPeriod, setEditingReasonPeriod] = useState<HRDetectedOvertimePeriod | null>(null);
  const [reasonInput, setReasonInput] = useState('');

  // Date Navigation Helpers
  const handleDateShift = (days: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${day}`);
  };

  const getDayDetails = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const dayName = d.toLocaleDateString('ar-LY', { weekday: 'long' });
    const fullDateArabic = d.toLocaleDateString('ar-LY', { day: 'numeric', month: 'long', year: 'numeric' });
    const enDay = d.toLocaleDateString('en-US', { weekday: 'long' });
    const isWeekend = (hrSettings.weekendDays || ['Friday']).includes(enDay);
    return { dayName, fullDateArabic, isWeekend };
  };

  const dayInfo = useMemo(() => getDayDetails(selectedDate), [selectedDate, hrSettings]);

  // Detect periods for selected date
  const detectedPeriods = useMemo(() => {
    return detectDayOvertimePeriods(selectedDate);
  }, [selectedDate, detectDayOvertimePeriods, overtimeRecords]);

  // Filtered periods
  const filteredPeriods = useMemo(() => {
    return detectedPeriods.filter(p => {
      // Status filter
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;

      // Minimum duration filter
      if (minMinutesFilter === '5' && p.actualMinutes < 5) return false;
      if (minMinutesFilter === '10' && p.actualMinutes < 10) return false;
      if (minMinutesFilter === '15' && p.actualMinutes < 15) return false;
      if (minMinutesFilter === '30' && p.actualMinutes < 30) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const empName = (p.employee.name || '').toLowerCase();
        const badge = String(p.employee.badgeNumber || '').toLowerCase();
        const dept = (p.employee.deptName || '').toLowerCase();
        const label = (p.periodLabel || '').toLowerCase();
        return empName.includes(q) || badge.includes(q) || dept.includes(q) || label.includes(q);
      }

      return true;
    });
  }, [detectedPeriods, statusFilter, minMinutesFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    let totalHours = 0;
    let totalAmount = 0;

    let approvedHours = 0;
    let approvedAmount = 0;
    let approvedCount = 0;

    let rejectedHours = 0;
    let rejectedAmount = 0;
    let rejectedCount = 0;

    let pendingHours = 0;
    let pendingAmount = 0;
    let pendingCount = 0;

    filteredPeriods.forEach(p => {
      totalHours += p.hours;
      totalAmount += p.amount;

      if (p.status === 'approved') {
        approvedHours += p.hours;
        approvedAmount += p.amount;
        approvedCount++;
      } else if (p.status === 'rejected') {
        rejectedHours += p.hours;
        rejectedAmount += p.amount;
        rejectedCount++;
      } else {
        pendingHours += p.hours;
        pendingAmount += p.amount;
        pendingCount++;
      }
    });

    return {
      totalPeriods: filteredPeriods.length,
      totalHours: Math.round(totalHours * 10) / 10,
      totalAmount: Math.round(totalAmount * 100) / 100,
      approvedHours: Math.round(approvedHours * 10) / 10,
      approvedAmount: Math.round(approvedAmount * 100) / 100,
      approvedCount,
      rejectedHours: Math.round(rejectedHours * 10) / 10,
      rejectedAmount: Math.round(rejectedAmount * 100) / 100,
      rejectedCount,
      pendingHours: Math.round(pendingHours * 10) / 10,
      pendingAmount: Math.round(pendingAmount * 100) / 100,
      pendingCount
    };
  }, [filteredPeriods]);

  // Action: Approve Period
  const handleApprove = async (period: HRDetectedOvertimePeriod) => {
    const record: HROvertimeRecord = {
      id: period.id,
      employeeId: period.employee.id,
      employeeName: period.employee.name,
      badgeNumber: period.employee.badgeNumber,
      date: period.date,
      periodType: period.periodType,
      periodLabel: period.periodLabel,
      punchRange: period.punchRange,
      actualMinutes: period.actualMinutes,
      hours: period.hours,
      hourlyRate: period.hourlyRate,
      overtimeRate: period.overtimeRate,
      amount: period.amount,
      status: 'approved',
      reason: period.reason || period.existingRecord?.reason,
      notes: period.notes || period.existingRecord?.notes,
      reviewedBy: currentUser?.displayName || 'المسؤول',
      reviewedAt: new Date().toISOString()
    };
    await saveOvertimeRecord(record);
  };

  // Action: Open Reject Modal
  const handleOpenReject = (period: HRDetectedOvertimePeriod) => {
    setRejectingPeriod(period);
    setRejectionReasonInput(period.rejectionReason || period.existingRecord?.rejectionReason || '');
  };

  // Action: Confirm Rejection
  const handleConfirmReject = async () => {
    if (!rejectingPeriod) return;
    const record: HROvertimeRecord = {
      id: rejectingPeriod.id,
      employeeId: rejectingPeriod.employee.id,
      employeeName: rejectingPeriod.employee.name,
      badgeNumber: rejectingPeriod.employee.badgeNumber,
      date: rejectingPeriod.date,
      periodType: rejectingPeriod.periodType,
      periodLabel: rejectingPeriod.periodLabel,
      punchRange: rejectingPeriod.punchRange,
      actualMinutes: rejectingPeriod.actualMinutes,
      hours: rejectingPeriod.hours,
      hourlyRate: rejectingPeriod.hourlyRate,
      overtimeRate: rejectingPeriod.overtimeRate,
      amount: rejectingPeriod.amount,
      status: 'rejected',
      reason: rejectingPeriod.reason || rejectingPeriod.existingRecord?.reason,
      rejectionReason: rejectionReasonInput.trim() || 'غير معتمد / بدون تكليف رسمي',
      notes: rejectingPeriod.notes || rejectingPeriod.existingRecord?.notes,
      reviewedBy: currentUser?.displayName || 'المسؤول',
      reviewedAt: new Date().toISOString()
    };
    await saveOvertimeRecord(record);
    setRejectingPeriod(null);
    setRejectionReasonInput('');
  };

  // Action: Reset Period to Pending
  const handleResetToPending = async (period: HRDetectedOvertimePeriod) => {
    if (period.existingRecord) {
      await deleteOvertimeRecord(period.id);
    }
  };

  // Action: Bulk Approve All Pending
  const handleBulkApprove = async () => {
    const pendings = detectedPeriods.filter(p => p.status === 'pending');
    if (pendings.length === 0) {
      alert('لا توجد فترات إضافي معلقة بانتظار الاعتماد');
      return;
    }
    if (!window.confirm(`هل أنت متأكد من اعتماد جميع فترات الإضافي المعلقة لليوم (${pendings.length} فترة) بإجمالي ${stats.pendingHours} ساعة؟`)) {
      return;
    }

    const records: HROvertimeRecord[] = pendings.map(p => ({
      id: p.id,
      employeeId: p.employee.id,
      employeeName: p.employee.name,
      badgeNumber: p.employee.badgeNumber,
      date: p.date,
      periodType: p.periodType,
      periodLabel: p.periodLabel,
      punchRange: p.punchRange,
      actualMinutes: p.actualMinutes,
      hours: p.hours,
      hourlyRate: p.hourlyRate,
      overtimeRate: p.overtimeRate,
      amount: p.amount,
      status: 'approved',
      reason: p.reason || p.existingRecord?.reason,
      notes: p.notes || p.existingRecord?.notes,
      reviewedBy: currentUser?.displayName || 'المسؤول',
      reviewedAt: new Date().toISOString()
    }));

    await saveOvertimeRecordsBulk(records);
  };

  // Action: Bulk Reject All Pending
  const handleBulkReject = async () => {
    const pendings = detectedPeriods.filter(p => p.status === 'pending');
    if (pendings.length === 0) {
      alert('لا توجد فترات إضافي معلقة للرفض');
      return;
    }
    const reason = window.prompt(
      `هل أنت متأكد من رفض جميع فترات الإضافي المعلقة (${pendings.length} فترة)؟\nسيتم استبعادها تماماً من مسير الرواتب وحفظها للأرشيف.\n\nأدخل سبب الرفض الجماعي (اختياري):`,
      'غير معتمد / بدون تكليف مسبق'
    );
    if (reason === null) return;

    const records: HROvertimeRecord[] = pendings.map(p => ({
      id: p.id,
      employeeId: p.employee.id,
      employeeName: p.employee.name,
      badgeNumber: p.employee.badgeNumber,
      date: p.date,
      periodType: p.periodType,
      periodLabel: p.periodLabel,
      punchRange: p.punchRange,
      actualMinutes: p.actualMinutes,
      hours: p.hours,
      hourlyRate: p.hourlyRate,
      overtimeRate: p.overtimeRate,
      amount: p.amount,
      status: 'rejected',
      rejectionReason: reason.trim() || 'غير معتمد / بدون تكليف مسبق',
      reviewedBy: currentUser?.displayName || 'المسؤول',
      reviewedAt: new Date().toISOString()
    }));

    await saveOvertimeRecordsBulk(records);
  };

  // Action: Print Daily Overtime Sheet
  const handlePrintDailyOvertime = () => {
    setPrintData({
      type: 'HR_OVERTIME_DAILY',
      data: {
        date: selectedDate,
        dayInfo,
        periods: filteredPeriods,
        stats,
        printedBy: currentUser?.displayName || 'المسؤول',
        generatedAt: new Date().toISOString()
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header & Date Navigation ────────────────────────────────────── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">معالجة واعتماد العمل الإضافي</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                مراجعة وقبول أو رفض فترات العمل الإضافي اليومية بدقة، مع حفظ الفترات المرفوضة للمراجعة واستبعادها من الراتب
              </p>
            </div>
          </div>
        </div>

        {/* Date Selector & Day Navigation Controls */}
        <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
          {/* Previous / Next Day Buttons */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button
              onClick={() => handleDateShift(1)}
              className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition-colors"
              title="اليوم التالي"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="px-2 py-1 text-xs font-bold text-slate-700 flex items-center gap-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent font-bold outline-none cursor-pointer text-xs"
              />
            </div>
            <button
              onClick={() => handleDateShift(-1)}
              className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition-colors"
              title="اليوم السابق"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Jump Buttons */}
          <button
            onClick={() => setSelectedDate(todayStr)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors ${
              selectedDate === todayStr
                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            اليوم
          </button>
          <button
            onClick={() => {
              const yest = new Date();
              yest.setDate(yest.getDate() - 1);
              setSelectedDate(yest.toISOString().slice(0, 10));
            }}
            className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 text-xs font-bold rounded-xl transition-colors"
          >
            أمس
          </button>

          {/* Print Button */}
          {hasPermission('hr', 'print') && (
            <button
              onClick={handlePrintDailyOvertime}
              disabled={detectedPeriods.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all shadow-xs"
              title="طباعة كشف حركات الإضافي المقبولة والمرفوضة لليوم المحدد"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة كشف اليوم</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Active Day Banner & Day State ───────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-5 py-3 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-sm font-black text-amber-400">
            {dayInfo.dayName}، {dayInfo.fullDateArabic}
          </span>
          <span className="text-xs text-slate-400 font-mono">({selectedDate})</span>
          {dayInfo.isWeekend && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              عطلة أسبوعية
            </span>
          )}
        </div>
        <div className="text-xs text-slate-300 flex items-center gap-3">
          <span>تم اكتشاف: <strong className="text-white font-mono">{detectedPeriods.length}</strong> فترة إضافي</span>
          <span>•</span>
          <span>الإجمالي: <strong className="text-amber-400 font-mono">{stats.totalHours}س</strong> ({formatCurrency(stats.totalAmount)} د.ل)</span>
        </div>
      </div>

      {/* ── KPI Summary Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Detected Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>إجمالي الإضافي المكتشف</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1 font-mono dir-ltr">
            {stats.totalHours} <span className="text-xs font-sans text-slate-400">ساعة</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            القيمة التقديرية: <span className="font-mono font-bold text-slate-700">{formatCurrency(stats.totalAmount)} د.ل</span>
          </div>
        </div>

        {/* Approved Card */}
        <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 shadow-xs">
          <div className="text-xs font-bold text-emerald-800 flex items-center justify-between">
            <span>المعتمد والمقبول للصرف</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-800 mt-1 font-mono dir-ltr">
            {stats.approvedHours} <span className="text-xs font-sans text-emerald-600">ساعة</span>
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 flex items-center justify-between font-bold">
            <span>المستحق: {formatCurrency(stats.approvedAmount)} د.ل</span>
            <span className="text-[10px] font-normal">({stats.approvedCount} فترة)</span>
          </div>
        </div>

        {/* Rejected Card */}
        <div className="bg-red-50/70 p-4 rounded-xl border border-red-200 shadow-xs">
          <div className="text-xs font-bold text-red-800 flex items-center justify-between">
            <span>المرفوض (مستبعد من الراتب)</span>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-800 mt-1 font-mono dir-ltr">
            {stats.rejectedHours} <span className="text-xs font-sans text-red-600">ساعة</span>
          </div>
          <div className="text-[11px] text-red-700 mt-1 flex items-center justify-between">
            <span>محفوظ للأرشيف: {formatCurrency(stats.rejectedAmount)} د.ل</span>
            <span className="text-[10px]">({stats.rejectedCount} فترة)</span>
          </div>
        </div>

        {/* Pending Card */}
        <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 shadow-xs">
          <div className="text-xs font-bold text-amber-900 flex items-center justify-between">
            <span>قيد الانتظار والمراجعة</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1 font-mono dir-ltr">
            {stats.pendingHours} <span className="text-xs font-sans text-amber-700">ساعة</span>
          </div>
          <div className="text-[11px] text-amber-800 mt-1 flex items-center justify-between">
            <span>قيمة معلقة: {formatCurrency(stats.pendingAmount)} د.ل</span>
            <span className="text-[10px] font-bold">({stats.pendingCount} فترة)</span>
          </div>
        </div>
      </div>

      {/* ── Filters, Search & Bulk Actions Bar ──────────────────────────────── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-center gap-3">
        {/* Status Filters & Threshold Filter */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({detectedPeriods.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1 ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-800 hover:bg-amber-100/60'
              }`}
            >
              <span>بانتظار القرار</span>
              <span className="font-mono">({stats.pendingCount})</span>
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1 ${
                statusFilter === 'approved'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-800 hover:bg-emerald-100/60'
              }`}
            >
              <span>المعتمد</span>
              <span className="font-mono">({stats.approvedCount})</span>
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1 ${
                statusFilter === 'rejected'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-red-800 hover:bg-red-100/60'
              }`}
            >
              <span>المرفوض</span>
              <span className="font-mono">({stats.rejectedCount})</span>
            </button>
          </div>

          {/* Minimum Minutes Threshold Filter */}
          <div className="flex items-center gap-1 bg-purple-50/70 border border-purple-200/80 p-1 rounded-xl text-xs">
            <span className="text-[11px] font-bold text-purple-800 px-1.5 flex items-center gap-1">
              <Filter className="w-3 h-3 text-purple-600" />
              <span>الحد الأدنى:</span>
            </span>
            <button
              onClick={() => setMinMinutesFilter('all')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-colors ${minMinutesFilter === 'all' ? 'bg-purple-700 text-white shadow-xs' : 'text-purple-700 hover:bg-purple-100'}`}
              title="عرض كافة الفترات المرصودة دون أي استثناء"
            >
              الكل (&gt; 0 د)
            </button>
            <button
              onClick={() => setMinMinutesFilter('5')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-colors ${minMinutesFilter === '5' ? 'bg-purple-700 text-white shadow-xs' : 'text-purple-700 hover:bg-purple-100'}`}
              title="عرض الفترات التي تبلغ 5 دقائق فأكثر (استبعاد البصمات العابرة)"
            >
              ≥ 5 د
            </button>
            <button
              onClick={() => setMinMinutesFilter('15')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-colors ${minMinutesFilter === '15' ? 'bg-purple-700 text-white shadow-xs' : 'text-purple-700 hover:bg-purple-100'}`}
              title="عرض الفترات من ربع ساعة فما فوق"
            >
              ≥ 15 د
            </button>
            <button
              onClick={() => setMinMinutesFilter('30')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-colors ${minMinutesFilter === '30' ? 'bg-purple-700 text-white shadow-xs' : 'text-purple-700 hover:bg-purple-100'}`}
              title="عرض الفترات من نصف ساعة فما فوق"
            >
              ≥ 30 د
            </button>
          </div>
        </div>

        {/* Search Input & Bulk Action Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="بحث بالموظف أو الكود..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-blue-500"
            />
          </div>

          {/* Bulk Actions (Only if there are pending items) */}
          {hasPermission('hr', 'payroll') && stats.pendingCount > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleBulkApprove}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                title="اعتماد جميع فترات الإضافي المعلقة لهذا اليوم"
              >
                <Check className="w-3.5 h-3.5" />
                <span>قبول الكل ({stats.pendingCount})</span>
              </button>
              <button
                onClick={handleBulkReject}
                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                title="رفض جميع فترات الإضافي المعلقة لهذا اليوم"
              >
                <X className="w-3.5 h-3.5" />
                <span>رفض الكل</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Overtime Periods Cards Grid ──────────────────────────────────────── */}
      <div className="space-y-3">
        {filteredPeriods.map((period, idx) => {
          const isApproved = period.status === 'approved';
          const isRejected = period.status === 'rejected';
          const isPending = period.status === 'pending';

          return (
            <div
              key={period.id}
              className={`bg-white rounded-2xl border transition-all p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isApproved
                  ? 'border-emerald-200 bg-emerald-50/10'
                  : isRejected
                  ? 'border-red-200 bg-red-50/15 opacity-85'
                  : 'border-slate-200 hover:border-blue-300'
              }`}
            >
              {/* Left Column: Employee & Period Meta */}
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 mt-0.5 ${
                    isApproved
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : isRejected
                      ? 'bg-red-100 text-red-800 border border-red-300'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {idx + 1}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-black text-slate-900 text-sm">{period.employee.name}</span>
                    <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      #{period.employee.badgeNumber || period.employee.id}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      ({period.employee.deptName || 'عام'} - {period.employee.jobTitle || 'موظف'})
                    </span>

                    {/* Period Type Badge */}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        period.periodType === 'before_shift'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : period.periodType === 'after_shift'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : period.periodType === 'weekend'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {period.periodLabel}
                    </span>
                  </div>

                  {/* Punch Timing vs Shift Timing */}
                  <div className="text-xs text-slate-600 flex items-center gap-2 font-mono">
                    <span className="font-bold text-slate-800">{period.punchRange}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500">الفترة الفعلية: {period.actualMinutes} دقيقة</span>
                  </div>

                  {/* Reason & Rejection Details (if present) */}
                  {period.reason && (
                    <div className="text-[11px] text-slate-700 flex items-center gap-1">
                      <span className="font-bold text-slate-500">البيان/المهمة:</span>
                      <span>{period.reason}</span>
                    </div>
                  )}

                  {isRejected && period.rejectionReason && (
                    <div className="text-[11px] text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 inline-block font-semibold">
                      سبب الرفض: {period.rejectionReason} (مستبعد من الراتب)
                    </div>
                  )}

                  {period.existingRecord?.reviewedBy && (
                    <div className="text-[10px] text-slate-400">
                      تمت المراجعة بواسطة: <span className="font-bold text-slate-600">{period.existingRecord.reviewedBy}</span>
                      {period.existingRecord.reviewedAt && (
                        <span> بتاريخ {new Date(period.existingRecord.reviewedAt).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Calculation Formula & Decision Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-end gap-3.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                {/* Financial Equation Box */}
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-center sm:text-left min-w-[200px]">
                  <div className="text-[10px] text-slate-500 font-bold mb-0.5">معادلة احتساب القيمة</div>
                  <div className="text-xs font-mono font-bold text-slate-800 dir-ltr flex items-center justify-center sm:justify-start gap-1">
                    <span className="text-purple-700 text-sm font-black">{period.hours} س</span>
                    <span>×</span>
                    <span>{formatCurrency(period.overtimeRate)} د.ل</span>
                    <span>=</span>
                    <span className={`text-base font-black ${
                      isApproved ? 'text-emerald-700' : isRejected ? 'text-red-600 line-through' : 'text-blue-700'
                    }`}>
                      {formatCurrency(period.amount)} د.ل
                    </span>
                  </div>
                  <div className="text-[9.5px] text-slate-400 mt-0.5 font-mono">
                    معدل الساعة: {formatCurrency(period.overtimeRate)} د.ل/س
                  </div>
                </div>

                {/* Status & Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Status Indicator */}
                  {isApproved && (
                    <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>معتمد</span>
                    </span>
                  )}
                  {isRejected && (
                    <span className="px-3 py-1 rounded-xl text-xs font-black bg-red-100 text-red-800 border border-red-300 flex items-center gap-1">
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span>مرفوض للمراجعة</span>
                    </span>
                  )}
                  {isPending && (
                    <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>بانتظار القرار</span>
                    </span>
                  )}

                  {/* Accept / Approve Button */}
                  {(!isApproved || isRejected) && (
                    <button
                      onClick={() => handleApprove(period)}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-2xs"
                      title="قبول واعتماد هذه الفترة لتنزل في مسير الرواتب"
                    >
                      <Check className="w-4 h-4" />
                      <span>قبول</span>
                    </button>
                  )}

                  {/* Reject Button */}
                  {(!isRejected || isApproved) && (
                    <button
                      onClick={() => handleOpenReject(period)}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                      title="رفض هذه الفترة واستبعادها من مسير الرواتب وحفظها للمراجعة"
                    >
                      <X className="w-4 h-4" />
                      <span>رفض</span>
                    </button>
                  )}

                  {/* Reset to Pending button if reviewed */}
                  {(isApproved || isRejected) && (
                    <button
                      onClick={() => handleResetToPending(period)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                      title="إعادة الفترة إلى قيد الانتظار وإلغاء القرار"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {filteredPeriods.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">لا توجد حركات عمل إضافي تطابق الفلاتر</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {detectedPeriods.length > 0 ? (
                <>
                  توجد <strong className="text-slate-800">{detectedPeriods.length}</strong> فترة إضافي مرصودة لهذا اليوم، لكنها مستبعدة بالفلتر الحالي (الحد الأدنى: {minMinutesFilter === 'all' ? '0 د' : minMinutesFilter + ' د'}).
                </>
              ) : (
                `لم تسجل بصمات عمل إضافي قبل أو بعد أوقات الورديات في تاريخ ${dayInfo.fullDateArabic} (${selectedDate}).`
              )}
            </p>
            {detectedPeriods.length > 0 && minMinutesFilter !== 'all' && (
              <button
                onClick={() => setMinMinutesFilter('all')}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                عرض كافة الفترات المرصودة ({detectedPeriods.length} فترة)
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Rejection Reason Modal ───────────────────────────────────────────── */}
      {rejectingPeriod && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-red-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                <h3 className="font-bold text-base">تأكيد رفض العمل الإضافي</h3>
              </div>
              <button
                onClick={() => setRejectingPeriod(null)}
                className="p-1 text-red-200 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
                <div className="font-bold text-red-950 text-sm">{rejectingPeriod.employee.name}</div>
                <div className="text-red-800 font-mono">
                  {rejectingPeriod.periodLabel} ({rejectingPeriod.hours} ساعة - {formatCurrency(rejectingPeriod.amount)} د.ل)
                </div>
                <div className="text-[11px] text-red-700 font-mono mt-1">
                  توقيت البصمة: {rejectingPeriod.punchRange}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  سبب الرفض (يُحفظ للمراجعة الإدارية والتدقيق):
                </label>
                <textarea
                  rows={3}
                  value={rejectionReasonInput}
                  onChange={e => setRejectionReasonInput(e.target.value)}
                  placeholder="مثال: تواجد الموظف مبكراً دون إذن أو تكليف مسبق / تأخر شخصي بعد انتهاء الوردية..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:bg-white focus:border-red-500"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                <div className="font-bold flex items-center gap-1 mb-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  <span>تأثير هذا الإجراء على الراتب:</span>
                </div>
                سيتم حفظ هذه الفترة في سجل الإضافي كفترة <strong>مرفوضة</strong> للمراجعة، <strong>ولن يتم احتسابها إطلاقاً</strong> في مسير الرواتب الشهري أو بطاقة الحضور.
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setRejectingPeriod(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>تأكيد الرفض والاستبعاد</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
