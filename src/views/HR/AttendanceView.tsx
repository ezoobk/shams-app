import React, { useState, useMemo, useEffect } from 'react';
import { useHR, isLogMatchingEmployee } from '../../context/HRContext';
import { useAuth } from '../../context/AuthContext';
import {
  Clock, Calendar, RefreshCw, Search, Download, Plus, CheckCircle2,
  AlertTriangle, XCircle, HelpCircle, ChevronRight, ChevronLeft, Eye, X,
  Fingerprint, UserCheck, UserX, RotateCcw, Trash2, Sparkles, AlertCircle,
  ArrowDownLeft, ArrowUpRight
} from 'lucide-react';
import type { HRAttendanceLog, HREmployee } from '../../types';
import * as XLSX from 'xlsx';

export const AttendanceView: React.FC = () => {
  const {
    employees,
    shifts,
    getEmployeeShift,
    getEmployeeShifts,
    attendanceLogs,
    setAttendanceLogs,
    analyzeDayAttendance,
    isSyncing,
    triggerSync,
    syncStats
  } = useHR();
  const { hasPermission } = useAuth();

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    try {
      const saved = window.localStorage.getItem('shams_hr_attendance_statusFilter');
      if (saved) {
        window.localStorage.removeItem('shams_hr_attendance_statusFilter');
        return JSON.parse(saved);
      }
    } catch {}
    return 'all';
  });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('shams_hr_attendance_statusFilter');
      if (saved) {
        window.localStorage.removeItem('shams_hr_attendance_statusFilter');
        setStatusFilter(JSON.parse(saved));
      }
    } catch {}
  }, []);
  const [selectedZkFilter, setSelectedZkFilter] = useState<string>('all');
  const [viewingEmpId, setViewingEmpId] = useState<string | null>(null);
  const [slotInputTimes, setSlotInputTimes] = useState<Record<string, string>>({});
  const [inlineAddOpen, setInlineAddOpen] = useState(false);
  const [inlineAddTime, setInlineAddTime] = useState('12:00');
  const [inlineAddType, setInlineAddType] = useState('I');
  const [inlineAddNotes, setInlineAddNotes] = useState('');
  const [showManualPunchModal, setShowManualPunchModal] = useState(false);
  const [manualEmpId, setManualEmpId] = useState('');
  const [manualTime, setManualTime] = useState('08:00');
  const [manualType, setManualType] = useState('I');
  const [manualNotes, setManualNotes] = useState('');

  // Change date helpers
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleSetToday = () => {
    setSelectedDate(new Date().toISOString().slice(0, 10));
  };

  // Unique departments
  const departments = useMemo(() => {
    const depts = new Set<string>();
    employees.forEach(e => {
      if (e.deptName) depts.add(e.deptName);
    });
    return Array.from(depts);
  }, [employees]);

  // Analyzed list of attendance for all active employees
  const dailyAnalysis = useMemo(() => {
    return employees
      .filter(e => e.isActive !== false)
      .map(emp => analyzeDayAttendance(selectedDate, emp));
  }, [employees, selectedDate, attendanceLogs, analyzeDayAttendance]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return dailyAnalysis.filter(row => {
      const matchSearch =
        !searchQuery ||
        row.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(row.employee.badgeNumber || '').includes(searchQuery);

      const matchDept = selectedDept === 'all' || row.employee.deptName === selectedDept;

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'present' && (row.status === 'present' || row.status === 'late' || row.status === 'single_punch')) ||
        row.status === statusFilter;

      const matchZk =
        selectedZkFilter === 'all' ||
        (selectedZkFilter === 'zk' && row.employee.isZkLinked !== false) ||
        (selectedZkFilter === 'manual' && row.employee.isZkLinked === false);

      return matchSearch && matchDept && matchStatus && matchZk;
    });
  }, [dailyAnalysis, searchQuery, selectedDept, statusFilter, selectedZkFilter]);

  // Summary counts
  const stats = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let leave = 0;
    let singlePunch = 0;

    dailyAnalysis.forEach(r => {
      if (r.status === 'present') present++;
      else if (r.status === 'late') { present++; late++; }
      else if (r.status === 'single_punch') { present++; singlePunch++; }
      else if (r.status === 'leave') leave++;
      else if (r.status === 'absent') absent++;
    });

    return {
      total: dailyAnalysis.length,
      present,
      late,
      absent,
      leave,
      singlePunch
    };
  }, [dailyAnalysis]);

  // Fast Set of employees with manual modifications on the selected date (strictly by emp.id)
  const manualEmployeesOnSelectedDateSet = useMemo(() => {
    const set = new Set<string>();
    const len = attendanceLogs.length;
    for (let i = 0; i < len; i++) {
      const l = attendanceLogs[i];
      if (!l.checkTime || !l.checkTime.startsWith(selectedDate)) continue;
      if (l.source === 'manual' || l.checkType === 'ABSENT' || (l.notes && l.notes.includes('يدو'))) {
        set.add(String(l.userId));
      }
    }
    return set;
  }, [attendanceLogs, selectedDate]);

  // Export to Excel
  const exportToExcel = () => {
    const exportData = filteredRows.map((r, i) => ({
      'م': i + 1,
      'طريقة التحضير': r.employee.isZkLinked === false ? 'غير مربوط (يدوي / معتمد)' : 'جهاز البصمة',
      'رقم البصمة': r.employee.isZkLinked === false ? 'بدون بصمة' : (r.employee.badgeNumber || '-'),
      'اسم الموظف': r.employee.name,
      'نظام الراتب': r.employee.salaryType === 'daily' ? 'يومية' : 'راتب شهري',
      'القسم': r.employee.deptName || '-',
      'المسمى الوظيفي': r.employee.jobTitle || '-',
      'الوردية': r.shift.name,
      'أول بصمة (حضور)': r.firstIn || '-',
      'آخر بصمة (انصراف)': r.lastOut || '-',
      'التأخير (دقيقة)': r.lateMinutes || 0,
      'ساعات العمل': r.workedHours || 0,
      'ساعات الإضافي': r.overtimeHours || 0,
      'الحالة':
        r.status === 'present' ? 'حاضر' :
        r.status === 'late' ? 'متأخر' :
        r.status === 'single_punch' ? 'بصمة مفردة' :
        r.status === 'leave' ? 'إجازة' :
        r.status === 'weekend' ? 'عطلة' : 'غائب'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `حضور_${selectedDate}`);
    XLSX.writeFile(wb, `كشف_حضور_${selectedDate}.xlsx`);
  };

  // Quick Toggle Attendance / Absence
  const handleQuickToggleAttendance = async (emp: HREmployee, currentStatus: string) => {
    try {
      const empShifts = getEmployeeShifts(emp);
      const targetShifts = empShifts.length > 0 ? empShifts : [shifts[0] || { id: 'default', name: 'الوردية الافتراضية', startTime: '08:00', endTime: '16:00', workHours: 8 } as any];

      if (currentStatus === 'absent') {
        // Mark as Present: create IN and OUT logs for all assigned shifts
        const newPunchLogs: HRAttendanceLog[] = [];
        targetShifts.forEach((s, idx) => {
          const inTime = `${selectedDate} ${s.startTime || '08:00'}:00`;
          const outTime = `${selectedDate} ${s.endTime || '16:00'}:00`;
          newPunchLogs.push({
            id: `MANUAL_IN_${emp.id}_${Date.now()}_${idx}`,
            userId: emp.id,
            badgeNumber: emp.badgeNumber || emp.id,
            checkTime: inTime,
            checkType: 'I',
            source: 'manual',
            notes: `تحضير يدوي معتمد (${s.name || 'الوردية'})`
          });
          newPunchLogs.push({
            id: `MANUAL_OUT_${emp.id}_${Date.now() + 1}_${idx}`,
            userId: emp.id,
            badgeNumber: emp.badgeNumber || emp.id,
            checkTime: outTime,
            checkType: 'O',
            source: 'manual',
            notes: `تحضير يدوي معتمد (${s.name || 'الوردية'})`
          });
        });

        // Remove any explicit ABSENT log or manual punches for this employee on this date
        const cleanLogs = attendanceLogs.filter(l => {
          const isUserMatch = isLogMatchingEmployee(l, emp);
          return !(isUserMatch && l.checkTime.startsWith(selectedDate) && (l.checkType === 'ABSENT' || l.source === 'manual' || (l.notes && l.notes.includes('يدو'))));
        });

        await setAttendanceLogs([...newPunchLogs, ...cleanLogs]);
      } else {
        // Mark as Absent: create an explicit ABSENT log
        const absentLog: HRAttendanceLog = {
          id: `MANUAL_ABSENT_${emp.id}_${Date.now()}`,
          userId: emp.id,
          badgeNumber: emp.badgeNumber || emp.id,
          checkTime: `${selectedDate} 12:00:00`,
          checkType: 'ABSENT',
          source: 'manual',
          notes: 'غياب يدوي معتمد'
        };

        // Remove any existing manual punches or prior ABSENT logs for this employee on this date
        const cleanLogs = attendanceLogs.filter(l => {
          const isUserMatch = isLogMatchingEmployee(l, emp);
          return !(isUserMatch && l.checkTime.startsWith(selectedDate) && (l.checkType === 'ABSENT' || l.source === 'manual' || (l.notes && l.notes.includes('يدو'))));
        });

        await setAttendanceLogs([absentLog, ...cleanLogs]);
      }
    } catch (err: any) {
      console.error('Error in handleQuickToggleAttendance:', err);
      alert('حدث خطأ أثناء تعديل حالة الحضور: ' + (err?.message || err));
    }
  };

  // Reset manual logs for a day
  const handleResetManualDay = async (emp: HREmployee) => {
    try {
      const cleanLogs = attendanceLogs.filter(l => {
        const isUserMatch = isLogMatchingEmployee(l, emp);
        // Remove explicit ABSENT or manual punches to revert to normal state
        return !(isUserMatch && l.checkTime.startsWith(selectedDate) && (l.checkType === 'ABSENT' || l.source === 'manual' || (l.notes && l.notes.includes('يدو'))));
      });
      await setAttendanceLogs(cleanLogs);
    } catch (err: any) {
      console.error('Error in handleResetManualDay:', err);
      alert('حدث خطأ أثناء إعادة الضبط: ' + (err?.message || err));
    }
  };

  // Add manual punch
  const handleAddManualPunch = async () => {
    if (!manualEmpId) return alert('الرجاء اختيار الموظف');
    if (!manualTime) return alert('الرجاء إدخال وقت البصمة');

    const emp = employees.find(e => e.id === manualEmpId);
    const fullTimeStr = `${selectedDate} ${manualTime}:00`;
    const newLogId = `MANUAL_${Date.now()}`;

    const newLog: any = {
      id: newLogId,
      userId: manualEmpId,
      badgeNumber: emp?.badgeNumber || manualEmpId,
      checkTime: fullTimeStr,
      checkType: manualType,
      source: 'manual',
      notes: manualNotes || 'إضافة يدوية'
    };

    await setAttendanceLogs([newLog, ...attendanceLogs]);
    setShowManualPunchModal(false);
    setManualNotes('');
    alert('تمت إضافة البصمة اليدوية بنجاح.');
  };

  // ── Selected Employee Detailed Punch Slots & Analysis ───────────────────────
  const viewingEmp = useMemo(() => {
    if (!viewingEmpId) return null;
    return employees.find(e => e.id === viewingEmpId) || null;
  }, [viewingEmpId, employees]);

  const viewingRow = useMemo(() => {
    if (!viewingEmp) return null;
    return analyzeDayAttendance(selectedDate, viewingEmp);
  }, [viewingEmp, selectedDate, attendanceLogs, analyzeDayAttendance]);

  const viewingEmpLogs = useMemo(() => {
    if (!viewingEmp) return [];
    return attendanceLogs
      .filter(l => {
        const isUserMatch = isLogMatchingEmployee(l, viewingEmp);
        return isUserMatch && l.checkTime.startsWith(selectedDate);
      })
      .sort((a, b) => a.checkTime.localeCompare(b.checkTime));
  }, [viewingEmp, attendanceLogs, selectedDate]);

  // List of employees in current view (respecting search, department, and status filters)
  const currentNavEmployees = useMemo(() => {
    if (filteredRows && filteredRows.length > 0) {
      return filteredRows.map(r => r.employee);
    }
    return dailyAnalysis.map(r => r.employee);
  }, [filteredRows, dailyAnalysis]);

  const currentEmpNavIndex = useMemo(() => {
    if (!viewingEmpId) return -1;
    return currentNavEmployees.findIndex(e => e.id === viewingEmpId);
  }, [viewingEmpId, currentNavEmployees]);

  const handlePrevEmployee = () => {
    if (currentNavEmployees.length <= 1) return;
    const nextIdx = currentEmpNavIndex <= 0 ? currentNavEmployees.length - 1 : currentEmpNavIndex - 1;
    setViewingEmpId(currentNavEmployees[nextIdx].id);
    setInlineAddOpen(false);
  };

  const handleNextEmployee = () => {
    if (currentNavEmployees.length <= 1) return;
    const nextIdx = currentEmpNavIndex >= currentNavEmployees.length - 1 ? 0 : currentEmpNavIndex + 1;
    setViewingEmpId(currentNavEmployees[nextIdx].id);
    setInlineAddOpen(false);
  };

  // Keyboard shortcut navigation (Right Arrow = Prev / Left Arrow = Next / Escape = Close)
  useEffect(() => {
    if (!viewingEmpId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handlePrevEmployee();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNextEmployee();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setViewingEmpId(null);
        setInlineAddOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingEmpId, currentEmpNavIndex, currentNavEmployees]);

  // Helper to parse "HH:mm" to minutes
  const parseTimeMins = (t?: string | null) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  interface ViewingSlot {
    id: string;
    key: string;
    periodName: string;
    periodIndex: number;
    type: 'I' | 'O';
    label: string;
    scheduledTime: string;
    matchedLog?: HRAttendanceLog | null;
    recordedTime?: string | null;
    isManual?: boolean;
    isAutoApproved?: boolean;
  }

  const viewingSlots = useMemo((): ViewingSlot[] => {
    if (!viewingEmp || !viewingRow) return [];
    const empShifts = getEmployeeShifts(viewingEmp);
    const validLogs = viewingEmpLogs.filter(l => l.checkType !== 'ABSENT');

    // Build period list
    let periods: Array<{
      periodIndex: number;
      periodName: string;
      startTime: string;
      endTime: string;
      workHours: number;
    }> = [];

    if (empShifts.length > 1) {
      periods = empShifts.map((s, idx) => ({
        periodIndex: idx + 1,
        periodName: s.name,
        startTime: s.startTime || '08:00',
        endTime: s.endTime || '16:00',
        workHours: Number(s.workHours) || 4
      }));
    } else {
      const s = empShifts[0] || shifts[0] || { startTime: '08:00', endTime: '16:00', name: 'الوردية العامة' };
      if (s.isSplitShift && s.splitBreakStart && s.splitBreakEnd) {
        periods = [
          {
            periodIndex: 1,
            periodName: `${s.name} (الفترة الصباحية)`,
            startTime: s.startTime,
            endTime: s.splitBreakStart,
            workHours: Math.max(0, (parseTimeMins(s.splitBreakStart) - parseTimeMins(s.startTime)) / 60)
          },
          {
            periodIndex: 2,
            periodName: `${s.name} (الفترة المسائية)`,
            startTime: s.splitBreakEnd,
            endTime: s.endTime,
            workHours: Math.max(0, (parseTimeMins(s.endTime) - parseTimeMins(s.splitBreakEnd)) / 60)
          }
        ];
      } else {
        periods = [
          {
            periodIndex: 1,
            periodName: s.name,
            startTime: s.startTime || '08:00',
            endTime: s.endTime || '16:00',
            workHours: Number(s.workHours) || 8
          }
        ];
      }
    }

    const slots: ViewingSlot[] = [];

    if (periods.length === 1) {
      const p = periods[0];
      const pStartMins = parseTimeMins(p.startTime);
      const pEndMins = parseTimeMins(p.endTime);
      const midMins = Math.round((pStartMins + pEndMins) / 2);

      let inLog: HRAttendanceLog | null = null;
      let outLog: HRAttendanceLog | null = null;

      if (validLogs.length === 1) {
        const logMins = parseTimeMins(validLogs[0].checkTime.slice(11, 16));
        if (logMins <= midMins) {
          inLog = validLogs[0];
        } else {
          outLog = validLogs[0];
        }
      } else if (validLogs.length >= 2) {
        inLog = validLogs[0];
        outLog = validLogs[validLogs.length - 1];
      }

      const isAutoNonZk = (viewingEmp.isZkLinked === false || viewingEmp.attendanceMode === 'overtime_only') && validLogs.length === 0 && viewingRow.status === 'present';

      slots.push({
        id: `slot_p1_in`,
        key: 'p1_in',
        periodName: p.periodName,
        periodIndex: 1,
        type: 'I',
        label: 'دخول (حضور)',
        scheduledTime: p.startTime,
        matchedLog: inLog,
        recordedTime: inLog ? inLog.checkTime.slice(11, 16) : (isAutoNonZk ? p.startTime : null),
        isManual: inLog ? (inLog.source === 'manual' || Boolean(inLog.notes && inLog.notes.includes('يدو'))) : false,
        isAutoApproved: !inLog && isAutoNonZk
      });

      slots.push({
        id: `slot_p1_out`,
        key: 'p1_out',
        periodName: p.periodName,
        periodIndex: 1,
        type: 'O',
        label: 'خروج (انصراف)',
        scheduledTime: p.endTime,
        matchedLog: outLog,
        recordedTime: outLog ? outLog.checkTime.slice(11, 16) : (isAutoNonZk ? p.endTime : null),
        isManual: outLog ? (outLog.source === 'manual' || Boolean(outLog.notes && outLog.notes.includes('يدو'))) : false,
        isAutoApproved: !outLog && isAutoNonZk
      });
    } else {
      const p1 = periods[0];
      const p2 = periods[1];
      const splitMidpoint = Math.round((parseTimeMins(p1.endTime) + parseTimeMins(p2.startTime)) / 2);

      const mLogs = validLogs.filter(l => parseTimeMins(l.checkTime.slice(11, 16)) <= splitMidpoint);
      const eLogs = validLogs.filter(l => parseTimeMins(l.checkTime.slice(11, 16)) > splitMidpoint);

      let p1In: HRAttendanceLog | null = null;
      let p1Out: HRAttendanceLog | null = null;
      let p2In: HRAttendanceLog | null = null;
      let p2Out: HRAttendanceLog | null = null;

      if (validLogs.length === 1) {
        if (mLogs.length === 1) {
          p1In = mLogs[0];
        } else {
          p2In = eLogs[0];
        }
      } else if (mLogs.length === 1 && eLogs.length === 1) {
        p1In = mLogs[0];
        p2Out = eLogs[0];
      } else {
        if (mLogs.length >= 1) {
          p1In = mLogs[0];
          if (mLogs.length >= 2) p1Out = mLogs[mLogs.length - 1];
        }
        if (eLogs.length >= 1) {
          p2In = eLogs[0];
          if (eLogs.length >= 2) p2Out = eLogs[eLogs.length - 1];
        }
      }

      const isAutoNonZk = (viewingEmp.isZkLinked === false || viewingEmp.attendanceMode === 'overtime_only') && validLogs.length === 0 && viewingRow.status === 'present';

      slots.push({
        id: `slot_p1_in`,
        key: 'p1_in',
        periodName: p1.periodName,
        periodIndex: 1,
        type: 'I',
        label: `دخول - ${p1.periodName} (حضور)`,
        scheduledTime: p1.startTime,
        matchedLog: p1In,
        recordedTime: p1In ? p1In.checkTime.slice(11, 16) : (isAutoNonZk ? p1.startTime : null),
        isManual: p1In ? (p1In.source === 'manual' || Boolean(p1In.notes && p1In.notes.includes('يدو'))) : false,
        isAutoApproved: !p1In && isAutoNonZk
      });

      slots.push({
        id: `slot_p1_out`,
        key: 'p1_out',
        periodName: p1.periodName,
        periodIndex: 1,
        type: 'O',
        label: `خروج - ${p1.periodName} (انصراف)`,
        scheduledTime: p1.endTime,
        matchedLog: p1Out,
        recordedTime: p1Out ? p1Out.checkTime.slice(11, 16) : (isAutoNonZk ? p1.endTime : null),
        isManual: p1Out ? (p1Out.source === 'manual' || Boolean(p1Out.notes && p1Out.notes.includes('يدو'))) : false,
        isAutoApproved: !p1Out && isAutoNonZk
      });

      slots.push({
        id: `slot_p2_in`,
        key: 'p2_in',
        periodName: p2.periodName,
        periodIndex: 2,
        type: 'I',
        label: `دخول - ${p2.periodName} (حضور)`,
        scheduledTime: p2.startTime,
        matchedLog: p2In,
        recordedTime: p2In ? p2In.checkTime.slice(11, 16) : (isAutoNonZk ? p2.startTime : null),
        isManual: p2In ? (p2In.source === 'manual' || Boolean(p2In.notes && p2In.notes.includes('يدو'))) : false,
        isAutoApproved: !p2In && isAutoNonZk
      });

      slots.push({
        id: `slot_p2_out`,
        key: 'p2_out',
        periodName: p2.periodName,
        periodIndex: 2,
        type: 'O',
        label: `خروج - ${p2.periodName} (انصراف)`,
        scheduledTime: p2.endTime,
        matchedLog: p2Out,
        recordedTime: p2Out ? p2Out.checkTime.slice(11, 16) : (isAutoNonZk ? p2.endTime : null),
        isManual: p2Out ? (p2Out.source === 'manual' || Boolean(p2Out.notes && p2Out.notes.includes('يدو'))) : false,
        isAutoApproved: !p2Out && isAutoNonZk
      });
    }

    return slots;
  }, [viewingEmp, viewingRow, viewingEmpLogs, shifts, getEmployeeShifts]);

  // Handlers for Slot Quick Fill and Undo
  const handleQuickFillSlot = async (slot: ViewingSlot, timeStr?: string) => {
    if (!viewingEmp) return;
    const punchTime = timeStr || slotInputTimes[slot.id] || slot.scheduledTime;
    const fullTimeStr = `${selectedDate} ${punchTime}:00`;
    const newLogId = `MANUAL_${viewingEmp.id}_${slot.id}_${Date.now()}`;

    const newLog: HRAttendanceLog = {
      id: newLogId,
      userId: viewingEmp.id,
      badgeNumber: viewingEmp.badgeNumber || viewingEmp.id,
      checkTime: fullTimeStr,
      checkType: slot.type,
      source: 'manual',
      notes: `تعبئة يدوية: ${slot.label}`
    };

    const cleanLogs = attendanceLogs.filter(l => {
      const isUserMatch = isLogMatchingEmployee(l, viewingEmp);
      if (isUserMatch && l.checkTime.startsWith(selectedDate) && l.checkType === 'ABSENT') {
        return false;
      }
      return slot.matchedLog ? l.id !== slot.matchedLog.id : true;
    });

    await setAttendanceLogs([newLog, ...cleanLogs]);
  };

  const handleUndoSlotPunch = async (logId: string) => {
    const updated = attendanceLogs.filter(l => l.id !== logId);
    await setAttendanceLogs(updated);
  };

  const handleFillAllMissingSlots = async () => {
    if (!viewingEmp) return;
    const missingSlots = viewingSlots.filter(s => !s.matchedLog && !s.recordedTime);
    if (missingSlots.length === 0) return;

    const newLogs: HRAttendanceLog[] = missingSlots.map((slot, idx) => {
      const punchTime = slotInputTimes[slot.id] || slot.scheduledTime;
      return {
        id: `MANUAL_${viewingEmp.id}_${slot.id}_${Date.now() + idx}`,
        userId: viewingEmp.id,
        badgeNumber: viewingEmp.badgeNumber || viewingEmp.id,
        checkTime: `${selectedDate} ${punchTime}:00`,
        checkType: slot.type,
        source: 'manual',
        notes: `تعبئة يدوية سريعة: ${slot.label}`
      };
    });

    const cleanLogs = attendanceLogs.filter(l => {
      const isUserMatch = isLogMatchingEmployee(l, viewingEmp);
      return !(isUserMatch && l.checkTime.startsWith(selectedDate) && l.checkType === 'ABSENT');
    });

    await setAttendanceLogs([...newLogs, ...cleanLogs]);
  };

  const handleUndoAllManualForDay = async () => {
    if (!viewingEmp) return;
    const updated = attendanceLogs.filter(l => {
      const isMatch = isLogMatchingEmployee(l, viewingEmp) && l.checkTime.startsWith(selectedDate);
      if (isMatch && (l.source === 'manual' || l.checkType === 'ABSENT' || (l.notes && l.notes.includes('يدو')))) {
        return false;
      }
      return true;
    });
    await setAttendanceLogs(updated);
  };

  const handleCustomAddPunch = async () => {
    if (!viewingEmp) return;
    if (!inlineAddTime) return alert('الرجاء إدخال وقت البصمة');

    const fullTimeStr = `${selectedDate} ${inlineAddTime}:00`;
    const newLogId = `MANUAL_CUSTOM_${Date.now()}`;

    const newLog: HRAttendanceLog = {
      id: newLogId,
      userId: viewingEmp.id,
      badgeNumber: viewingEmp.badgeNumber || viewingEmp.id,
      checkTime: fullTimeStr,
      checkType: inlineAddType,
      source: 'manual',
      notes: inlineAddNotes || 'إضافة يدوية مخصصة'
    };

    const cleanLogs = attendanceLogs.filter(l => {
      const isUserMatch = isLogMatchingEmployee(l, viewingEmp);
      return !(isUserMatch && l.checkTime.startsWith(selectedDate) && l.checkType === 'ABSENT');
    });

    await setAttendanceLogs([newLog, ...cleanLogs]);
    setInlineAddOpen(false);
    setInlineAddNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-blue-600" />
            سجل الحضور والانصراف اليومي
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            مزامنة مباشرة مع جهاز البصمة ZKTeco وتحليل أوقات الحضور والانصراف والتأخير
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto">
          {/* Date Selector Navigation */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={handleNextDay}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors"
              title="اليوم التالي"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-800 px-2 py-1 outline-none text-center"
            />
            <button
              onClick={handlePrevDay}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors"
              title="اليوم السابق"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleSetToday}
              className="text-xs px-2.5 py-1 bg-white text-blue-600 font-bold rounded-lg shadow-xs hover:bg-blue-50 transition-colors mr-1"
            >
              اليوم
            </button>
          </div>

          {/* Sync Button */}
          {hasPermission('hr', 'sync') && (
            <button
              onClick={() => triggerSync({ logsOnly: true })}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm disabled:opacity-50"
              title="سحب حركات البصمة فقط من جهاز البصمة دون المساس ببيانات الموظفين"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'جاري المزامنة...' : 'سحب البصمات الآن'}</span>
            </button>
          )}

          {/* Export to Excel */}
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors"
            title="تصدير الكشف إلى Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Excel</span>
          </button>

          {/* Manual punch button */}
          {hasPermission('hr', 'create') && (
            <button
              onClick={() => setShowManualPunchModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors shadow-xs"
              title="إضافة بصمة أو حركة حضور يدوية لموظف"
            >
              <Plus className="w-4 h-4" />
              <span>بصمة يدوية</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStats && (
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl px-4 py-2 flex items-center justify-between text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>قاعدة بيانات ZKTeco متصلة: <code className="bg-blue-100/80 px-1 py-0.5 rounded font-mono">{syncStats.path || 'K:\\shams\\55\\ZKTeco\\att2000.mdb'}</code></span>
          </div>
          <div>
            آخر سحب: <span className="font-bold">{syncStats.lastSyncAt ? new Date(syncStats.lastSyncAt).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' }) : 'غير محدد'}</span>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">إجمالي الموظفين</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{stats.total}</div>
        </div>

        <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            الحاضرون
          </div>
          <div className="text-2xl font-black text-emerald-800 mt-1">{stats.present}</div>
        </div>

        <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            المتأخرون
          </div>
          <div className="text-2xl font-black text-amber-800 mt-1">{stats.late}</div>
        </div>

        <div className="bg-red-50/80 border border-red-200 p-3.5 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-red-700 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            الغائبون
          </div>
          <div className="text-2xl font-black text-red-800 mt-1">{stats.absent}</div>
        </div>

        <div className="bg-purple-50/80 border border-purple-200 p-3.5 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-purple-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            في إجازة
          </div>
          <div className="text-2xl font-black text-purple-800 mt-1">{stats.leave}</div>
        </div>

        <div className="bg-blue-50/80 border border-blue-200 p-3.5 rounded-xl shadow-xs">
          <div className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            بصمة مفردة
          </div>
          <div className="text-2xl font-black text-blue-800 mt-1">{stats.singlePunch}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث بالاسم أو رقم البصمة..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Department Filter */}
        <div className="w-full md:w-56">
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:bg-white"
          >
            <option value="all">كل الأقسام ({departments.length})</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-52">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:bg-white"
          >
            <option value="all">كل الحالات ({dailyAnalysis.length})</option>
            <option value="present">الحاضرون فقط ({stats.present})</option>
            <option value="late">المتأخرون فقط ({stats.late})</option>
            <option value="absent">الغائبون فقط ({stats.absent})</option>
            <option value="single_punch">بصمة مفردة ({stats.singlePunch})</option>
            <option value="leave">في إجازة ({stats.leave})</option>
          </select>
        </div>

        {/* Attendance Mode / ZK Filter */}
        <div className="w-full md:w-52">
          <select
            value={selectedZkFilter}
            onChange={e => setSelectedZkFilter(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:bg-white"
          >
            <option value="all">كل طرق التحضير</option>
            <option value="zk">مربوط بجهاز البصمة فقط</option>
            <option value="manual">غير مربوط (دوام معتمد / يدوي)</option>
          </select>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3.5 w-12 text-center">#</th>
                <th className="p-3.5">الموظف</th>
                <th className="p-3.5">القسم والوظيفة</th>
                <th className="p-3.5">الوردية المعتمدة</th>
                <th className="p-3.5 text-center">أول بصمة (حضور)</th>
                <th className="p-3.5 text-center">آخر بصمة (انصراف)</th>
                <th className="p-3.5 text-center">ساعات العمل</th>
                <th className="p-3.5 text-center">التأخير والخروج</th>
                <th className="p-3.5 text-center">الإضافي</th>
                <th className="p-3.5 text-center">الحالة</th>
                <th className="p-3.5 w-24 text-center">حركات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row, idx) => {
                const emp = row.employee;
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        {emp.isZkLinked === false ? (
                          <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0" title="موظف غير مربوط بجهاز البصمة">
                            <UserCheck className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center font-mono shrink-0">
                            {emp.badgeNumber || emp.id}
                          </span>
                        )}
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{emp.name}</span>
                            {emp.isZkLinked === false && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-purple-50 text-purple-700 border border-purple-200 rounded shrink-0">
                                بدون بصمة
                              </span>
                            )}
                            {emp.isZkLinked !== false && emp.attendanceMode === 'overtime_only' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 rounded shrink-0" title="دوام رسمي معتمد - البصمة لاحتساب الإضافي فقط">
                                إضافي فقط
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            {emp.phone && <span className="font-mono">{emp.phone}</span>}
                            {emp.phone && <span className="text-slate-300">•</span>}
                            <span className="font-medium text-slate-500">{emp.salaryType === 'daily' ? 'يومية' : 'راتب شهري'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-xs font-medium text-slate-800">{emp.deptName || 'عام'}</div>
                      <div className="text-[11px] text-slate-400">{emp.jobTitle || 'موظف'}</div>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: row.shift.color || '#2563eb' }} />
                        {row.shift.name} ({row.shift.startTime}-{row.shift.endTime})
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-slate-800">
                      {row.morningIn || row.firstIn ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs font-mono">
                            {row.morningIn || row.firstIn}
                          </span>
                          {row.morningOut && (
                            <span className="text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded text-[10px] font-mono" title="خروج الفترة الصباحية">
                              خ ص: {row.morningOut}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">--:--</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-slate-800">
                      {row.eveningOut || row.lastOut ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs font-mono">
                            {row.eveningOut || row.lastOut}
                          </span>
                          {row.eveningIn && (
                            <span className="text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded text-[10px] font-mono" title="دخول الفترة المسائية">
                              د م: {row.eveningIn}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">--:--</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono font-bold">
                      {row.workedHours > 0 ? `${row.workedHours} س` : '-'}
                    </td>
                    <td className="p-3 text-center">
                      {((row.lateMinutes || 0) > 0 || (row.earlyMinutes || 0) > 0) ? (
                        <div className="flex flex-col items-center gap-0.5">
                          {(row.missingPunchPenaltyMinutes || 0) > 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 font-mono" title={`خصم عدم وجود البصمة (${(row.missingPunchPenaltyMinutes || 0) / 60} ساعة)`}>
                              خصم بصمة: {(row.missingPunchPenaltyMinutes || 0) / 60}س
                              {(row.lateMinutes - (row.missingPunchPenaltyMinutes || 0)) > 0 && ` (+${row.lateMinutes - (row.missingPunchPenaltyMinutes || 0)}د)`}
                            </span>
                          ) : (
                            (row.lateMinutes || 0) > 0 && (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 font-mono" title="دقائق التأخير الصباحي">
                                تأخير: {row.lateMinutes} د
                              </span>
                            )
                          )}
                          {(row.earlyMinutes || 0) > 0 && (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800 font-mono" title="دقائق الخروج المبكر">
                              خروج: {row.earlyMinutes} د
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {row.overtimeHours > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 font-mono">
                          +{row.overtimeHours} س
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {row.status === 'present' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          حاضر
                        </span>
                      )}
                      {row.status === 'late' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                          متأخر
                        </span>
                      )}
                      {row.status === 'single_punch' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300" title="بصمة ناقصة - يطبق خصم تأخير حتى تتم التعبئة السريعة">
                          بصمة ناقصة {(row.missingPunchPenaltyMinutes || 0) > 0 && `(-${(row.missingPunchPenaltyMinutes || 0) / 60}س)`}
                        </span>
                      )}
                      {row.status === 'leave' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                          إجازة
                        </span>
                      )}
                      {row.status === 'weekend' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                          عطلة
                        </span>
                      )}
                      {row.status === 'absent' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                          غائب
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {hasPermission('hr', 'create') && (
                          <>
                            {row.status === 'absent' ? (
                              <button
                                onClick={() => handleQuickToggleAttendance(emp, 'absent')}
                                className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors border border-emerald-200"
                                title="تسجيل حضور اليوم (يدوي)"
                              >
                                <UserCheck className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleQuickToggleAttendance(emp, 'present')}
                                className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors border border-red-200"
                                title="تسجيل غياب اليوم (يدوي)"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            )}
                            {manualEmployeesOnSelectedDateSet.has(String(emp.id)) && (
                              <button
                                onClick={() => handleResetManualDay(emp)}
                                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                                title="إعادة ضبط إلى الوضع الافتراضي لليوم (إلغاء التعديل اليدوي)"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => setViewingEmpId(emp.id)}
                          className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded-lg transition-colors"
                          title="عرض سجل البصمات وتعبئة الأوقات المطلوبة"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    لا توجد سجلات مطابقة للبحث أو التاريخ المختار.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Comprehensive Punch Log & Schedule Slots Modal ─────────────────── */}
      {viewingEmp && viewingRow && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-start gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
                  {viewingEmp.isZkLinked === false ? (
                    <UserCheck className="w-5 h-5 text-purple-300" />
                  ) : (
                    <Fingerprint className="w-5 h-5 text-blue-300" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Employee Switcher Navigation: Right Arrow + Name in Middle + Left Arrow */}
                    <div className="flex items-center bg-white/10 hover:bg-white/15 p-1 rounded-2xl border border-white/10 backdrop-blur-xs transition-colors shadow-xs">
                      {/* Right Arrow (السهم الأيمن) */}
                      <button
                        onClick={handlePrevEmployee}
                        disabled={currentNavEmployees.length <= 1}
                        className="p-1 hover:bg-white/20 active:scale-95 text-slate-200 hover:text-white rounded-xl transition-all disabled:opacity-30 disabled:pointer-events-none"
                        title="الموظف السابق (السهم الأيمن)"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>

                      {/* Employee Name in the middle (يتوسطهم اسم الموظف) */}
                      <div className="px-2.5 flex items-center gap-2">
                        <h3 className="font-black text-lg text-white tracking-wide select-none">
                          {viewingEmp.name}
                        </h3>
                        {currentNavEmployees.length > 1 && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-white/20 text-slate-200" title="ترتيب الموظف في القائمة">
                            {currentEmpNavIndex + 1}/{currentNavEmployees.length}
                          </span>
                        )}
                      </div>

                      {/* Left Arrow (السهم الأيسر) */}
                      <button
                        onClick={handleNextEmployee}
                        disabled={currentNavEmployees.length <= 1}
                        className="p-1 hover:bg-white/20 active:scale-95 text-slate-200 hover:text-white rounded-xl transition-all disabled:opacity-30 disabled:pointer-events-none"
                        title="الموظف التالي (السهم الأيسر)"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Biometric Badge */}
                    {viewingEmp.isZkLinked === false ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30">
                        غير مربوط بالبصمة
                      </span>
                    ) : viewingEmp.attendanceMode === 'overtime_only' ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 border border-amber-400/30">
                        بصمة #{viewingEmp.badgeNumber || viewingEmp.id} (إضافي فقط)
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                        #{viewingEmp.badgeNumber || viewingEmp.id}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                    <span>{viewingEmp.deptName || 'القسم العام'}</span>
                    <span>•</span>
                    <span>{viewingEmp.jobTitle || 'موظف'}</span>
                    <span>•</span>
                    <span className="font-bold text-amber-300 font-mono">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ar-LY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => { setViewingEmpId(null); setInlineAddOpen(false); }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                title="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              
              {/* Top KPI Summary Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-slate-500 font-medium text-[11px]">الوردية المقررة</div>
                  <div className="font-bold text-slate-900 mt-0.5 truncate">{viewingRow.shift.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{viewingRow.shift.startTime} - {viewingRow.shift.endTime}</div>
                </div>
                <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                  <div className="text-emerald-700 font-medium text-[11px]">ساعات العمل</div>
                  <div className="font-black text-emerald-800 text-sm mt-0.5 font-mono">
                    {viewingRow.workedHours} س <span className="text-emerald-600/70 text-[11px]">/ {viewingRow.scheduledHours} س</span>
                  </div>
                </div>
                <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl">
                  <div className="text-amber-700 font-medium text-[11px]">التأخير والخروج</div>
                  <div className="font-black text-amber-800 text-sm mt-0.5 font-mono">
                    {(viewingRow.lateMinutes > 0 || viewingRow.earlyMinutes > 0) ? (
                      <span className="text-xs">
                        {viewingRow.lateMinutes > 0 ? `تأخير: ${viewingRow.lateMinutes}د` : ''}
                        {viewingRow.lateMinutes > 0 && viewingRow.earlyMinutes > 0 ? ' • ' : ''}
                        {viewingRow.earlyMinutes > 0 ? `خروج: ${viewingRow.earlyMinutes}د` : ''}
                      </span>
                    ) : 'لا يوجد'}
                  </div>
                </div>
                <div className="p-2.5 bg-purple-50/70 border border-purple-200 rounded-xl">
                  <div className="text-purple-700 font-medium text-[11px]">العمل الإضافي</div>
                  <div className="font-black text-purple-800 text-sm mt-0.5 font-mono">
                    {viewingRow.overtimeHours > 0 ? `+${viewingRow.overtimeHours} ساعة` : 'لا يوجد'}
                  </div>
                </div>
                <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl">
                  <div className="text-blue-700 font-medium text-[11px]">حالة اليوم</div>
                  <div className="font-bold text-sm mt-0.5">
                    {viewingRow.status === 'present' && <span className="text-emerald-700">حاضر</span>}
                    {viewingRow.status === 'late' && <span className="text-amber-700">متأخر</span>}
                    {viewingRow.status === 'single_punch' && (
                      <span className="text-amber-800">
                        بصمة ناقصة {(viewingRow.missingPunchPenaltyMinutes || 0) > 0 && `(-${(viewingRow.missingPunchPenaltyMinutes || 0) / 60}س)`}
                      </span>
                    )}
                    {viewingRow.status === 'leave' && <span className="text-purple-700">في إجازة</span>}
                    {viewingRow.status === 'weekend' && <span className="text-slate-600">عطلة</span>}
                    {viewingRow.status === 'absent' && <span className="text-red-700">غائب</span>}
                  </div>
                </div>
              </div>

              {/* Missing Punch Penalty Warning Banner */}
              {(viewingRow.missingPunchPenaltyMinutes || 0) > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">
                        يوجد نقص في بصمات هذا اليوم (خصم تأخير {(viewingRow.missingPunchPenaltyMinutes || 0) / 60} ساعة)
                      </div>
                      <div className="text-[11px] text-amber-800/80 mt-0.5">
                        وفق قاعدة المنظومة، تم احتساب خصم تأخير بمقدار {(viewingRow.missingPunchPenaltyMinutes || 0) / 60} ساعة على الراتب. اضغط على زر <strong>"تعبئة سريعة"</strong> أمام البصمة الناقصة أدناه لإلغاء الخصم فوراً.
                      </div>
                    </div>
                  </div>
                  {viewingSlots.some(s => !s.matchedLog && !s.recordedTime) && (
                    <button
                      onClick={handleFillAllMissingSlots}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors text-xs flex items-center gap-1 shadow-xs shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>تعبئة وإلغاء الخصم</span>
                    </button>
                  )}
                </div>
              )}

              {/* Explicit Absence Warning Banner */}
              {viewingEmpLogs.some(l => l.checkType === 'ABSENT' || (l.notes && l.notes === 'غياب يدوي معتمد')) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-800 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                      <UserX className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-red-900">الموظف مسجل كـ "غائب" لهذا اليوم (غياب يدوي معتمد)</div>
                      <div className="text-[11px] text-red-600 mt-0.5">تم احتساب ساعات العمل 0 وخصم اليوم من مسير الرواتب. يمكنك تسجيل الحضور أو إلغاء الغياب في أي وقت.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleQuickToggleAttendance(viewingEmp, 'absent')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors text-xs flex items-center gap-1 shadow-xs"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>تسجيل حضور يدوي</span>
                    </button>
                    <button
                      onClick={() => handleResetManualDay(viewingEmp)}
                      className="px-2.5 py-1.5 bg-white hover:bg-red-100 text-red-700 border border-red-300 font-bold rounded-xl transition-colors text-xs flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>إلغاء الغياب</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── Required Punch Slots Section ──────────────────────────────── */}
              <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      حقول البصمات المطلوبة حسب جدول الموظف
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      تظهر هنا مواعيد الحضور والانصراف المقررة وفق الوردية، مع زر تعبئة سريع لأي بصمة غير مسجلة.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
                    {/* Manual Absence / Presence Quick Action in Modal */}
                    {hasPermission('hr', 'create') && (
                      <button
                        onClick={() => handleQuickToggleAttendance(viewingEmp, viewingRow.status)}
                        className={`px-2.5 py-1.5 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 ${
                          viewingRow.status === 'absent'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                        }`}
                        title={viewingRow.status === 'absent' ? 'تسجيل حضور الموظف اليوم' : 'تسجيل الموظف كغائب لليوم'}
                      >
                        {viewingRow.status === 'absent' ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>تسجيل حضور يدوي</span>
                          </>
                        ) : (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            <span>تسجيل غياب يدوي</span>
                          </>
                        )}
                      </button>
                    )}

                    {viewingSlots.some(s => !s.matchedLog && !s.recordedTime) && (
                      <button
                        onClick={handleFillAllMissingSlots}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5"
                        title="تعبئة كافة البصمات غير المسجلة لليوم"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>تعبئة كل الناقص ({viewingSlots.filter(s => !s.matchedLog && !s.recordedTime).length})</span>
                      </button>
                    )}
                    {attendanceLogs.some(l => {
                      const isMatch = isLogMatchingEmployee(l, viewingEmp) && l.checkTime.startsWith(selectedDate);
                      return isMatch && (l.source === 'manual' || l.checkType === 'ABSENT' || (l.notes && l.notes.includes('يدو')));
                    }) && (
                      <button
                        onClick={() => handleResetManualDay(viewingEmp)}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
                        title="إعادة ضبط إلى الوضع الافتراضي لليوم (إلغاء التعديل اليدوي)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إلغاء التعديل اليدوي</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Slot Cards List */}
                <div className="space-y-2.5">
                  {viewingSlots.map(slot => {
                    const isRecorded = Boolean(slot.recordedTime);
                    const isManual = slot.isManual;
                    const isAuto = slot.isAutoApproved;

                    return (
                      <div
                        key={slot.id}
                        className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isRecorded
                            ? isManual
                              ? 'bg-amber-50/70 border-amber-300/80 shadow-xs'
                              : isAuto
                                ? 'bg-purple-50/60 border-purple-200'
                                : 'bg-white border-slate-200 shadow-2xs'
                            : 'bg-white/80 border-dashed border-red-200'
                        }`}
                      >
                        {/* Right: Slot Info */}
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            slot.type === 'I'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {slot.type === 'I' ? (
                              <ArrowDownLeft className="w-4 h-4" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4" />
                            )}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                              <span>{slot.label}</span>
                              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                المقرر: {slot.scheduledTime}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {slot.periodName}
                            </div>
                          </div>
                        </div>

                        {/* Left: Punch Status & Controls */}
                        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                          {isRecorded ? (
                            <div className="flex items-center gap-2">
                              {/* Time Display */}
                              <span className="text-base font-black font-mono px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-900 shadow-2xs">
                                {slot.recordedTime}
                              </span>

                              {/* Source Badge */}
                              {isManual && (
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  مضافة يدوياً
                                </span>
                              )}
                              {!isManual && !isAuto && (
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                                  <Fingerprint className="w-3.5 h-3.5 text-blue-600" />
                                  بصمة جهاز ZK
                                </span>
                              )}
                              {isAuto && (
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                  معتمد تلقائياً
                                </span>
                              )}

                              {/* Undo Button if Manual */}
                              {isManual && slot.matchedLog && (
                                <button
                                  onClick={() => handleUndoSlotPunch(slot.matchedLog!.id)}
                                  className="p-1.5 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-lg border border-red-200 transition-colors flex items-center gap-1 text-xs font-bold shadow-2xs"
                                  title="التراجع عن هذه البصمة اليدوية وحذفها"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">تراجع</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            /* Missing Punch: Quick Fill Controls */
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                غير مسجلة
                              </span>

                              {/* Inline Time input with default scheduled time */}
                              <input
                                type="time"
                                value={slotInputTimes[slot.id] !== undefined ? slotInputTimes[slot.id] : slot.scheduledTime}
                                onChange={e => setSlotInputTimes(prev => ({ ...prev, [slot.id]: e.target.value }))}
                                className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none focus:border-blue-500 w-20 text-center shadow-2xs"
                                title="تعديل وقت البصمة قبل التعبئة إن رغبت"
                              />

                              {/* Quick Fill Button */}
                              <button
                                onClick={() => handleQuickFillSlot(slot, slotInputTimes[slot.id] || slot.scheduledTime)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all shadow-2xs flex items-center gap-1"
                                title="تعبئة هذه البصمة الآن بالوقت المحدد"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>تعبئة سريعة</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Raw Punches of the Day Section ──────────────────────────── */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-slate-600" />
                    <span>جميع الحركات المسجلة في هذا اليوم ({viewingEmpLogs.length})</span>
                  </div>
                  
                  <button
                    onClick={() => setInlineAddOpen(!inlineAddOpen)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة حركة إضافية بوقت مخصص</span>
                  </button>
                </div>

                {/* Inline custom punch addition */}
                {inlineAddOpen && (
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
                    <div className="text-xs font-bold text-blue-900">إضافة حركة بصمة إضافية</div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">الوقت</label>
                        <input
                          type="time"
                          value={inlineAddTime}
                          onChange={e => setInlineAddTime(e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">النوع</label>
                        <select
                          value={inlineAddType}
                          onChange={e => setInlineAddType(e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                        >
                          <option value="I">دخول (حضور)</option>
                          <option value="O">خروج (انصراف)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">ملاحظات</label>
                        <input
                          type="text"
                          placeholder="مثال: إذن خروج ميداني..."
                          value={inlineAddNotes}
                          onChange={e => setInlineAddNotes(e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                      <div className="flex items-end gap-1">
                        <button
                          onClick={handleCustomAddPunch}
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-2xs"
                        >
                          إضافة الحركة
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Logs list */}
                {viewingEmpLogs.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {viewingEmpLogs.map((l, idx) => {
                      const isMan = l.source === 'manual' || Boolean(l.notes && l.notes.includes('يدو'));
                      return (
                        <div
                          key={l.id || idx}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs hover:bg-slate-100/70 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center font-mono">
                              {idx + 1}
                            </span>
                            <span className="font-mono font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                              {l.checkTime.slice(11, 19) || l.checkTime.slice(11, 16)}
                            </span>
                            <span className="font-bold text-slate-700">
                              {l.checkType === 'O' ? 'خروج (انصراف)' : 'دخول (حضور)'}
                            </span>
                            {l.notes && (
                              <span className="text-[11px] text-slate-400">({l.notes})</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {isMan ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                يدوي
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                جهاز ZK
                              </span>
                            )}

                            {isMan && (
                              <button
                                onClick={() => handleUndoSlotPunch(l.id)}
                                className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition-colors"
                                title="حذف هذه البصمة اليدوية والتراجع"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                    لم تسجل أي حركة بصمة في هذا اليوم
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
              <div className="text-slate-500">
                إجمالي البصمات المقررة: <b className="font-mono text-slate-800">{viewingSlots.length}</b> • المسجلة: <b className="font-mono text-emerald-700">{viewingSlots.filter(s => !!s.recordedTime).length}</b>
              </div>
              <button
                onClick={() => { setViewingEmpId(null); setInlineAddOpen(false); }}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors shadow-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Punch Modal */}
      {showManualPunchModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                إضافة بصمة يدوية
              </h3>
              <button
                onClick={() => setShowManualPunchModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الموظف</label>
                <select
                  value={manualEmpId}
                  onChange={e => setManualEmpId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none"
                >
                  <option value="">-- اختر الموظف --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} {e.isZkLinked === false ? '(بدون بصمة - يدوي)' : `(بصمة: #${e.badgeNumber || e.id})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التاريخ</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الوقت (ساعة:دقيقة)</label>
                  <input
                    type="time"
                    value={manualTime}
                    onChange={e => setManualTime(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع الحركة</label>
                <div className="flex gap-3">
                  <label className="flex-1 flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                    <input
                      type="radio"
                      name="punchType"
                      checked={manualType === 'I'}
                      onChange={() => setManualType('I')}
                    />
                    <span className="text-xs font-bold text-slate-800">حضور (دخول)</span>
                  </label>
                  <label className="flex-1 flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                    <input
                      type="radio"
                      name="punchType"
                      checked={manualType === 'O'}
                      onChange={() => setManualType('O')}
                    />
                    <span className="text-xs font-bold text-slate-800">انصراف (خروج)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سبب التعديل / ملاحظات</label>
                <input
                  type="text"
                  placeholder="مثال: نسيان بصمة، إذن عمل ميداني..."
                  value={manualNotes}
                  onChange={e => setManualNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  onClick={() => setShowManualPunchModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleAddManualPunch}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-xs"
                >
                  حفظ البصمة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
