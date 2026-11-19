import React, { useState, useMemo, useEffect } from 'react';
import { useHR } from '../../context/HRContext';
import { useAuth } from '../../context/AuthContext';
import { usePrint } from '../../context/PrintContext';
import {
  FileText, Calendar, Printer, Download, CheckCircle2, AlertTriangle,
  TrendingUp, TrendingDown, DollarSign, Search, ShieldCheck, History, X,
  RefreshCw, Unlock, Eye, Sparkles, ArrowRight, Info, Check, Trash2,
  ChevronDown, Layers, UserX, UserCheck, FileCheck
} from 'lucide-react';
import type { HRPayrollRecord, HRPayrollItem, HRTransaction, HREndOfServiceSettlement } from '../../types';
import { formatCurrency, numberToArabicWords } from '../../utils/formatters';
import * as XLSX from 'xlsx';

export const PayrollView: React.FC = () => {
  const {
    calculatePayrollForMonth,
    payrollRecords,
    finalizePayroll,
    deletePayrollRecord,
    transactions,
    employees,
    analyzeMonthAttendance,
    hrSettings,
    settlements,
    createSettlement,
    deleteSettlement
  } = useHR();
  const { hasPermission, currentUser } = useAuth();
  const { setPrintData } = usePrint();

  const currentYearMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  // Initial state: NO month selected upon first opening as requested
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [viewHistoryModal, setViewHistoryModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showPrintDropdown, setShowPrintDropdown] = useState(false);
  const [inspectingItem, setInspectingItem] = useState<HRPayrollItem | null>(null);

  // Settlement Modals and Form State
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [viewSettlementsHistoryModal, setViewSettlementsHistoryModal] = useState(false);
  const [settlementEmpId, setSettlementEmpId] = useState('');
  const [settlementDate, setSettlementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [settlementStartDate, setSettlementStartDate] = useState('');
  const [settlementEndDate, setSettlementEndDate] = useState('');
  const [settlementReason, setSettlementReason] = useState<'resignation' | 'termination' | 'contract_end' | 'mutual_agreement' | 'other'>('resignation');
  const [settlementReasonDetails, setSettlementReasonDetails] = useState('');
  const [settlementLeavePayout, setSettlementLeavePayout] = useState<number>(0);
  const [settlementGratuity, setSettlementGratuity] = useState<number>(0);
  const [settlementOtherDeductions, setSettlementOtherDeductions] = useState<number>(0);
  const [settlementPaymentMethod, setSettlementPaymentMethod] = useState('نقداً');
  const [settlementNotes, setSettlementNotes] = useState('');

  // Modal form fields for approval
  const [approvalNotes, setApprovalNotes] = useState('');
  const [payoutDate, setPayoutDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('نقداً');

  // Helper to format month name in Arabic
  const formatMonthArabic = (ym: string) => {
    if (!ym || ym.length < 7) return '';
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('ar-LY', { month: 'long', year: 'numeric' });
  };

  // Generate available months list in STRICT DESCENDING ORDER with current month at top
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    monthsSet.add(currentYearMonth);

    // Collect months from finalized records
    payrollRecords.forEach(r => {
      if (r.month) monthsSet.add(r.month);
    });

    // Collect months from transactions
    transactions.forEach(t => {
      if (t.month) monthsSet.add(t.month);
      else if (t.date) monthsSet.add(t.date.slice(0, 7));
    });

    // Generate past 24 months
    const [cy, cm] = currentYearMonth.split('-').map(Number);
    for (let i = 0; i < 24; i++) {
      let y = cy;
      let m = cm - i;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      monthsSet.add(`${y}-${String(m).padStart(2, '0')}`);
    }

    // Sort descending
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [currentYearMonth, payrollRecords, transactions]);

  // Handle month selection
  const handleSelectMonth = (monthStr: string) => {
    setSelectedMonth(monthStr);
    setIsLiveMode(false);
    if (!monthStr) {
      setStartDate('');
      setEndDate('');
      return;
    }

    const [y, m] = monthStr.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, '0');

    // Check if an existing approved record has custom dates
    const existing = payrollRecords.find(r => r.month === monthStr);
    if (existing?.startDate && existing?.endDate) {
      setStartDate(existing.startDate);
      setEndDate(existing.endDate);
      setApprovalNotes(existing.notes || '');
      setPayoutDate(existing.payoutDate || '');
      setPaymentMethod(existing.paymentMethod || 'نقداً');
    } else {
      setStartDate(`${y}-${pad(m)}-01`);
      setEndDate(`${y}-${pad(m)}-${pad(lastDay)}`);
      setApprovalNotes('');
      setPayoutDate('');
      setPaymentMethod('نقداً');
    }
  };

  // Quick preset handlers for date range
  const applyPresetFullMonth = () => {
    if (!selectedMonth) return;
    const [y, m] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    setStartDate(`${y}-${pad(m)}-01`);
    setEndDate(`${y}-${pad(m)}-${pad(lastDay)}`);
    setIsLiveMode(true);
  };

  const applyPresetCycle25 = () => {
    if (!selectedMonth) return;
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevY = m === 1 ? y - 1 : y;
    const prevM = m === 1 ? 12 : m - 1;
    const pad = (n: number) => String(n).padStart(2, '0');
    setStartDate(`${prevY}-${pad(prevM)}-25`);
    setEndDate(`${y}-${pad(m)}-24`);
    setIsLiveMode(true);
  };

  const applyPresetCycle26 = () => {
    if (!selectedMonth) return;
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevY = m === 1 ? y - 1 : y;
    const prevM = m === 1 ? 12 : m - 1;
    const pad = (n: number) => String(n).padStart(2, '0');
    setStartDate(`${prevY}-${pad(prevM)}-26`);
    setEndDate(`${y}-${pad(m)}-25`);
    setIsLiveMode(true);
  };

  // Check if current month is already finalized
  const existingFinalized = useMemo(() => {
    if (!selectedMonth) return null;
    return payrollRecords.find(r => r.month === selectedMonth) || null;
  }, [payrollRecords, selectedMonth]);

  // Live calculated payroll rows vs finalized static rows
  const livePayrollItems = useMemo(() => {
    if (!selectedMonth) return [];

    // If finalized and user didn't request live recalculation/override, show finalized data
    if (existingFinalized && existingFinalized.data && !isLiveMode) {
      return existingFinalized.data;
    }

    return calculatePayrollForMonth(selectedMonth, startDate || undefined, endDate || undefined);
  }, [selectedMonth, startDate, endDate, existingFinalized, isLiveMode, calculatePayrollForMonth]);

  // Filtered rows for search
  const filteredItems = useMemo(() => {
    return livePayrollItems.filter(item => {
      if (!searchQuery) return true;
      return (
        item.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.badgeNumber || '').includes(searchQuery) ||
        item.deptName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [livePayrollItems, searchQuery]);

  // Totals calculation
  const totals = useMemo(() => {
    let totalBase = 0;
    let totalOvertime = 0;
    let totalLateDeductions = 0;
    let totalEarlyDeductions = 0;
    let totalDelayDeductions = 0;
    let totalBonuses = 0;
    let totalAllowances = 0;
    let totalAdvances = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let totalSettledOffCyclePaid = 0;
    let totalPayableCurrent = 0;

    livePayrollItems.forEach(item => {
      totalBase += item.baseSalaryOrRate || 0;
      totalOvertime += item.overtimeAmount || 0;
      const itemLateDed = item.lateDeduction || 0;
      const itemEarlyDed = item.earlyDeduction || 0;
      const itemDelayDed = item.delayDeduction ?? (itemLateDed + itemEarlyDed);
      totalLateDeductions += itemLateDed;
      totalEarlyDeductions += itemEarlyDed;
      totalDelayDeductions += itemDelayDed;
      totalBonuses += (item.bonuses || 0);
      totalAllowances += (item.allowances || 0);
      totalAdvances += (item.advances || 0);
      totalDeductions += (item.deductions || 0);
      totalNet += item.netSalary || 0;

      if (item.isSettledOffCycle) {
        totalSettledOffCyclePaid += (item.settlementAmountPaid ?? item.netSalary ?? 0);
      } else {
        totalPayableCurrent += (item.currentPayableNet ?? item.netSalary ?? 0);
      }
    });

    const totalAdditions = totalBonuses + totalAllowances;
    const totalAdvAndDed = totalAdvances + totalDeductions;

    return {
      totalBase,
      totalOvertime,
      totalLateDeductions,
      totalEarlyDeductions,
      totalDelayDeductions,
      totalBonuses,
      totalAllowances,
      totalAdditions,
      totalAdvances,
      totalDeductions,
      totalAdvAndDed,
      totalNet,
      totalSettledOffCyclePaid,
      totalPayableCurrent
    };
  }, [livePayrollItems]);

  // Get employee's transactions for the active period
  const getEmployeeTransactions = (empId: string): HRTransaction[] => {
    if (!selectedMonth) return [];
    return transactions.filter(t => {
      const matchEmp = String(t.employeeId) === String(empId);
      if (!matchEmp || t.status === 'cancelled') return false;

      // Exact due month matching
      const transMonth = t.month || (t.date ? t.date.slice(0, 7) : '');
      return transMonth === selectedMonth;
    });
  };

  // Export to Excel
  const exportToExcel = () => {
    if (!selectedMonth) return;
    const data = filteredItems.map((item, idx) => ({
      'م': idx + 1,
      'كود البصمة': item.badgeNumber || 'بدون بصمة',
      'اسم الموظف': item.employeeName,
      'القسم': item.deptName,
      'المسمى الوظيفي': item.jobTitle,
      'نظام الراتب': item.salaryType === 'daily' ? 'يومية' : 'راتب شهري',
      'الأساسي / اليومية': item.baseSalaryOrRate,
      'أيام الحضور': item.actualWorkDays,
      'أيام الغياب': item.absentDays,
      'دقائق التأخير': item.lateMinutes || 0,
      'دقائق الخروج المبكر': item.earlyMinutes || 0,
      'خصم التأخير والخروج (د.ل)': item.delayDeduction ?? ((item.lateDeduction || 0) + (item.earlyDeduction || 0)),
      'ساعات الإضافي': item.overtimeHours,
      'قيمة الإضافي (د.ل)': item.overtimeAmount,
      'المكافآت (د.ل)': item.bonuses || 0,
      'البدلات (د.ل)': item.allowances || 0,
      'إجمالي الزيادات والبدلات (د.ل)': (item.bonuses || 0) + (item.allowances || 0),
      'السلفيات (د.ل)': item.advances || 0,
      'الخصومات الجزائية (د.ل)': item.deductions || 0,
      'إجمالي السلفيات والخصومات (د.ل)': (item.advances || 0) + (item.deductions || 0),
      'صافي المرتب المستحق (د.ل)': item.netSalary
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `مسير_${selectedMonth}`);
    XLSX.writeFile(wb, `مسير_رواتب_${selectedMonth}.xlsx`);
  };

  // Trigger Print Sheet
  const handlePrint = () => {
    if (!selectedMonth) return;
    setPrintData({
      type: 'HR_PAYROLL',
      data: {
        month: selectedMonth,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        items: filteredItems,
        totals,
        notes: existingFinalized?.notes || approvalNotes,
        generatedAt: new Date().toISOString(),
        printedBy: currentUser?.displayName || 'المستخدم'
      }
    });
  };

  // Trigger Print Individual Employee Payslips with Monthly Attendance Sheet
  const handlePrintPayslips = (targetItems?: HRPayrollItem[]) => {
    if (!selectedMonth) return;
    const itemsToPrint = targetItems || filteredItems;
    if (itemsToPrint.length === 0) {
      alert('لا توجد بيانات موظفين للطباعة');
      return;
    }

    const slips = itemsToPrint.map(item => {
      const emp = employees.find(e => String(e.id) === String(item.employeeId)) || {
        id: item.employeeId,
        name: item.employeeName,
        badgeNumber: item.badgeNumber,
        deptName: item.deptName,
        jobTitle: item.jobTitle,
        salaryType: item.salaryType,
        basicSalary: item.baseSalaryOrRate
      } as any;

      const monthAttendance = analyzeMonthAttendance(
        selectedMonth,
        emp,
        startDate || undefined,
        endDate || undefined
      );

      const empTransactions = getEmployeeTransactions(item.employeeId);

      return {
        employee: emp,
        item,
        stats: monthAttendance || {},
        dailyDetails: monthAttendance?.dailyDetails || [],
        transactions: empTransactions
      };
    });

    setPrintData({
      type: 'HR_PAYSLIPS',
      data: {
        month: selectedMonth,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        notes: existingFinalized?.notes || approvalNotes,
        payoutDate: existingFinalized?.payoutDate || payoutDate,
        paymentMethod: existingFinalized?.paymentMethod || paymentMethod,
        generatedAt: new Date().toISOString(),
        printedBy: currentUser?.displayName || 'المستخدم',
        slips
      }
    });
  };

  // Trigger Print End-of-Service Clearance / Settlement Document
  const handlePrintSettlement = (settlement: HREndOfServiceSettlement) => {
    setPrintData({
      type: 'HR_SETTLEMENT',
      data: {
        settlement,
        generatedAt: new Date().toISOString(),
        printedBy: currentUser?.displayName || 'المستخدم'
      }
    });
  };

  // Live calculation for currently selected settlement employee and dates
  const settlementPreview = useMemo(() => {
    if (!settlementEmpId) return null;
    const emp = employees.find(e => e.id === settlementEmpId);
    if (!emp) return null;

    const sDate = settlementDate || new Date().toISOString().slice(0, 10);
    const sMonth = sDate.slice(0, 7);
    const startD = settlementStartDate || `${sMonth}-01`;
    const endD = settlementEndDate || sDate;

    const monthAttendance = analyzeMonthAttendance(sMonth, emp, startD, endD);

    const workDaysInMonth = hrSettings.workDaysPerMonth || 26;
    const hoursPerDay = hrSettings.standardHoursPerDay || 8;

    let baseSalaryOrRate = 0;
    let hourlyRate = 0;
    let earnedSalary = 0;

    if (emp.salaryType === 'daily') {
      baseSalaryOrRate = Number(emp.dailyRate) || 0;
      hourlyRate = hoursPerDay > 0 ? baseSalaryOrRate / hoursPerDay : 0;
      earnedSalary = (monthAttendance?.actualWorkDays || 0) * baseSalaryOrRate;
    } else {
      baseSalaryOrRate = Number(emp.basicSalary) || 0;
      const dailyEquivalent = workDaysInMonth > 0 ? baseSalaryOrRate / workDaysInMonth : 0;
      hourlyRate = hoursPerDay > 0 ? dailyEquivalent / hoursPerDay : 0;
      earnedSalary = Math.round((monthAttendance?.actualWorkDays || 0) * dailyEquivalent * 100) / 100;
    }

    // Overtime rate
    let otRate = 0;
    const otMode = emp.overtimeMode || 'general';
    if (otMode === 'fixed') {
      otRate = Number(emp.overtimeFixedAmount) || 0;
    } else if (otMode === 'percent') {
      otRate = hourlyRate * ((Number(emp.overtimePercent) || 125) / 100);
    } else {
      if (hrSettings.generalOvertimeMode === 'fixed') {
        otRate = Number(hrSettings.generalOvertimeFixedRate) || 0;
      } else {
        otRate = hourlyRate * ((Number(hrSettings.generalOvertimePercent) || 125) / 100);
      }
    }
    otRate = Math.round(otRate * 100) / 100;
    const overtimeAmount = Math.round((monthAttendance?.totalOvertimeHours || 0) * otRate * 100) / 100;

    // Delay & early departure deductions
    const lateHours = (monthAttendance?.totalLateMinutes || 0) / 60;
    const earlyHours = (monthAttendance?.totalEarlyMinutes || 0) / 60;
    const delayDeduction = Math.round((lateHours + earlyHours) * hourlyRate * 100) / 100;

    // Transactions for this employee strictly matching settlement month
    const empTrans = transactions.filter(t => {
      if (String(t.employeeId) !== String(emp.id)) return false;
      if (t.status === 'cancelled') return false;
      const tMonth = t.month || (t.date ? t.date.slice(0, 7) : '');
      return tMonth === sMonth;
    });

    const advances = empTrans.filter(t => t.type === 'advance').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const deductions = empTrans.filter(t => t.type === 'deduction').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const bonuses = empTrans.filter(t => t.type === 'bonus').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const allowances = empTrans.filter(t => t.type === 'allowance').reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const leavePayout = Number(settlementLeavePayout) || 0;
    const gratuity = Number(settlementGratuity) || 0;
    const otherDeds = Number(settlementOtherDeductions) || 0;

    const totalAdditions = earnedSalary + overtimeAmount + bonuses + allowances + leavePayout + gratuity;
    const totalDeductions = delayDeduction + advances + deductions + otherDeds;
    const netPayable = Math.round((totalAdditions - totalDeductions) * 100) / 100;

    return {
      emp,
      monthAttendance,
      baseSalaryOrRate,
      earnedSalary,
      overtimeHours: monthAttendance?.totalOvertimeHours || 0,
      overtimeAmount,
      lateMinutes: monthAttendance?.totalLateMinutes || 0,
      earlyMinutes: monthAttendance?.totalEarlyMinutes || 0,
      delayDeduction,
      bonuses,
      allowances,
      advances,
      deductions,
      leavePayout,
      gratuity,
      otherDeds,
      totalAdditions,
      totalDeductions,
      netPayable
    };
  }, [
    settlementEmpId,
    settlementDate,
    settlementStartDate,
    settlementEndDate,
    settlementLeavePayout,
    settlementGratuity,
    settlementOtherDeductions,
    employees,
    analyzeMonthAttendance,
    transactions,
    hrSettings
  ]);

  // Save Confirmed Settlement
  const handleConfirmSaveSettlement = async () => {
    if (!settlementPreview) {
      alert('يرجى اختيار الموظف ومراجعة الحسابات أولاً');
      return;
    }
    const { emp } = settlementPreview;
    const sDate = settlementDate || new Date().toISOString().slice(0, 10);
    const sMonth = sDate.slice(0, 7);
    const startD = settlementStartDate || `${sMonth}-01`;
    const endD = settlementEndDate || sDate;

    const settlementId = `SETTLE_${emp.id.slice(-4)}_${sDate.replace(/-/g, '')}`;

    const settlementObj: HREndOfServiceSettlement = {
      id: settlementId,
      employeeId: emp.id,
      employeeName: emp.name,
      badgeNumber: emp.badgeNumber,
      deptName: emp.deptName,
      jobTitle: emp.jobTitle,
      settlementDate: sDate,
      month: sMonth,
      startDate: startD,
      endDate: endD,
      reason: settlementReason,
      reasonDetails: settlementReasonDetails.trim() || undefined,
      salaryType: emp.salaryType,
      baseSalaryOrRate: settlementPreview.baseSalaryOrRate,
      actualWorkDays: settlementPreview.monthAttendance?.actualWorkDays || 0,
      absentDays: settlementPreview.monthAttendance?.absentDays || 0,
      earnedSalary: settlementPreview.earnedSalary,
      overtimeHours: settlementPreview.overtimeHours,
      overtimeAmount: settlementPreview.overtimeAmount,
      bonuses: settlementPreview.bonuses,
      allowances: settlementPreview.allowances,
      leaveBalancePayout: settlementPreview.leavePayout,
      endOfServiceGratuity: settlementPreview.gratuity,
      totalAdditions: settlementPreview.totalAdditions,
      lateMinutes: settlementPreview.lateMinutes,
      earlyMinutes: settlementPreview.earlyMinutes,
      delayDeduction: settlementPreview.delayDeduction,
      advances: settlementPreview.advances,
      deductions: settlementPreview.deductions,
      otherDeductions: settlementPreview.otherDeds,
      totalDeductions: settlementPreview.totalDeductions,
      netPayable: settlementPreview.netPayable,
      paymentMethod: settlementPaymentMethod,
      payoutDate: sDate,
      notes: settlementNotes.trim() || undefined,
      approvedAt: new Date().toISOString(),
      approvedBy: currentUser?.displayName || 'المسؤول',
      isSettled: true
    };

    await createSettlement(settlementObj);
    setShowSettlementModal(false);

    if (window.confirm('تم حفظ واعتماد مخالصة نهاية الخدمة وإلغاء تنشيط الموظف بنجاح! هل تريد طباعة وثيقة المخالصة الرسمية وإبراء الذمة الآن؟')) {
      handlePrintSettlement(settlementObj);
    }
  };

  // Open Approval Modal
  const handleOpenApproveModal = () => {
    if (existingFinalized) {
      setApprovalNotes(existingFinalized.notes || '');
      setPayoutDate(existingFinalized.payoutDate || '');
      setPaymentMethod(existingFinalized.paymentMethod || 'نقداً');
    }
    setShowApproveModal(true);
  };

  // Confirm Finalize / Save Approval
  const handleConfirmFinalize = async () => {
    if (!selectedMonth) return;

    const record: HRPayrollRecord = {
      id: `PAYROLL_${selectedMonth}`,
      month: selectedMonth,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      generatedAt: existingFinalized?.generatedAt || new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      approvedBy: currentUser?.displayName || 'المسؤول',
      notes: approvalNotes.trim() || undefined,
      payoutDate: payoutDate || undefined,
      paymentMethod: paymentMethod || 'نقداً',
      data: livePayrollItems,
      totalBase: totals.totalBase,
      totalOvertime: totals.totalOvertime,
      totalBonuses: totals.totalAdditions,
      totalAdvances: totals.totalAdvAndDed,
      totalDelayDeductions: totals.totalDelayDeductions,
      totalNet: totals.totalNet,
      totalDeductions: totals.totalAdvAndDed + totals.totalDelayDeductions,
      totalAdditions: totals.totalOvertime + totals.totalAdditions,
      isApproved: true
    };

    await finalizePayroll(record);
    setIsLiveMode(false);
    setShowApproveModal(false);
  };

  // Unfinalize / Unlock back to live draft
  const handleUnfinalize = async () => {
    if (!selectedMonth) return;
    if (!window.confirm(`هل أنت متأكد من إلغاء اعتماد مسير شهر (${selectedMonth})؟ سيتم تحويله إلى مسودة حية قابلة للاحتساب والتعديل المباشر.`)) return;

    await deletePayrollRecord(selectedMonth);
    setIsLiveMode(true);
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header & Navigation ────────────────────────────────────────── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-blue-600" />
              مسير الرواتب والمستحقات الشهرية
            </h2>
            {selectedMonth && existingFinalized && !isLiveMode && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                معتمد رسمياً
              </span>
            )}
            {selectedMonth && (!existingFinalized || isLiveMode) && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                مسودة احتساب مباشر
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            احتساب دقيق للرواتب بربط أيام الحضور، وساعات العمل الإضافي، والتأخير، والغياب، والسلفيات والبدلات
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto">
          {/* Month Selector Dropdown with current month at top and descending order */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300 shadow-xs">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <select
              value={selectedMonth}
              onChange={e => handleSelectMonth(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="">-- اختر الشهر المطلوب لعرض أو إعداد المسير --</option>
              {availableMonths.map(ym => (
                <option key={ym} value={ym} className="font-sans font-bold">
                  {ym === currentYearMonth
                    ? `★ ${formatMonthArabic(ym)} (${ym}) - الشهر الحالي`
                    : `${formatMonthArabic(ym)} (${ym})`}
                </option>
              ))}
            </select>
          </div>

          {/* Past payroll records history button */}
          <button
            onClick={() => setViewHistoryModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors"
            title="استعراض المسيرات السابقة المعتمدة"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span>السجلات ({payrollRecords.length})</span>
          </button>

          {/* End of Service Settlement Button */}
          <button
            onClick={() => {
              setSettlementEmpId('');
              setSettlementDate(new Date().toISOString().slice(0, 10));
              setSettlementStartDate('');
              setSettlementEndDate('');
              setSettlementLeavePayout(0);
              setSettlementGratuity(0);
              setSettlementOtherDeductions(0);
              setSettlementReason('resignation');
              setSettlementReasonDetails('');
              setSettlementNotes('');
              setShowSettlementModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-sm font-bold rounded-xl transition-colors shadow-2xs"
            title="إجراء تسوية ومخالصة نهاية خدمة فردية لموظف (إبراء ذمة مالي وقانوني)"
          >
            <UserX className="w-4 h-4 text-amber-700" />
            <span>مخالصة نهاية خدمة</span>
          </button>

          {/* Past Settlements History Button */}
          <button
            onClick={() => setViewSettlementsHistoryModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors"
            title="استعراض سجل المخالصات وتصفية المستحقات السابقة"
          >
            <FileCheck className="w-4 h-4 text-slate-500" />
            <span>المخالصات ({settlements.length})</span>
          </button>

          {selectedMonth && (
            <>
              {/* Export Excel */}
              <button
                onClick={exportToExcel}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors"
                title="تصدير كشف المسير لملف Excel"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Excel</span>
              </button>

              {/* Print Options Dropdown */}
              {hasPermission('hr', 'print') && (
                <div className="relative">
                  <button
                    onClick={() => setShowPrintDropdown(prev => !prev)}
                    className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-xl transition-all shadow-xs"
                    title="خيارات الطباعة"
                  >
                    <Printer className="w-4 h-4" />
                    <span>خيارات الطباعة</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  {showPrintDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowPrintDropdown(false)}
                      />
                      <div className="absolute left-0 mt-2 w-84 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 text-right animate-in fade-in zoom-in-95">
                        <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800">مستندات وخيارات الطباعة</span>
                          <span className="text-[10px] text-slate-500 font-mono">شهر {selectedMonth}</span>
                        </div>

                        {/* Option 1: Master Payroll Sheet */}
                        <button
                          onClick={() => {
                            setShowPrintDropdown(false);
                            handlePrint();
                          }}
                          className="w-full px-4 py-3 text-right hover:bg-slate-50 transition-colors flex items-start gap-3 border-b border-slate-100 group"
                        >
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl shrink-0 mt-0.5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">كشف مسير الرواتب العام (الإجمالي)</div>
                            <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                              جدول إجمالي شامل لجميع العاملين للاعتماد وتوقيع الاستلام
                            </div>
                          </div>
                        </button>

                        {/* Option 2: Individual Employee Payslips with Attendance Sheet */}
                        <button
                          onClick={() => {
                            setShowPrintDropdown(false);
                            handlePrintPayslips();
                          }}
                          className="w-full px-4 py-3 text-right hover:bg-emerald-50/50 transition-colors flex items-start gap-3 group"
                        >
                          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0 mt-0.5 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <span>قسائم الرواتب الفردية</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">ورقة منفصلة لكل موظف</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                              طباعة ورقة منفصلة لكل موظف تشمل الراتب والاستقطاعات والبدلات وكشف الحضور
                            </div>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Finalize / Update Button */}
              {hasPermission('hr', 'payroll') && (
                <button
                  onClick={handleOpenApproveModal}
                  className={`flex items-center gap-2 px-4 py-2 font-bold text-sm rounded-xl transition-all shadow-xs text-white ${
                    existingFinalized && !isLiveMode
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{existingFinalized && !isLiveMode ? 'تعديل الاعتماد' : 'اعتماد المسير'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Initial Empty State (When no month is selected yet) ─────────────── */}
      {!selectedMonth && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
            <FileText className="w-10 h-10" />
          </div>

          <div className="max-w-lg mx-auto space-y-2">
            <h3 className="text-xl font-black text-slate-800">
              اختر شهر الاستحقاق لعرض أو إعداد مسير الرواتب
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              لحماية البيانات وتجنب الالتباس، لا يتم عرض أي حسابات حتى يتم اختيار الشهر المرغوب. يمكنك البدء باختيار الشهر الحالي مباشرة أو أي شهر سابق من القائمة أعلاه.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => handleSelectMonth(currentYearMonth)}
              className="w-full sm:w-auto px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>عرض مسير شهر {formatMonthArabic(currentYearMonth)} (الشهر الحالي)</span>
            </button>

            {payrollRecords.length > 0 && (
              <button
                onClick={() => setViewHistoryModal(true)}
                className="w-full sm:w-auto px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <History className="w-4 h-4 text-slate-500" />
                <span>استعراض المسيرات المعتمدة ({payrollRecords.length})</span>
              </button>
            )}
          </div>

          {/* Quick List of Approved Past Records */}
          {payrollRecords.length > 0 && (
            <div className="pt-6 border-t border-slate-100 max-w-xl mx-auto">
              <div className="text-xs font-bold text-slate-400 mb-3">المسيرات المعتمدة المحفوظة مؤخراً:</div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {payrollRecords.slice(0, 6).map(rec => (
                  <button
                    key={rec.id}
                    onClick={() => handleSelectMonth(rec.month)}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg text-xs font-bold text-slate-700 hover:text-blue-700 transition-colors flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{formatMonthArabic(rec.month)}</span>
                    <span className="font-mono text-[10px] text-slate-400">({rec.month})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Active Month Content (Shown once month is selected) ─────────────── */}
      {selectedMonth && (
        <div className="space-y-6">
          {/* Period Range & Operational Status Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>شهر الاستحقاق:</span>
                  <span className="text-blue-700 font-mono bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                    {formatMonthArabic(selectedMonth)} ({selectedMonth})
                  </span>
                </div>
              </div>

              {/* Status & Live Sync Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {existingFinalized && !isLiveMode ? (
                  <>
                    <button
                      onClick={() => setIsLiveMode(true)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                      title="إعادة احتساب مسودة جديدة بحسب أحدث السلفيات والخصومات وسجلات البصمة"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>إعادة الاحتساب المباشر (تحديث مع السلف والبصمات)</span>
                    </button>
                    <button
                      onClick={handleUnfinalize}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                      title="إلغاء الاعتماد والعودة لمسودة قابلة للتعديل"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>إلغاء الاعتماد</span>
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      يتم الاحتساب والتحديث لحظياً
                    </span>
                    {existingFinalized && isLiveMode && (
                      <button
                        onClick={() => setIsLiveMode(false)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                      >
                        العودة للنسخة المعتمدة
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Date Range Selection & Presets */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div className="flex items-center flex-wrap gap-2.5">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  الفترة الزمنية للاحتساب:
                </span>
                <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 px-1 font-bold">من:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => {
                      setStartDate(e.target.value);
                      setIsLiveMode(true);
                    }}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono text-xs font-bold text-slate-800 outline-none"
                  />
                  <span className="text-[11px] text-slate-500 px-1 font-bold">إلى:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => {
                      setEndDate(e.target.value);
                      setIsLiveMode(true);
                    }}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Date Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400 font-bold">نماذج سريعة:</span>
                <button
                  onClick={applyPresetFullMonth}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors"
                >
                  كامل الشهر (1 - النهاية)
                </button>
                <button
                  onClick={applyPresetCycle25}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors"
                >
                  دورة 25 إلى 24
                </button>
                <button
                  onClick={applyPresetCycle26}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors"
                >
                  دورة 26 إلى 25
                </button>
              </div>
            </div>

            {/* Approved Record Memo / Note Banner */}
            {existingFinalized && !isLiveMode && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-bold">سجل معتمد رسمياً: </span>
                  <span>تم الاعتماد بواسطة ({existingFinalized.approvedBy || 'المسؤول'}) بتاريخ {new Date(existingFinalized.approvedAt || existingFinalized.generatedAt).toLocaleString('ar-LY')}.</span>
                  {existingFinalized.notes && (
                    <div className="text-emerald-800 font-bold mt-0.5">
                      الملاحظات: "{existingFinalized.notes}"
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {existingFinalized.paymentMethod && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white text-emerald-800 border border-emerald-300">
                      طريقة الصرف: {existingFinalized.paymentMethod}
                    </span>
                  )}
                  {hasPermission('hr', 'print') && (
                    <button
                      onClick={() => handlePrintPayslips()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
                      title="طباعة قسيمة منفصلة لكل موظف مع كشف الحضور"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>طباعة قسائم الرواتب (ورقة لكل موظف)</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── KPI Stats Cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Net Salary Card */}
            <div className="col-span-2 sm:col-span-1 lg:col-span-2 bg-blue-600 text-white p-4 rounded-xl shadow-xs">
              <div className="text-xs font-bold text-blue-100 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" />
                  صافي الرواتب المستحقة للصرف حالياً
                </span>
                {totals.totalSettledOffCyclePaid > 0 && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-400 text-amber-950 font-black">
                    مخالصات مسواة
                  </span>
                )}
              </div>
              <div className="text-2xl font-black mt-1 dir-ltr font-mono">
                {formatCurrency(totals.totalPayableCurrent)} د.ل
              </div>
              <div className="text-[11px] text-blue-200 mt-1 flex items-center justify-between">
                <span>إجمالي {filteredItems.length} موظف مشمول</span>
                {totals.totalSettledOffCyclePaid > 0 && (
                  <span className="text-amber-200 font-bold">
                    صُرف بمخالصات: {formatCurrency(totals.totalSettledOffCyclePaid)} د.ل
                  </span>
                )}
              </div>
            </div>

            {/* Base Salaries */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
              <div className="text-[11px] font-bold text-slate-500">الرواتب الأساسية / المقررة</div>
              <div className="text-lg font-black text-slate-800 mt-1 dir-ltr font-mono">
                {formatCurrency(totals.totalBase)} د.ل
              </div>
            </div>

            {/* Overtime */}
            <div className="bg-purple-50/80 border border-purple-200 p-3.5 rounded-xl">
              <div className="text-[11px] font-bold text-purple-700 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                العمل الإضافي (+)
              </div>
              <div className="text-lg font-black text-purple-800 mt-1 dir-ltr font-mono">
                +{formatCurrency(totals.totalOvertime)} د.ل
              </div>
            </div>

            {/* Bonuses & Allowances */}
            <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-xl">
              <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                مكافآت وبدلات (+)
              </div>
              <div className="text-lg font-black text-emerald-800 mt-1 dir-ltr font-mono">
                +{formatCurrency(totals.totalAdditions)} د.ل
              </div>
              <div className="text-[10px] text-emerald-600 font-mono mt-0.5">
                مكافأة: {totals.totalBonuses} | بدل: {totals.totalAllowances}
              </div>
            </div>

            {/* Advances & Deductions */}
            <div className="bg-red-50/80 border border-red-200 p-3.5 rounded-xl">
              <div className="text-[11px] font-bold text-red-700 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" />
                سلفيات وخصم (-)
              </div>
              <div className="text-lg font-black text-red-800 mt-1 dir-ltr font-mono">
                -{formatCurrency(totals.totalAdvAndDed)} د.ل
              </div>
              <div className="text-[10px] text-red-600 font-mono mt-0.5">
                سلف: {totals.totalAdvances} | جزاء: {totals.totalDeductions}
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="بحث في كشف المسير باسم الموظف، القسم، أو كود البصمة..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* ── Detailed Payroll Table ───────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50/90 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3">الموظف</th>
                    <th className="p-3">القسم</th>
                    <th className="p-3 text-center">نظام الراتب</th>
                    <th className="p-3 text-center">الأساسي / اليومية</th>
                    <th className="p-3 text-center">أيام الحضور</th>
                    <th className="p-3 text-center">الغياب</th>
                    <th className="p-3 text-center">التأخير والخروج</th>
                    <th className="p-3 text-center">خصم التأخير</th>
                    <th className="p-3 text-center">الإضافي</th>
                    <th className="p-3 text-center">قيمة الإضافي</th>
                    <th className="p-3 text-center bg-emerald-50/50 text-emerald-900">مكافآت وبدلات (+)</th>
                    <th className="p-3 text-center bg-red-50/50 text-red-900">سلفيات وخصم (-)</th>
                    <th className="p-3 text-center font-black text-sm bg-blue-50/60 text-blue-900">صافي المستحق</th>
                    <th className="p-3 w-20 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item, idx) => {
                    const rowBonuses = item.bonuses || 0;
                    const rowAllowances = item.allowances || 0;
                    const totalRowAdditions = rowBonuses + rowAllowances;

                    const rowAdvances = item.advances || 0;
                    const rowDeductions = item.deductions || 0;
                    const totalRowAdvAndDed = rowAdvances + rowDeductions;

                    const rowDelayDed = item.delayDeduction ?? ((item.lateDeduction || 0) + (item.earlyDeduction || 0));

                    return (
                      <tr key={item.employeeId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            <span>{item.employeeName}</span>
                            {item.isSettledOffCycle && (
                              <span className="text-amber-800 font-sans font-bold text-[9px] bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                                <UserX className="w-2.5 h-2.5" />
                                مُصفى بمخالصة
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                            {item.badgeNumber && item.badgeNumber !== item.employeeId ? (
                              <span className="flex items-center gap-1">
                                <span>#{item.badgeNumber}</span>
                                {item.attendanceMode === 'overtime_only' && (
                                  <span className="text-amber-700 font-sans font-bold text-[9px] bg-amber-50 px-1 rounded border border-amber-200">
                                    إضافي فقط
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-purple-600 font-sans font-bold text-[10px] bg-purple-50 px-1 rounded border border-purple-200">
                                بدون بصمة
                              </span>
                            )}
                            <span>•</span>
                            <span className="font-sans text-slate-500">{item.jobTitle}</span>
                          </div>
                        </td>
                        <td className="p-3 text-slate-700">{item.deptName}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.salaryType === 'daily' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {item.salaryType === 'daily' ? 'يومية' : 'شهري'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold font-mono dir-ltr">
                          {formatCurrency(item.baseSalaryOrRate)}
                        </td>
                        <td className="p-3 text-center font-bold font-mono text-emerald-700">
                          {item.actualWorkDays} / {item.expectedDays}
                        </td>
                        <td className="p-3 text-center font-bold font-mono">
                          {item.absentDays > 0 ? (
                            <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{item.absentDays}</span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono">
                          {((item.lateMinutes || 0) > 0 || (item.earlyMinutes || 0) > 0) ? (
                            <div className="flex flex-col items-center gap-0.5">
                              {(item.lateMinutes || 0) > 0 && (
                                <span className="text-amber-700 font-bold" title="دقائق التأخير الصباحي وبصمة ناقصة">
                                  تأخير: {item.lateMinutes} د
                                </span>
                              )}
                              {(item.earlyMinutes || 0) > 0 && (
                                <span className="text-orange-700 font-bold" title="دقائق الخروج المبكر">
                                  خروج: {item.earlyMinutes} د
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono text-red-600 dir-ltr">
                          {rowDelayDed > 0 ? `-${formatCurrency(rowDelayDed)}` : '-'}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-purple-700">
                          {item.overtimeHours > 0 ? `${item.overtimeHours} س` : '-'}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-purple-700 dir-ltr">
                          {item.overtimeAmount > 0 ? `+${formatCurrency(item.overtimeAmount)}` : '-'}
                        </td>

                        {/* Bonuses & Allowances */}
                        <td className="p-3 text-center font-mono text-emerald-700 dir-ltr bg-emerald-50/20">
                          {totalRowAdditions > 0 ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-bold">+{formatCurrency(totalRowAdditions)}</span>
                              <div className="flex items-center gap-1 text-[10px] text-emerald-800">
                                {rowBonuses > 0 && <span>مكافأة: {rowBonuses}</span>}
                                {rowBonuses > 0 && rowAllowances > 0 && <span>|</span>}
                                {rowAllowances > 0 && <span>بدل: {rowAllowances}</span>}
                              </div>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>

                        {/* Advances & Deductions */}
                        <td className="p-3 text-center font-mono text-red-600 dir-ltr bg-red-50/20">
                          {totalRowAdvAndDed > 0 ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-bold">-{formatCurrency(totalRowAdvAndDed)}</span>
                              <div className="flex items-center gap-1 text-[10px] text-red-700">
                                {rowAdvances > 0 && <span>سلفة: {rowAdvances}</span>}
                                {rowAdvances > 0 && rowDeductions > 0 && <span>|</span>}
                                {rowDeductions > 0 && <span>جزاء: {rowDeductions}</span>}
                              </div>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>

                        {/* Net Payout */}
                        <td className="p-3 text-center font-black font-mono text-sm text-blue-900 bg-blue-50/50 dir-ltr">
                          {item.isSettledOffCycle ? (
                            <div className="flex flex-col items-center">
                              <span className="font-black font-mono text-xs text-amber-900 dir-ltr">0.00 د.ل</span>
                              <span
                                className="text-[9px] font-sans font-bold text-amber-700 bg-amber-100/70 border border-amber-300 px-1.5 py-0.5 rounded mt-0.5 cursor-help"
                                title={`تمت تسوية وصرف مستحقات الموظف بالكامل بموجب المخالصة رقم (${item.settlementId}) بتاريخ ${item.settlementDate}`}
                              >
                                صُرف بمخالصة ({formatCurrency(item.settlementAmountPaid || item.netSalary)})
                              </span>
                            </div>
                          ) : (
                            <span>{formatCurrency(item.netSalary)} د.ل</span>
                          )}
                        </td>

                        {/* Actions: Inspect, Print Settlement, & Print Payslip */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setInspectingItem(item)}
                              className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                              title="عرض تفاصيل وكشف حساب الموظف لهذا الشهر"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {item.isSettledOffCycle && (
                              <button
                                onClick={() => {
                                  const found = settlements.find(s => s.id === item.settlementId);
                                  if (found) handlePrintSettlement(found);
                                  else alert('تعذر العثور على سجل المخالصة');
                                }}
                                className="p-1.5 hover:bg-amber-50 text-amber-700 rounded-lg transition-colors"
                                title="طباعة وثيقة المخالصة الرسمية وإبراء الذمة"
                              >
                                <FileCheck className="w-4 h-4" />
                              </button>
                            )}
                            {hasPermission('hr', 'print') && (
                              <button
                                onClick={() => handlePrintPayslips([item])}
                                className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-700 rounded-lg transition-colors"
                                title="طباعة ورقة قسيمة الراتب المنفصلة مع كشف الحضور لهذا الموظف"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={15} className="p-8 text-center text-slate-400">
                        لا توجد بيانات موظفين تطابق البحث.
                      </td>
                    </tr>
                  )}
                </tbody>

                {filteredItems.length > 0 && (
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                    <tr>
                      <td colSpan={4} className="p-3 text-right">الإجمالي العام:</td>
                      <td className="p-3 text-center font-mono dir-ltr">{formatCurrency(totals.totalBase)}</td>
                      <td colSpan={3}></td>
                      <td className="p-3 text-center font-mono text-red-600 dir-ltr">-{formatCurrency(totals.totalDelayDeductions)}</td>
                      <td></td>
                      <td className="p-3 text-center font-mono text-purple-700 dir-ltr">+{formatCurrency(totals.totalOvertime)}</td>
                      <td className="p-3 text-center font-mono text-emerald-700 dir-ltr">+{formatCurrency(totals.totalAdditions)}</td>
                      <td className="p-3 text-center font-mono text-red-600 dir-ltr">-{formatCurrency(totals.totalAdvAndDed)}</td>
                      <td className="p-3 text-center font-black text-sm text-blue-900 bg-blue-100/60 dir-ltr">
                        <div>{formatCurrency(totals.totalPayableCurrent)} د.ل</div>
                        {totals.totalSettledOffCyclePaid > 0 && (
                          <div className="text-[10px] text-amber-800 font-normal mt-0.5" title="مبالغ صُرفت مسبقاً بموجب مخالصات نهاية خدمة">
                            (+{formatCurrency(totals.totalSettledOffCyclePaid)} صُرف بمخالصات)
                          </div>
                        )}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Approval Modal (نافذة اعتماد المسير وربط المدة والملاحظات) ───────── */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                اعتماد مسير الرواتب - {formatMonthArabic(selectedMonth)}
              </h3>
              <button
                onClick={() => setShowApproveModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Period Confirmation */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                <div className="text-xs font-bold text-blue-900 flex items-center justify-between">
                  <span>الفترة المعتمدة لاحتساب المسير:</span>
                  <span className="font-mono text-blue-700 font-bold">{startDate} إلى {endDate}</span>
                </div>
                <div className="text-[11px] text-blue-600">
                  سيتم حفظ واعتماد مسير رواتب لعدد ({livePayrollItems.length}) موظف مسجل.
                </div>
              </div>

              {/* Financial Breakdown Summary */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">إجمالي الرواتب الأساسية / المقررة:</span>
                  <span className="font-bold font-mono dir-ltr">{formatCurrency(totals.totalBase)} د.ل</span>
                </div>
                <div className="flex justify-between items-center text-purple-700">
                  <span>إجمالي مستحقات ساعات الإضافي (+):</span>
                  <span className="font-bold font-mono dir-ltr">+{formatCurrency(totals.totalOvertime)} د.ل</span>
                </div>
                <div className="flex justify-between items-center text-emerald-700">
                  <span>إجمالي المكافآت والبدلات المضافة (+):</span>
                  <span className="font-bold font-mono dir-ltr">+{formatCurrency(totals.totalAdditions)} د.ل</span>
                </div>
                <div className="flex justify-between items-center text-amber-700">
                  <span>إجمالي خصومات التأخير والخروج (-):</span>
                  <span className="font-bold font-mono dir-ltr">-{formatCurrency(totals.totalDelayDeductions)} د.ل</span>
                </div>
                <div className="flex justify-between items-center text-red-700">
                  <span>إجمالي السلفيات والخصومات الجزائية (-):</span>
                  <span className="font-bold font-mono dir-ltr">-{formatCurrency(totals.totalAdvAndDed)} د.ل</span>
                </div>
                <div className="pt-2 border-t border-slate-300 flex justify-between items-center text-base font-black text-slate-900">
                  <span>صافي المبلغ المطلوب للصرف:</span>
                  <span className="font-mono text-blue-700 dir-ltr text-lg">{formatCurrency(totals.totalNet)} د.ل</span>
                </div>
              </div>

              {/* Notes Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظات وبيان الاعتماد (Memo / Notes)
                </label>
                <textarea
                  rows={2}
                  placeholder="مثال: تم اعتماد رواتب شهر نوفمبر شاملة مكافأة مشروع الصيانة وخصم السلفيات المتبقية..."
                  value={approvalNotes}
                  onChange={e => setApprovalNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              {/* Payout Date & Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الصرف المقترح</label>
                  <input
                    type="date"
                    value={payoutDate}
                    onChange={e => setPayoutDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الصرف</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                  >
                    <option value="نقداً">نقداً (خزينة)</option>
                    <option value="تحويل مصرفي">تحويل مصرفي</option>
                    <option value="صك مصرفي">صك مصرفي</option>
                    <option value="مختلط">مختلط</option>
                  </select>
                </div>
              </div>

              <div className="text-[11px] text-slate-400">
                المسؤول عن الاعتماد: <span className="font-bold text-slate-700">{currentUser?.displayName || 'المسؤول الحالي'}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmFinalize}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>تأكيد الاعتماد والحفظ الرسمي</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Employee Breakdown Inspection Modal ─────────────────────────────── */}
      {inspectingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <span>كشف استحقاق: {inspectingItem.employeeName}</span>
                </h3>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  كود: #{inspectingItem.badgeNumber || 'بدون بصمة'} • {inspectingItem.jobTitle} • {inspectingItem.deptName}
                </div>
              </div>
              <button
                onClick={() => setInspectingItem(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Attendance & Salary Basis */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">نظام الراتب: </span>
                  <span className="font-bold text-slate-800">{inspectingItem.salaryType === 'daily' ? 'يومية' : 'شهري'}</span>
                </div>
                <div>
                  <span className="text-slate-500">الأساسي / اليومية: </span>
                  <span className="font-bold font-mono dir-ltr">{formatCurrency(inspectingItem.baseSalaryOrRate)} د.ل</span>
                </div>
                <div>
                  <span className="text-slate-500">أيام الحضور الفعلية: </span>
                  <span className="font-bold text-emerald-700 font-mono">{inspectingItem.actualWorkDays} / {inspectingItem.expectedDays}</span>
                </div>
                <div>
                  <span className="text-slate-500">أيام الغياب: </span>
                  <span className="font-bold text-red-600 font-mono">{inspectingItem.absentDays} يوم</span>
                </div>
              </div>

              {/* Delays & Overtime */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl">
                  <div className="font-bold text-amber-900">التأخير والخروج المبكر</div>
                  <div className="text-[11px] text-amber-800 mt-1">
                    تأخير: {inspectingItem.lateMinutes || 0} دقيقة
                    {(inspectingItem.earlyMinutes || 0) > 0 && ` | خروج: ${inspectingItem.earlyMinutes} دقيقة`}
                  </div>
                  <div className="font-bold text-red-700 mt-1 font-mono dir-ltr">
                    خصم: -{formatCurrency(inspectingItem.delayDeduction ?? ((inspectingItem.lateDeduction || 0) + (inspectingItem.earlyDeduction || 0)))} د.ل
                  </div>
                </div>

                <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl">
                  <div className="font-bold text-purple-900">ساعات العمل الإضافي</div>
                  <div className="text-[11px] text-purple-800 mt-1">
                    إجمالي: {inspectingItem.overtimeHours || 0} ساعة
                  </div>
                  <div className="font-bold text-purple-700 mt-1 font-mono dir-ltr">
                    مستحق: +{formatCurrency(inspectingItem.overtimeAmount || 0)} د.ل
                  </div>
                </div>
              </div>

              {/* Detailed Transactions List for this employee */}
              <div className="space-y-2">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>حركات السلف والمكافآت المسجلة للموظف:</span>
                  <span className="text-[11px] font-normal text-slate-500">الفترة النشطة</span>
                </div>
                {getEmployeeTransactions(inspectingItem.employeeId).length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                    {getEmployeeTransactions(inspectingItem.employeeId).map(t => (
                      <div key={t.id} className="p-2.5 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            {t.type === 'advance' && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">سلفة</span>}
                            {t.type === 'deduction' && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">خصم جزائي</span>}
                            {t.type === 'bonus' && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">مكافأة</span>}
                            {t.type === 'allowance' && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">بدل</span>}
                            <span className="text-slate-700 font-medium">{t.reason || 'بدون بيان'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{t.date}</div>
                        </div>
                        <div className={`font-mono font-bold dir-ltr ${
                          t.type === 'advance' || t.type === 'deduction' ? 'text-red-600' : 'text-emerald-700'
                        }`}>
                          {t.type === 'advance' || t.type === 'deduction' ? '-' : '+'}{formatCurrency(t.amount)} د.ل
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400">
                    لا توجد سلف أو مكافآت مسجلة في هذا الشهر
                  </div>
                )}
              </div>

              {/* Net Salary Formula Box */}
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5">
                <div className="font-bold text-blue-950 flex justify-between items-center text-sm">
                  <span>صافي المستحق النهائي للصرف:</span>
                  <span className="font-mono text-base font-black dir-ltr text-blue-800">{formatCurrency(inspectingItem.netSalary)} د.ل</span>
                </div>
                <div className="text-[11px] text-blue-700 leading-relaxed font-mono">
                  المعادلة: الراتب المستحق ({formatCurrency(inspectingItem.earnedSalary)}) + إضافي ({formatCurrency(inspectingItem.overtimeAmount)}) + مكافآت وبدلات ({formatCurrency((inspectingItem.bonuses || 0) + (inspectingItem.allowances || 0))}) - خصم التأخير ({formatCurrency(inspectingItem.delayDeduction ?? ((inspectingItem.lateDeduction || 0) + (inspectingItem.earlyDeduction || 0)))}) - سلف وخصومات ({formatCurrency((inspectingItem.advances || 0) + (inspectingItem.deductions || 0))})
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              {hasPermission('hr', 'print') ? (
                <button
                  onClick={() => {
                    handlePrintPayslips([inspectingItem]);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                  title="طباعة ورقة قسيمة الراتب المنفصلة مع كشف الحضور لهذا الموظف"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-400" />
                  <span>طباعة قسيمة الراتب وكشف الحضور</span>
                </button>
              ) : <div />}
              <button
                onClick={() => setInspectingItem(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── History Modal (سجلات المسيرات المعتمدة) ─────────────────────────── */}
      {viewHistoryModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                سجل مسيرات الرواتب المعتمدة
              </h3>
              <button
                onClick={() => setViewHistoryModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-3">
              {payrollRecords.map(rec => (
                <div
                  key={rec.id}
                  className="p-4 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-xl flex items-center justify-between transition-colors"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-base font-mono flex items-center gap-2">
                      <span>{formatMonthArabic(rec.month)}</span>
                      <span className="text-xs text-slate-400">({rec.month})</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      <span>معتمد بتاريخ: {new Date(rec.approvedAt || rec.generatedAt).toLocaleDateString('ar-LY')}</span>
                      <span> • {rec.data?.length || 0} موظف</span>
                      {rec.approvedBy && <span> • بواسطة: {rec.approvedBy}</span>}
                    </div>
                    {rec.notes && (
                      <div className="text-xs text-slate-600 italic mt-1 bg-white p-1.5 rounded border border-slate-100">
                        "{rec.notes}"
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-left font-mono font-black text-blue-700 text-sm dir-ltr">
                      {formatCurrency(rec.totalNet)} د.ل
                    </div>
                    <button
                      onClick={() => {
                        handleSelectMonth(rec.month);
                        setViewHistoryModal(false);
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors"
                    >
                      فتح الشهر
                    </button>
                    {hasPermission('hr', 'delete') && (
                      <button
                        onClick={async () => {
                          if (!window.confirm(`هل أنت متأكد من حذف سجل اعتماد شهر (${rec.month})؟`)) return;
                          await deletePayrollRecord(rec.month);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف هذا السجل"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {payrollRecords.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  لم يتم اعتماد أي مسير رواتب سابق حتى الآن.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Settlement / Clearance Creation Modal ────────────────────────────── */}
      {showSettlementModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">مخالصة وتصفية مستحقات نهاية خدمة (إبراء ذمة)</h3>
                  <p className="text-[11px] text-slate-400">
                    تسوية مستحقات الموظف المنقطع أو المنتهية خدماته بشكل فردي وفوري دون تضارب مع المسير الشهري العام
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSettlementModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Employee Picker */}
              <div className="bg-slate-50 p-3.5 border border-slate-200 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  اختيار الموظف المراد تصفية مستحقاته <span className="text-red-500">*</span>
                </label>
                <select
                  value={settlementEmpId}
                  onChange={e => {
                    const empId = e.target.value;
                    setSettlementEmpId(empId);
                    if (empId) {
                      const curDate = settlementDate || new Date().toISOString().slice(0, 10);
                      const curMonth = curDate.slice(0, 7);
                      setSettlementStartDate(`${curMonth}-01`);
                      setSettlementEndDate(curDate);
                    }
                  }}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                >
                  <option value="">-- اختر الموظف من القائمة --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.deptName || 'عام'} - {emp.jobTitle || 'موظف'})
                      {emp.isActive === false ? ' [غير نشط حالياً]' : ''}
                    </option>
                  ))}
                </select>

                {settlementPreview?.emp && (
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">نظام الراتب:</span>
                      <strong className="text-slate-800">{settlementPreview.emp.salaryType === 'daily' ? 'يومية' : 'شهري'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">الأساسي / اليومية:</span>
                      <strong className="text-slate-800 font-mono dir-ltr">{formatCurrency(settlementPreview.baseSalaryOrRate)} د.ل</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">كود البصمة:</span>
                      <strong className="text-slate-800 font-mono">#{settlementPreview.emp.badgeNumber || 'بدون بصمة'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">تاريخ التعيين:</span>
                      <strong className="text-slate-800 font-mono">{settlementPreview.emp.hireDate || '-'}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Separation & Period Controls */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 border border-slate-200 rounded-xl">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ المخالصة / التصفية</label>
                  <input
                    type="date"
                    value={settlementDate}
                    onChange={e => {
                      const d = e.target.value;
                      setSettlementDate(d);
                      if (d) {
                        setSettlementEndDate(d);
                        if (!settlementStartDate) setSettlementStartDate(`${d.slice(0, 7)}-01`);
                      }
                    }}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">سبب ترك العمل</label>
                  <select
                    value={settlementReason}
                    onChange={e => setSettlementReason(e.target.value as any)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none"
                  >
                    <option value="resignation">استقالة</option>
                    <option value="termination">فصل / إنهاء خدمة</option>
                    <option value="contract_end">انتهاء مدة العقد</option>
                    <option value="mutual_agreement">تسوية ودية وتراضي</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">بداية فترة الاحتساب</label>
                  <input
                    type="date"
                    value={settlementStartDate}
                    onChange={e => setSettlementStartDate(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نهاية فترة الاحتساب</label>
                  <input
                    type="date"
                    value={settlementEndDate}
                    onChange={e => setSettlementEndDate(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none"
                  />
                </div>
                <div className="col-span-2 sm:col-span-4">
                  <label className="block font-bold text-slate-700 mb-1">تفاصيل أو بيان سبب إنهاء العمل (اختياري)</label>
                  <input
                    type="text"
                    placeholder="مثال: بناء على طلب الموظف لظروف خاصة / انتهاء المشروع المكلف به..."
                    value={settlementReasonDetails}
                    onChange={e => setSettlementReasonDetails(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                  />
                </div>
              </div>

              {/* Financial Calculation Breakdown */}
              {settlementPreview && (
                <div className="space-y-3">
                  <div className="font-bold text-slate-900 flex items-center justify-between text-xs">
                    <span>جدول احتساب المستحقات والاستقطاعات الفعلية:</span>
                    <span className="text-[11px] text-blue-700 font-mono">
                      الفترة: {settlementStartDate || `${settlementDate.slice(0, 7)}-01`} إلى {settlementEndDate || settlementDate}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {/* Additions Box */}
                    <div className="p-3 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-2">
                      <div className="font-bold text-emerald-900 border-b border-emerald-200 pb-1 flex justify-between">
                        <span>المستحقات والإضافات (+)</span>
                        <span className="font-mono dir-ltr font-black">+{formatCurrency(settlementPreview.totalAdditions)} د.ل</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>أيام العمل الفعلية ({settlementPreview.monthAttendance?.actualWorkDays || 0} يوم):</span>
                        <span className="font-mono font-bold text-slate-900 dir-ltr">{formatCurrency(settlementPreview.earnedSalary)} د.ل</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>ساعات الإضافي ({settlementPreview.overtimeHours}س):</span>
                        <span className="font-mono font-bold text-emerald-700 dir-ltr">+{formatCurrency(settlementPreview.overtimeAmount)} د.ل</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>المكافآت والبدلات المسجلة:</span>
                        <span className="font-mono font-bold text-emerald-700 dir-ltr">+{formatCurrency(settlementPreview.bonuses + settlementPreview.allowances)} د.ل</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] pt-1 border-t border-emerald-200">
                        <label className="text-emerald-950 font-bold">تعويض رصيد الإجازات:</label>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={settlementLeavePayout || ''}
                          onChange={e => setSettlementLeavePayout(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-24 p-1 bg-white border border-emerald-300 rounded text-left font-mono font-bold text-xs"
                        />
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <label className="text-emerald-950 font-bold">مكافأة نهاية الخدمة:</label>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={settlementGratuity || ''}
                          onChange={e => setSettlementGratuity(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-24 p-1 bg-white border border-emerald-300 rounded text-left font-mono font-bold text-xs"
                        />
                      </div>
                    </div>

                    {/* Deductions Box */}
                    <div className="p-3 bg-red-50/70 border border-red-300 rounded-xl space-y-2">
                      <div className="font-bold text-red-900 border-b border-red-200 pb-1 flex justify-between">
                        <span>الاستقطاعات والخصومات (-)</span>
                        <span className="font-mono dir-ltr font-black">-{formatCurrency(settlementPreview.totalDeductions)} د.ل</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>خصم التأخير والخروج ({settlementPreview.lateMinutes + settlementPreview.earlyMinutes}د):</span>
                        <span className="font-mono font-bold text-red-700 dir-ltr">{settlementPreview.delayDeduction > 0 ? `-${formatCurrency(settlementPreview.delayDeduction)} د.ل` : '-'}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>السلفيات المستحقة للشهر:</span>
                        <span className="font-mono font-bold text-red-700 dir-ltr">{settlementPreview.advances > 0 ? `-${formatCurrency(settlementPreview.advances)} د.ل` : '-'}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>جزاءات وخصومات أخرى:</span>
                        <span className="font-mono font-bold text-red-700 dir-ltr">{settlementPreview.deductions > 0 ? `-${formatCurrency(settlementPreview.deductions)} د.ل` : '-'}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] pt-1 border-t border-red-200">
                        <label className="text-red-950 font-bold">استقطاع تسوية عهدة / أخرى:</label>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={settlementOtherDeductions || ''}
                          onChange={e => setSettlementOtherDeductions(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-24 p-1 bg-white border border-red-300 rounded text-left font-mono font-bold text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Net Payout Banner with Tafqeet */}
                  <div className="p-4 bg-gradient-to-r from-amber-50 to-amber-100/60 border-2 border-amber-400 rounded-xl flex items-center justify-between shadow-xs">
                    <div>
                      <div className="text-xs font-bold text-amber-950">صافي المستحق النهائي للصرف بموجب المخالصة:</div>
                      <div className="text-[11px] text-amber-800 font-bold mt-0.5">
                        فقط {numberToArabicWords(settlementPreview.netPayable)} دينار ليبي لا غير.
                      </div>
                    </div>
                    <div className="text-2xl font-black font-mono text-amber-950 dir-ltr bg-white px-4 py-1.5 rounded-xl border border-amber-300 shadow-2xs">
                      {formatCurrency(settlementPreview.netPayable)} د.ل
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Method & Notes */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">طريقة الصرف</label>
                  <select
                    value={settlementPaymentMethod}
                    onChange={e => setSettlementPaymentMethod(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                  >
                    <option value="نقداً">نقداً (خزينة)</option>
                    <option value="تحويل مصرفي">تحويل مصرفي</option>
                    <option value="صك مصدق">صك مصدق</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ملاحظات المخالصة</label>
                  <input
                    type="text"
                    placeholder="ملاحظات إضافية على المخالصة..."
                    value={settlementNotes}
                    onChange={e => setSettlementNotes(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                  />
                </div>
              </div>

              {/* Reassurance Notice */}
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-[11px] text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>تأكيد النظام لعدم حدوث أي تضارب مع كشف المسير العام:</span>
                </div>
                <p className="text-blue-800 leading-relaxed">
                  عند اعتماد هذه المخالصة، سيتم حفظ تصفية الموظف بمبلغ <strong>{formatCurrency(settlementPreview?.netPayable || 0)} د.ل</strong> وإلغاء تنشيطه مع إغلاق سلفياته لهذا الشهر. وفي كشف المسير الشهري العام، سيظهر الموظف كمرجع إحصائي مع إشارة <strong>(مُصفى بمخالصة)</strong> وصافي مستحق <strong>0.00 د.ل</strong> لمنع أي تكرار أو ازدواجية في الصرف المالي.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setShowSettlementModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmSaveSettlement}
                disabled={!settlementPreview}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>تأكيد واعتماد المخالصة رسمياً</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settlements Archive / History Modal ──────────────────────────────── */}
      {viewSettlementsHistoryModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">سجل مخالصات نهاية الخدمة وإبراء الذمة</h3>
              </div>
              <button
                onClick={() => setViewSettlementsHistoryModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-3 flex-1 text-xs">
              {settlements.map(s => (
                <div
                  key={s.id}
                  className="p-4 bg-slate-50 hover:bg-amber-50/40 border border-slate-200 rounded-xl flex items-center justify-between transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-sm">{s.employeeName}</span>
                      <span className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        #{s.badgeNumber || s.employeeId}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        {s.reason === 'resignation' ? 'استقالة' :
                         s.reason === 'termination' ? 'فصل / إنهاء خدمة' :
                         s.reason === 'contract_end' ? 'انتهاء عقد' :
                         s.reason === 'mutual_agreement' ? 'تسوية ودية' : (s.reasonDetails || s.reason)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-3">
                      <span>تاريخ المخالصة: <strong className="font-mono text-slate-800">{s.settlementDate}</strong></span>
                      <span>•</span>
                      <span>عن شهر: <strong className="font-mono text-slate-800">{s.month}</strong></span>
                      <span>•</span>
                      <span>أيام العمل: <strong className="font-mono text-emerald-700">{s.actualWorkDays}</strong></span>
                      {s.approvedBy && (
                        <>
                          <span>•</span>
                          <span>بواسطة: {s.approvedBy}</span>
                        </>
                      )}
                    </div>
                    {s.notes && (
                      <div className="text-[11px] text-slate-600 italic bg-white p-1 rounded border border-slate-200">
                        "{s.notes}"
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-left font-mono font-black text-amber-900 text-base dir-ltr bg-white px-3 py-1.5 rounded-lg border border-amber-200">
                      {formatCurrency(s.netPayable)} د.ل
                    </div>
                    <button
                      onClick={() => handlePrintSettlement(s)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-xs"
                      title="طباعة وثيقة المخالصة الرسمية وإبراء الذمة"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-400" />
                      <span>طباعة المخالصة</span>
                    </button>
                    {hasPermission('hr', 'delete') && (
                      <button
                        onClick={async () => {
                          if (!window.confirm(`هل أنت متأكد من حذف مخالصة الموظف (${s.employeeName})؟\nسيتم إعادة تنشيط الموظف وإعادة فتح حركاته المالية المعلقة.`)) return;
                          await deleteSettlement(s.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف هذه المخالصة وإلغاء التسوية"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {settlements.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  لا توجد أي مخالصات نهاية خدمة مسجلة حتى الآن.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
