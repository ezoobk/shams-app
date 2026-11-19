import React, { useState, useMemo } from 'react';
import { useHR, isLogMatchingEmployee } from '../../context/HRContext';
import { useAuth } from '../../context/AuthContext';
import { usePrint } from '../../context/PrintContext';
import {
  Calendar, Printer, Download, Search, User,
  Clock, Sparkles, RotateCcw, UserCheck, UserX,
  Plus, Trash2, Pencil, Eye, AlertCircle, AlertTriangle, Fingerprint,
  ArrowDownLeft, ArrowUpRight, ChevronRight, ChevronLeft, X, Check
} from 'lucide-react';
import type { HREmployee, HRDayAttendanceAnalysis, HRAttendanceLog } from '../../types';
import * as XLSX from 'xlsx';

export const MonthlyReportView: React.FC = () => {
  const {
    employees,
    shifts,
    attendanceLogs,
    setAttendanceLogs,
    analyzeMonthAttendance,
    analyzeDayAttendance,
    getEmployeeShift,
    getEmployeeShifts
  } = useHR();
  const { hasPermission, currentUser } = useAuth();
  const { setPrintData } = usePrint();

  const currentYearMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);
  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'timecard'>('matrix');
  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');

  // Editing Day State for Individual Timecard Modal
  const [editingDayDate, setEditingDayDate] = useState<string | null>(null);
  const [slotInputTimes, setSlotInputTimes] = useState<{ [slotId: string]: string }>({});
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editTimeValue, setEditTimeValue] = useState<string>('');
  const [editingRawLogId, setEditingRawLogId] = useState<string | null>(null);
  const [editingRawLogTime, setEditingRawLogTime] = useState<string>('');
  const [inlineAddOpen, setInlineAddOpen] = useState(false);
  const [inlineAddTime, setInlineAddTime] = useState('08:00');
  const [inlineAddType, setInlineAddType] = useState<'I' | 'O'>('I');
  const [inlineAddNotes, setInlineAddNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [punchingCell, setPunchingCell] = useState<string | null>(null);

  // Selected employee for timecard
  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmpId) || employees[0];
  }, [employees, selectedEmpId]);

  // Monthly summary for all active employees (only computed when viewing the matrix tab)
  const allEmployeesMonthly = useMemo(() => {
    if (activeSubTab !== 'matrix') return [];
    return employees
      .filter(e => e.isActive !== false)
      .map(emp => {
        const stats = analyzeMonthAttendance(selectedMonth, emp);
        return {
          employee: emp,
          stats
        };
      });
  }, [employees, selectedMonth, analyzeMonthAttendance, attendanceLogs, activeSubTab]);

  // Filtered rows for general matrix
  const filteredMatrix = useMemo(() => {
    if (activeSubTab !== 'matrix') return [];
    return allEmployeesMonthly.filter(item => {
      if (!searchQuery) return true;
      return (
        item.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.employee.badgeNumber || '').includes(searchQuery) ||
        (item.employee.deptName && item.employee.deptName.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    });
  }, [allEmployeesMonthly, searchQuery, activeSubTab]);

  // Fast Set of dates that have manual modifications for the selected employee
  const manualModifiedDatesSet = useMemo(() => {
    if (!selectedEmployee) return new Set<string>();
    const set = new Set<string>();
    const len = attendanceLogs.length;

    for (let i = 0; i < len; i++) {
      const l = attendanceLogs[i];
      const isMatch = isLogMatchingEmployee(l, selectedEmployee);
      if (isMatch && (l.source === 'manual' || l.checkType === 'ABSENT' || (l.notes && l.notes.includes('يدو')))) {
        if (l.checkTime) {
          set.add(l.checkTime.slice(0, 10));
        }
      }
    }
    return set;
  }, [selectedEmployee, attendanceLogs]);

  // Timecard data for the selected employee
  const employeeTimecardData = useMemo(() => {
    if (!selectedEmployee) return null;
    return analyzeMonthAttendance(selectedMonth, selectedEmployee);
  }, [selectedEmployee, selectedMonth, analyzeMonthAttendance, attendanceLogs]);

  // Day analysis for the currently edited day in modal
  const editingDayAnalysis = useMemo(() => {
    if (!selectedEmployee || !editingDayDate) return null;
    return analyzeDayAttendance(editingDayDate, selectedEmployee);
  }, [selectedEmployee, editingDayDate, attendanceLogs, analyzeDayAttendance]);

  // Attendance logs for the currently edited day
  const editingDayLogs = useMemo(() => {
    if (!selectedEmployee || !editingDayDate) return [];
    return attendanceLogs
      .filter(l => {
        const isUserMatch = isLogMatchingEmployee(l, selectedEmployee);
        return isUserMatch && l.checkTime.startsWith(editingDayDate);
      })
      .sort((a, b) => a.checkTime.localeCompare(b.checkTime));
  }, [selectedEmployee, editingDayDate, attendanceLogs]);

  const parseTimeMins = (t: string) => {
    const [h, m] = (t || '00:00').split(':').map(Number);
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

  // Calculate schedule slots for the currently edited day
  const editingSlots = useMemo((): ViewingSlot[] => {
    if (!selectedEmployee || !editingDayAnalysis || !editingDayDate) return [];
    const empShifts = getEmployeeShifts(selectedEmployee);
    const validLogs = editingDayLogs.filter(l => l.checkType !== 'ABSENT');

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

      const isAutoNonZk = (selectedEmployee.isZkLinked === false || selectedEmployee.attendanceMode === 'overtime_only') && validLogs.length === 0 && editingDayAnalysis.status === 'present';

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

      const isAutoNonZk = (selectedEmployee.isZkLinked === false || selectedEmployee.attendanceMode === 'overtime_only') && validLogs.length === 0 && editingDayAnalysis.status === 'present';

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
  }, [selectedEmployee, editingDayAnalysis, editingDayDate, editingDayLogs, shifts, getEmployeeShifts]);

  // Day Navigation in Modal
  const currentDayIndex = useMemo(() => {
    if (!editingDayDate || !employeeTimecardData) return -1;
    return employeeTimecardData.dailyDetails.findIndex(d => d.date === editingDayDate);
  }, [editingDayDate, employeeTimecardData]);

  const handlePrevDay = () => {
    if (!employeeTimecardData || currentDayIndex <= 0) return;
    setEditingDayDate(employeeTimecardData.dailyDetails[currentDayIndex - 1].date);
    setInlineAddOpen(false);
    setEditingSlotId(null);
    setEditingRawLogId(null);
  };

  const handleNextDay = () => {
    if (!employeeTimecardData || currentDayIndex >= employeeTimecardData.dailyDetails.length - 1) return;
    setEditingDayDate(employeeTimecardData.dailyDetails[currentDayIndex + 1].date);
    setInlineAddOpen(false);
    setEditingSlotId(null);
    setEditingRawLogId(null);
  };

  // ── Handlers for Filling and Editing Attendance ───────────────────────────

  // Quick fill a specific slot (or edit it)
  const handleQuickFillSlot = async (slot: ViewingSlot, timeStr?: string, targetDate?: string) => {
    if (!selectedEmployee) return;
    const dateStr = targetDate || editingDayDate;
    if (!dateStr) return;

    const punchTime = timeStr || slotInputTimes[slot.id] || slot.scheduledTime;
    const fullTimeStr = `${dateStr} ${punchTime}:00`;
    const newLogId = `MANUAL_${selectedEmployee.id}_${slot.id}_${Date.now()}`;

    const newLog: HRAttendanceLog = {
      id: newLogId,
      userId: selectedEmployee.id,
      badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
      checkTime: fullTimeStr,
      checkType: slot.type,
      source: 'manual',
      notes: `تعديل/تعبئة يدوية: ${slot.label}`
    };

    // Remove old matched log if replacing, and remove any explicit ABSENT log
    const cleanLogs = attendanceLogs.filter(l => {
      const isUserMatch = isLogMatchingEmployee(l, selectedEmployee);
      if (isUserMatch && l.checkTime.startsWith(dateStr) && l.checkType === 'ABSENT') {
        return false;
      }
      return slot.matchedLog ? l.id !== slot.matchedLog.id : true;
    });

    await setAttendanceLogs([newLog, ...cleanLogs]);
  };

  // Edit existing punch time
  const handleEditExistingPunch = async (logId: string, newTime: string, dateStr: string) => {
    if (!selectedEmployee) return;
    if (!newTime) return alert('الرجاء إدخال وقت البصمة الجديد');
    const fullTimeStr = `${dateStr} ${newTime}:00`;

    const updated = attendanceLogs.map(l => {
      if (l.id === logId) {
        return {
          ...l,
          checkTime: fullTimeStr,
          source: 'manual' as const,
          notes: (l.notes ? l.notes + ' - ' : '') + 'تم تعديل الوقت يدوياً'
        };
      }
      return l;
    });

    const cleanLogs = updated.filter(l => {
      const isUserMatch = isLogMatchingEmployee(l, selectedEmployee);
      return !(isUserMatch && l.checkTime.startsWith(dateStr) && l.checkType === 'ABSENT');
    });

    await setAttendanceLogs(cleanLogs);
  };

  // Delete / Undo a single punch
  const handleDeleteOrUndoPunch = async (logId: string) => {
    const updated = attendanceLogs.filter(l => l.id !== logId);
    await setAttendanceLogs(updated);
  };

  // Resolve scheduled time for a given slot and shift
  const getSlotScheduledTime = (
    slotKey: 'p1_in' | 'p1_out' | 'p2_in' | 'p2_out',
    dayShift?: HRShift,
    dayShifts?: HRShift[]
  ): string => {
    const empShifts = (dayShifts && dayShifts.length > 0) ? dayShifts : (selectedEmployee ? getEmployeeShifts(selectedEmployee) : []);

    if (empShifts.length > 1) {
      const s1 = empShifts[0];
      const s2 = empShifts[1];
      switch (slotKey) {
        case 'p1_in': return s1.startTime || '08:00';
        case 'p1_out': return s1.endTime || '13:00';
        case 'p2_in': return s2.startTime || '14:00';
        case 'p2_out': return s2.endTime || '18:00';
      }
    }

    const s = dayShift || empShifts[0] || (selectedEmployee ? getEmployeeShift(selectedEmployee) : shifts[0]) || {
      startTime: '08:00',
      endTime: '16:00',
      isSplitShift: false
    };

    if (s.isSplitShift && s.splitBreakStart && s.splitBreakEnd) {
      switch (slotKey) {
        case 'p1_in': return s.startTime || '09:00';
        case 'p1_out': return s.splitBreakStart || '13:00';
        case 'p2_in': return s.splitBreakEnd || '14:00';
        case 'p2_out': return s.endTime || '18:00';
      }
    }

    // Single standard shift
    switch (slotKey) {
      case 'p1_in': return s.startTime || '08:00';
      case 'p1_out': return s.endTime || '16:00';
      case 'p2_in': return s.startTime || '08:00';
      case 'p2_out': return s.endTime || '16:00';
    }
  };

  // Direct cell punch when clicking on --:-- from the table row
  const handleDirectCellPunch = async (
    dateStr: string,
    slotKey: 'p1_in' | 'p1_out' | 'p2_in' | 'p2_out',
    dayShift?: HRShift,
    dayShifts?: HRShift[]
  ) => {
    if (!selectedEmployee) return;
    if (!hasPermission('hr', 'create')) {
      alert('ليس لديك صلاحية لتعديل سجلات الحضور');
      return;
    }

    const cellKey = `${dateStr}_${slotKey}`;
    setPunchingCell(cellKey);

    try {
      const punchTime = getSlotScheduledTime(slotKey, dayShift, dayShifts);
      const isCheckIn = slotKey.endsWith('_in');
      const slotLabels = {
        p1_in: 'دخول ص (1)',
        p1_out: 'خروج ص (1)',
        p2_in: 'دخول م (2)',
        p2_out: 'خروج م (2)'
      };

      const newLogId = `MANUAL_${selectedEmployee.id}_${slotKey}_${Date.now()}`;
      const newLog: HRAttendanceLog = {
        id: newLogId,
        userId: selectedEmployee.id,
        badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
        checkTime: `${dateStr} ${punchTime}:00`,
        checkType: isCheckIn ? 'I' : 'O',
        source: 'manual',
        notes: `تعبئة مباشرة: ${slotLabels[slotKey]}`
      };

      // Remove any explicit ABSENT log for this employee on this date
      const cleanLogs = attendanceLogs.filter(l => {
        const isUserMatch = isLogMatchingEmployee(l, selectedEmployee);
        if (isUserMatch && l.checkTime.startsWith(dateStr) && l.checkType === 'ABSENT') {
          return false;
        }
        return true;
      });

      await setAttendanceLogs([newLog, ...cleanLogs]);
    } catch (err: any) {
      console.error('Error adding direct punch:', err);
      alert('حدث خطأ أثناء إضافة البصمة المباشرة: ' + (err?.message || err));
    } finally {
      setPunchingCell(null);
    }
  };

  // Fill all missing slots for a day
  const handleFillAllMissingForDay = async (targetDate: string) => {
    if (!selectedEmployee) return;
    if (!hasPermission('hr', 'create')) {
      alert('ليس لديك صلاحية لتعديل سجلات الحضور');
      return;
    }

    const empShifts = getEmployeeShifts(selectedEmployee);
    const dayShift = getEmployeeShift(selectedEmployee);

    const dayLogs = attendanceLogs.filter(l => {
      const isUserMatch = isLogMatchingEmployee(l, selectedEmployee);
      return isUserMatch && l.checkTime.startsWith(targetDate) && l.checkType !== 'ABSENT';
    });

    const existingPunches = dayLogs.map(l => l.checkTime.slice(11, 16));

    const parseMins = (t: string) => {
      const [h, m] = (t || '00:00').split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const isTimeCovered = (timeStr: string) => {
      const tMins = parseMins(timeStr);
      return existingPunches.some(p => Math.abs(parseMins(p) - tMins) <= 45);
    };

    const newPunchLogs: HRAttendanceLog[] = [];
    const timestamp = Date.now();

    if (empShifts.length > 1) {
      const s1 = empShifts[0];
      const s2 = empShifts[1];

      if (!isTimeCovered(s1.startTime || '08:00')) {
        newPunchLogs.push({
          id: `MANUAL_P1_IN_${selectedEmployee.id}_${timestamp}_1`,
          userId: selectedEmployee.id,
          badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
          checkTime: `${targetDate} ${s1.startTime || '08:00'}:00`,
          checkType: 'I',
          source: 'manual',
          notes: `تعبئة سريعة: دخول (${s1.name})`
        });
      }
      if (!isTimeCovered(s1.endTime || '13:00')) {
        newPunchLogs.push({
          id: `MANUAL_P1_OUT_${selectedEmployee.id}_${timestamp}_2`,
          userId: selectedEmployee.id,
          badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
          checkTime: `${targetDate} ${s1.endTime || '13:00'}:00`,
          checkType: 'O',
          source: 'manual',
          notes: `تعبئة سريعة: خروج (${s1.name})`
        });
      }
      if (!isTimeCovered(s2.startTime || '14:00')) {
        newPunchLogs.push({
          id: `MANUAL_P2_IN_${selectedEmployee.id}_${timestamp}_3`,
          userId: selectedEmployee.id,
          badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
          checkTime: `${targetDate} ${s2.startTime || '14:00'}:00`,
          checkType: 'I',
          source: 'manual',
          notes: `تعبئة سريعة: دخول (${s2.name})`
        });
      }
      if (!isTimeCovered(s2.endTime || '18:00')) {
        newPunchLogs.push({
          id: `MANUAL_P2_OUT_${selectedEmployee.id}_${timestamp}_4`,
          userId: selectedEmployee.id,
          badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
          checkTime: `${targetDate} ${s2.endTime || '18:00'}:00`,
          checkType: 'O',
          source: 'manual',
          notes: `تعبئة سريعة: خروج (${s2.name})`
        });
      }
    } else if (dayShift.isSplitShift && dayShift.splitBreakStart && dayShift.splitBreakEnd) {
      const s = dayShift;
      if (!isTimeCovered(s.startTime || '09:00')) {
        newPunchLogs.push({
          id: `MANUAL_P1_IN_${selectedEmployee.id}_${timestamp}_1`,
          userId: selectedEmployee.id,
          badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
          checkTime: `${targetDate} ${s.startTime || '09:00'}:00`,
          checkType: 'I',
          source: 'manual',
          notes: `تعبئة سريعة: دخول صباحي (${s.name})`
        });
      }
      if (!isTimeCovered(s.splitBreakStart || '13:00')) {
        newPunchLogs.push({
          id: `MANUAL_P1_OUT_${selectedEmployee.id}_${timestamp}_2`,
          userId: selectedEmployee.id,
          badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
          checkTime: `${targetDate} ${s.splitBreakStart || '13:00'}:00`,
          checkType: 'O',
          source: 'manual',
          notes: `تعبئة سريعة: خروج صباحي (${s.name})`
        });
      }
      if (!isTimeCovered(s.splitBreakEnd || '14:00')) {
        newPunchLogs.push({
          id: `MANUAL_P2_IN_${selectedEmployee.id}_${timestamp}_3`,
          userId: selectedEmployee.id,
          badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
          checkTime: `${targetDate} ${s.splitBreakEnd || '14:00'}:00`,
          checkType: 'I',
          source: 'manual',
          notes: `تعبئة سريعة: دخول مسائي (${s.name})`
        });
      }
      if (!isTimeCovered(s.endTime || '18:00')) {
        newPunchLogs.push({
          id: `MANUAL_P2_OUT_${selectedEmployee.id}_${timestamp}_4`,
          userId: selectedEmployee.id,
          badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
          checkTime: `${targetDate} ${s.endTime || '18:00'}:00`,
          checkType: 'O',
          source: 'manual',
          notes: `تعبئة سريعة: خروج مسائي (${s.name})`
        });
      }
    } else {
      const s = dayShift;
      if (!isTimeCovered(s.startTime || '08:00')) {
        newPunchLogs.push({
          id: `MANUAL_IN_${selectedEmployee.id}_${timestamp}_1`,
          userId: selectedEmployee.id,
          badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
          checkTime: `${targetDate} ${s.startTime || '08:00'}:00`,
          checkType: 'I',
          source: 'manual',
          notes: `تعبئة سريعة: دخول (${s.name})`
        });
      }
      if (!isTimeCovered(s.endTime || '16:00')) {
        newPunchLogs.push({
          id: `MANUAL_OUT_${selectedEmployee.id}_${timestamp}_2`,
          userId: selectedEmployee.id,
          badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
          checkTime: `${targetDate} ${s.endTime || '16:00'}:00`,
          checkType: 'O',
          source: 'manual',
          notes: `تعبئة سريعة: خروج (${s.name})`
        });
      }
    }

    if (newPunchLogs.length === 0) return;

    const cleanLogs = attendanceLogs.filter(l => {
      const isUserMatch = isLogMatchingEmployee(l, selectedEmployee);
      return !(isUserMatch && l.checkTime.startsWith(targetDate) && l.checkType === 'ABSENT');
    });

    await setAttendanceLogs([...newPunchLogs, ...cleanLogs]);
  };

  // Fill missing slots inside the modal
  const handleFillMissingSlotsInModal = async () => {
    if (!selectedEmployee || !editingDayDate) return;
    const missingSlots = editingSlots.filter(s => !s.matchedLog && !s.recordedTime);
    if (missingSlots.length === 0) return;

    const newLogs: HRAttendanceLog[] = missingSlots.map((slot, idx) => {
      const punchTime = slotInputTimes[slot.id] || slot.scheduledTime;
      return {
        id: `MANUAL_${selectedEmployee.id}_${slot.id}_${Date.now() + idx}`,
        userId: selectedEmployee.id,
        badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
        checkTime: `${editingDayDate} ${punchTime}:00`,
        checkType: slot.type,
        source: 'manual',
        notes: `تعبئة يدوية سريعة: ${slot.label}`
      };
    });

    const cleanLogs = attendanceLogs.filter(l => {
      const isUserMatch = isLogMatchingEmployee(l, selectedEmployee);
      return !(isUserMatch && l.checkTime.startsWith(editingDayDate) && l.checkType === 'ABSENT');
    });

    await setAttendanceLogs([...newLogs, ...cleanLogs]);
  };

  // Quick toggle attendance / absence for a day
  const handleQuickToggleAttendanceForDay = async (targetDate: string, currentStatus: string) => {
    if (!selectedEmployee) return;
    try {
      const empShifts = getEmployeeShifts(selectedEmployee);
      const targetShifts = empShifts.length > 0 ? empShifts : [shifts[0] || { id: 'default', name: 'الوردية الافتراضية', startTime: '08:00', endTime: '16:00', workHours: 8 } as any];

      if (currentStatus === 'absent') {
        const newPunchLogs: HRAttendanceLog[] = [];
        targetShifts.forEach((s, idx) => {
          const inTime = `${targetDate} ${s.startTime || '08:00'}:00`;
          const outTime = `${targetDate} ${s.endTime || '16:00'}:00`;
          newPunchLogs.push({
            id: `MANUAL_IN_${selectedEmployee.id}_${Date.now()}_${idx}`,
            userId: selectedEmployee.id,
            badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
            checkTime: inTime,
            checkType: 'I',
            source: 'manual',
            notes: `تحضير يدوي معتمد (${s.name || 'الوردية'})`
          });
          newPunchLogs.push({
            id: `MANUAL_OUT_${selectedEmployee.id}_${Date.now() + 1}_${idx}`,
            userId: selectedEmployee.id,
            badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
            checkTime: outTime,
            checkType: 'O',
            source: 'manual',
            notes: `تحضير يدوي معتمد (${s.name || 'الوردية'})`
          });
        });

        const cleanLogs = attendanceLogs.filter(l => {
          const isUserMatch = isLogMatchingEmployee(l, selectedEmployee);
          return !(isUserMatch && l.checkTime.startsWith(targetDate) && (l.checkType === 'ABSENT' || l.source === 'manual' || (l.notes && l.notes.includes('يدو'))));
        });

        await setAttendanceLogs([...newPunchLogs, ...cleanLogs]);
      } else {
        const absentLog: HRAttendanceLog = {
          id: `MANUAL_ABSENT_${selectedEmployee.id}_${Date.now()}`,
          userId: selectedEmployee.id,
          badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
          checkTime: `${targetDate} 12:00:00`,
          checkType: 'ABSENT',
          source: 'manual',
          notes: 'غياب يدوي معتمد'
        };

        const cleanLogs = attendanceLogs.filter(l => {
          const isUserMatch = isLogMatchingEmployee(l, selectedEmployee);
          return !(isUserMatch && l.checkTime.startsWith(targetDate) && (l.checkType === 'ABSENT' || l.source === 'manual' || (l.notes && l.notes.includes('يدو'))));
        });

        await setAttendanceLogs([absentLog, ...cleanLogs]);
      }
    } catch (err: any) {
      console.error('Error in handleQuickToggleAttendanceForDay:', err);
      alert('حدث خطأ أثناء تعديل حالة الحضور: ' + (err?.message || err));
    }
  };

  // Reset manual day
  const handleResetManualDay = async (targetDate: string) => {
    if (!selectedEmployee) return;
    try {
      const cleanLogs = attendanceLogs.filter(l => {
        const isUserMatch = isLogMatchingEmployee(l, selectedEmployee);
        return !(isUserMatch && l.checkTime.startsWith(targetDate) && (l.checkType === 'ABSENT' || l.source === 'manual' || (l.notes && l.notes.includes('يدو'))));
      });
      await setAttendanceLogs(cleanLogs);
    } catch (err: any) {
      console.error('Error in handleResetManualDay:', err);
      alert('حدث خطأ أثناء إعادة الضبط: ' + (err?.message || err));
    }
  };

  // Add custom punch
  const handleCustomAddPunch = async () => {
    if (!selectedEmployee || !editingDayDate) return;
    if (!inlineAddTime) return alert('الرجاء إدخال وقت البصمة');

    const fullTimeStr = `${editingDayDate} ${inlineAddTime}:00`;
    const newLogId = `MANUAL_CUSTOM_${Date.now()}`;

    const newLog: HRAttendanceLog = {
      id: newLogId,
      userId: selectedEmployee.id,
      badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
      checkTime: fullTimeStr,
      checkType: inlineAddType,
      source: 'manual',
      notes: inlineAddNotes || 'إضافة يدوية مخصصة'
    };

    const cleanLogs = attendanceLogs.filter(l => {
      const isUserMatch = isLogMatchingEmployee(l, selectedEmployee);
      return !(isUserMatch && l.checkTime.startsWith(editingDayDate) && l.checkType === 'ABSENT');
    });

    await setAttendanceLogs([newLog, ...cleanLogs]);
    setInlineAddOpen(false);
    setInlineAddNotes('');
  };

  // Bulk fill all missing working days in the month
  const handleFillAllMissingInMonth = async () => {
    if (!selectedEmployee || !employeeTimecardData) return;
    const workDaysToFill = employeeTimecardData.dailyDetails.filter(d => 
      d.status !== 'weekend' && d.status !== 'leave' && (d.status === 'absent' || d.workedHours === 0)
    );

    if (workDaysToFill.length === 0) {
      alert('لا توجد أيام عمل ناقصة أو غائبة في هذا الشهر لتعبئتها.');
      return;
    }

    if (!confirm(`هل أنت متأكد من تعبئة الحضور لكافة أيام العمل غير المسجلة (${workDaysToFill.length} يوم) لهذا الموظف؟`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const empShifts = getEmployeeShifts(selectedEmployee);
      const targetShifts = empShifts.length > 0 ? empShifts : [shifts[0] || { id: 'default', name: 'الوردية الافتراضية', startTime: '08:00', endTime: '16:00', workHours: 8 } as any];

      const newLogs: HRAttendanceLog[] = [];
      const datesSet = new Set(workDaysToFill.map(d => d.date));

      workDaysToFill.forEach((day, dIdx) => {
        targetShifts.forEach((s, sIdx) => {
          newLogs.push({
            id: `MANUAL_IN_${selectedEmployee.id}_${day.date}_${dIdx}_${sIdx}`,
            userId: selectedEmployee.id,
            badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
            checkTime: `${day.date} ${s.startTime || '08:00'}:00`,
            checkType: 'I',
            source: 'manual',
            notes: `تعبئة شهرية شاملة (${s.name})`
          });
          newLogs.push({
            id: `MANUAL_OUT_${selectedEmployee.id}_${day.date}_${dIdx}_${sIdx}`,
            userId: selectedEmployee.id,
            badgeNumber: selectedEmployee.badgeNumber || selectedEmployee.id,
            checkTime: `${day.date} ${s.endTime || '16:00'}:00`,
            checkType: 'O',
            source: 'manual',
            notes: `تعبئة شهرية شاملة (${s.name})`
          });
        });
      });

      const cleanLogs = attendanceLogs.filter(l => {
        const isUserMatch = isLogMatchingEmployee(l, selectedEmployee);
        const logDate = l.checkTime.slice(0, 10);
        return !(isUserMatch && datesSet.has(logDate) && l.checkType === 'ABSENT');
      });

      await setAttendanceLogs([...newLogs, ...cleanLogs]);
      alert(`تمت تعبئة ${workDaysToFill.length} يوم عمل بنجاح.`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Export Matrix to Excel
  const exportMatrixExcel = () => {
    const data = filteredMatrix.map((item, idx) => ({
      'م': idx + 1,
      'طريقة التحضير': item.employee.isZkLinked === false ? 'غير مربوط (معتمد / يدوي)' : 'جهاز البصمة',
      'كود البصمة': item.employee.isZkLinked === false ? 'بدون بصمة' : (item.employee.badgeNumber || '-'),
      'اسم الموظف': item.employee.name,
      'نظام الراتب': item.employee.salaryType === 'daily' ? 'يومية' : 'راتب شهري',
      'القسم': item.employee.deptName || 'عام',
      'الوظيفة': item.employee.jobTitle || 'موظف',
      'أيام العمل المقررة': item.stats.expectedDays,
      'أيام الحضور الفعلية': item.stats.actualWorkDays,
      'أيام الغياب': item.stats.absentDays,
      'أيام الإجازة': item.stats.leaveDays,
      'إجمالي دقائق التأخير': item.stats.totalLateMinutes,
      'إجمالي دقائق الخروج المبكر': item.stats.totalEarlyMinutes || 0,
      'إجمالي ساعات الإضافي': item.stats.totalOvertimeHours,
      'إجمالي ساعات العمل': item.stats.totalWorkedHours
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `حضور_شهري_${selectedMonth}`);
    XLSX.writeFile(wb, `كشف_حضور_شهري_${selectedMonth}.xlsx`);
  };

  // Export Timecard to Excel
  const exportTimecardExcel = () => {
    if (!selectedEmployee || !employeeTimecardData) return;

    const data = employeeTimecardData.dailyDetails.map((day, idx) => ({
      'اليوم': idx + 1,
      'التاريخ': day.date,
      'اليوم بالأسبوع': new Date(day.date + 'T00:00:00').toLocaleDateString('ar-LY', { weekday: 'long' }),
      'الوردية': day.shift.name,
      'دخول (فترة 1)': day.morningIn || (day.firstIn && !day.eveningIn ? day.firstIn : '-'),
      'خروج (فترة 1)': day.morningOut || '-',
      'دخول (فترة 2)': day.eveningIn || '-',
      'خروج (فترة 2)': day.eveningOut || (day.lastOut && day.lastOut !== day.morningIn ? day.lastOut : '-'),
      'التأخير (دقيقة)': day.lateMinutes || 0,
      'الخروج المبكر (دقيقة)': day.earlyMinutes || 0,
      'الإضافي (ساعة)': day.overtimeHours || 0,
      'ساعات العمل': day.workedHours || 0,
      'الحالة':
        day.status === 'present' ? 'حاضر' :
        day.status === 'late' ? 'متأخر' :
        day.status === 'single_punch' ? `بصمة ناقصة (خصم ${(day.missingPunchPenaltyMinutes || 0) / 60}س)` :
        day.status === 'leave' ? 'إجازة' :
        day.status === 'weekend' ? 'عطلة أسبوعية' : 'غائب'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `بطاقة_${selectedEmployee.name}`);
    XLSX.writeFile(wb, `بطاقة_حضور_${selectedEmployee.name}_${selectedMonth}.xlsx`);
  };

  // Print Timecard
  const handlePrintTimecard = () => {
    if (!selectedEmployee || !employeeTimecardData) return;
    setPrintData({
      type: 'HR_TIMECARD',
      data: {
        employee: selectedEmployee,
        month: selectedMonth,
        stats: employeeTimecardData,
        dailyDetails: employeeTimecardData.dailyDetails,
        printedBy: currentUser?.displayName || 'المستخدم'
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-blue-600" />
            التقارير الشهرية وبطاقات الحضور
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            كشوفات الحضور الشهرية الإجمالية وبطاقة الحضور والانصراف الفردية لكل موظف
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto">
          {/* Month selector */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-600">الشهر:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-800 outline-none font-mono"
            />
          </div>

          {/* Sub tab switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveSubTab('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'matrix' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              الكشف الشهري العام
            </button>
            <button
              onClick={() => setActiveSubTab('timecard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'timecard' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
              }`}
            >
              بطاقة الموظف الفردية
            </button>
          </div>
        </div>
      </div>

      {/* ── SubTab 1: Comprehensive Monthly Matrix ──────────────────────────── */}
      {activeSubTab === 'matrix' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex justify-between items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                placeholder="بحث باسم الموظف أو القسم..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
              />
            </div>
            <button
              onClick={exportMatrixExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>تصدير Excel</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5 w-12 text-center">#</th>
                    <th className="p-3.5">الموظف</th>
                    <th className="p-3.5">القسم</th>
                    <th className="p-3.5 text-center">أيام الدوام المقررة</th>
                    <th className="p-3.5 text-center">أيام الحضور الفعلية</th>
                    <th className="p-3.5 text-center">أيام الغياب</th>
                    <th className="p-3.5 text-center">الإجازات</th>
                    <th className="p-3.5 text-center">التأخير والخروج</th>
                    <th className="p-3.5 text-center">ساعات الإضافي</th>
                    <th className="p-3.5 text-center">إجمالي ساعات العمل</th>
                    <th className="p-3.5 text-center w-24">بطاقة الحضور</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMatrix.map((item, idx) => (
                    <tr key={item.employee.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{item.employee.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {item.employee.isZkLinked === false ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-purple-50 text-purple-700 border border-purple-200 rounded">
                              بدون بصمة (معتمد)
                            </span>
                          ) : item.employee.attendanceMode === 'overtime_only' ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200 rounded">
                              بصمة #{item.employee.badgeNumber} (إضافي فقط)
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono">#{item.employee.badgeNumber}</span>
                          )}
                          <span className="text-slate-300 text-xs">•</span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {item.employee.salaryType === 'daily' ? 'يومية' : 'راتب شهري'}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-xs text-slate-700">{item.employee.deptName || 'عام'}</td>
                      <td className="p-3 text-center font-bold font-mono">{item.stats.expectedDays} يوم</td>
                      <td className="p-3 text-center font-bold font-mono text-emerald-700">{item.stats.actualWorkDays} يوم</td>
                      <td className="p-3 text-center font-bold font-mono">
                        {item.stats.absentDays > 0 ? (
                          <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded">{item.stats.absentDays} يوم</span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono">
                        {item.stats.leaveDays > 0 ? `${item.stats.leaveDays} يوم` : '-'}
                      </td>
                      <td className="p-3 text-center font-mono">
                        {((item.stats.totalLateMinutes || 0) > 0 || (item.stats.totalEarlyMinutes || 0) > 0) ? (
                          <div className="flex flex-col items-center gap-0.5">
                            {(item.stats.totalLateMinutes || 0) > 0 && (
                              <span className="text-amber-700 font-bold" title="دقائق التأخير الصباحي">
                                تأخير: {item.stats.totalLateMinutes} د
                              </span>
                            )}
                            {(item.stats.totalEarlyMinutes || 0) > 0 && (
                              <span className="text-orange-700 font-bold" title="دقائق الخروج المبكر">
                                خروج: {item.stats.totalEarlyMinutes} د
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-purple-700">
                        {item.stats.totalOvertimeHours > 0 ? `+${item.stats.totalOvertimeHours} س` : '-'}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-800">
                        {item.stats.totalWorkedHours} س
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedEmpId(item.employee.id);
                            setActiveSubTab('timecard');
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors"
                        >
                          عرض البطاقة
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SubTab 2: Individual Employee Timecard ───────────────────────────── */}
      {activeSubTab === 'timecard' && selectedEmployee && employeeTimecardData && (
        <div className="space-y-4">
          {/* Employee Selector Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <User className="w-4 h-4 text-blue-600" />
                الموظف:
              </span>
              <select
                value={selectedEmpId}
                onChange={e => setSelectedEmpId(e.target.value)}
                className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none w-full md:w-72"
              >
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name} {e.isZkLinked === false ? '(بدون بصمة - معتمد)' : (e.attendanceMode === 'overtime_only' ? `(بصمة: #${e.badgeNumber} - إضافي فقط)` : `(بصمة: #${e.badgeNumber})`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {hasPermission('hr', 'create') && (
                <button
                  onClick={handleFillAllMissingInMonth}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition-colors border border-emerald-200 disabled:opacity-50 cursor-pointer"
                  title="تعبئة كافة أيام العمل الناقصة في هذا الشهر للموظف وفق الوردية المقررة"
                >
                  <Sparkles className={`w-4 h-4 text-emerald-600 ${isProcessing ? 'animate-spin' : ''}`} />
                  <span>{isProcessing ? 'جاري التعبئة...' : 'تعبئة أيام الشهر الناقصة'}</span>
                </button>
              )}
              <button
                onClick={exportTimecardExcel}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Excel</span>
              </button>
              {hasPermission('hr', 'print') && (
                <button
                  onClick={handlePrintTimecard}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة بطاقة الحضور</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Employee Month Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500">أيام الحضور الفعلية</div>
              <div className="text-2xl font-black text-emerald-700 mt-1">
                {employeeTimecardData.actualWorkDays} / {employeeTimecardData.expectedDays}
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500">أيام الغياب</div>
              <div className="text-2xl font-black text-red-600 mt-1">
                {employeeTimecardData.absentDays}
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500">التأخير والخروج المبكر</div>
              <div className="text-2xl font-black text-amber-700 mt-1 font-mono">
                {employeeTimecardData.totalLateMinutes + (employeeTimecardData.totalEarlyMinutes || 0)} د
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                تأخير: {employeeTimecardData.totalLateMinutes} د • خروج: {employeeTimecardData.totalEarlyMinutes || 0} د
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500">ساعات العمل الإضافي</div>
              <div className="text-2xl font-black text-purple-700 mt-1 font-mono">
                {employeeTimecardData.totalOvertimeHours} س
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500">إجمالي ساعات العمل</div>
              <div className="text-2xl font-black text-slate-800 mt-1 font-mono">
                {employeeTimecardData.totalWorkedHours} س
              </div>
            </div>
          </div>

          {/* Day by Day Timecard Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3 w-10 text-center">اليوم</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">يوم الأسبوع</th>
                    <th className="p-3">الوردية</th>
                    <th className="p-2.5 text-center">دخول ص (1)</th>
                    <th className="p-2.5 text-center">خروج ص (1)</th>
                    <th className="p-2.5 text-center">دخول م (2)</th>
                    <th className="p-2.5 text-center">خروج م (2)</th>
                    <th className="p-3 text-center">ساعات العمل</th>
                    <th className="p-3 text-center">التأخير والخروج</th>
                    <th className="p-3 text-center">الإضافي</th>
                    <th className="p-3 text-center">الحالة</th>
                    <th className="p-3 text-center w-28">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employeeTimecardData.dailyDetails.map((day, idx) => {
                    const dayName = new Date(day.date + 'T00:00:00').toLocaleDateString('ar-LY', { weekday: 'long' });
                    const isManualModified = manualModifiedDatesSet.has(day.date);

                    return (
                      <tr
                        key={day.date}
                        className={`transition-colors ${
                          day.status === 'weekend' ? 'bg-slate-50/50' :
                          day.status === 'absent' ? 'bg-red-50/30' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="p-2.5 text-center font-mono font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-2.5 font-mono text-slate-800">{day.date}</td>
                        <td className="p-2.5 font-bold text-slate-700">{dayName}</td>
                        <td className="p-2.5 text-slate-600">{day.shift.name}</td>
                        
                        {/* دخول ص (1) */}
                        <td className="p-2.5 text-center font-mono font-bold">
                          {day.morningIn || (day.firstIn && !day.eveningIn ? day.firstIn : null) ? (
                            <button
                              onClick={() => setEditingDayDate(day.date)}
                              className="group inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:shadow-2xs px-2 py-0.5 rounded text-xs font-mono transition-all border border-emerald-200/60"
                              title="انقر لتعديل وقت الدخول الصباحي (فتح نافذة التفاصيل)"
                            >
                              <span>{day.morningIn || day.firstIn}</span>
                              <Pencil className="w-2.5 h-2.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDirectCellPunch(day.date, 'p1_in', day.shift, day.shifts)}
                              disabled={punchingCell === `${day.date}_p1_in`}
                              className="group inline-flex items-center gap-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 px-1.5 py-0.5 rounded text-xs font-mono transition-colors border border-transparent hover:border-emerald-200 disabled:opacity-50"
                              title={`انقر لتسجيل دخول ص (1) مباشرة (${getSlotScheduledTime('p1_in', day.shift, day.shifts)})`}
                            >
                              <span>--:--</span>
                              <Plus className="w-2.5 h-2.5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          )}
                        </td>

                        {/* خروج ص (1) */}
                        <td className="p-2.5 text-center font-mono font-bold">
                          {day.morningOut ? (
                            <button
                              onClick={() => setEditingDayDate(day.date)}
                              className="group inline-flex items-center gap-1 text-slate-700 bg-slate-100 hover:bg-slate-200 hover:shadow-2xs px-2 py-0.5 rounded text-xs font-mono transition-all border border-slate-200"
                              title="انقر لتعديل وقت الخروج الصباحي (فتح نافذة التفاصيل)"
                            >
                              <span>{day.morningOut}</span>
                              <Pencil className="w-2.5 h-2.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDirectCellPunch(day.date, 'p1_out', day.shift, day.shifts)}
                              disabled={punchingCell === `${day.date}_p1_out`}
                              className="group inline-flex items-center gap-1 text-slate-400 hover:text-blue-700 hover:bg-blue-50 px-1.5 py-0.5 rounded text-xs font-mono transition-colors border border-transparent hover:border-blue-200 disabled:opacity-50"
                              title={`انقر لتسجيل خروج ص (1) مباشرة (${getSlotScheduledTime('p1_out', day.shift, day.shifts)})`}
                            >
                              <span>--:--</span>
                              <Plus className="w-2.5 h-2.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          )}
                        </td>

                        {/* دخول م (2) */}
                        <td className="p-2.5 text-center font-mono font-bold">
                          {day.eveningIn ? (
                            <button
                              onClick={() => setEditingDayDate(day.date)}
                              className="group inline-flex items-center gap-1 text-purple-700 bg-purple-50 hover:bg-purple-100 hover:shadow-2xs px-2 py-0.5 rounded text-xs font-mono transition-all border border-purple-200/60"
                              title="انقر لتعديل وقت الدخول المسائي (فتح نافذة التفاصيل)"
                            >
                              <span>{day.eveningIn}</span>
                              <Pencil className="w-2.5 h-2.5 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDirectCellPunch(day.date, 'p2_in', day.shift, day.shifts)}
                              disabled={punchingCell === `${day.date}_p2_in`}
                              className="group inline-flex items-center gap-1 text-slate-400 hover:text-purple-700 hover:bg-purple-50 px-1.5 py-0.5 rounded text-xs font-mono transition-colors border border-transparent hover:border-purple-200 disabled:opacity-50"
                              title={`انقر لتسجيل دخول م (2) مباشرة (${getSlotScheduledTime('p2_in', day.shift, day.shifts)})`}
                            >
                              <span>--:--</span>
                              <Plus className="w-2.5 h-2.5 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          )}
                        </td>

                        {/* خروج م (2) */}
                        <td className="p-2.5 text-center font-mono font-bold">
                          {day.eveningOut || (day.lastOut && day.lastOut !== day.morningIn && day.lastOut !== day.morningOut ? day.lastOut : null) ? (
                            <button
                              onClick={() => setEditingDayDate(day.date)}
                              className="group inline-flex items-center gap-1 text-blue-700 bg-blue-50 hover:bg-blue-100 hover:shadow-2xs px-2 py-0.5 rounded text-xs font-mono transition-all border border-blue-200/60"
                              title="انقر لتعديل وقت الخروج المسائي (فتح نافذة التفاصيل)"
                            >
                              <span>{day.eveningOut || day.lastOut}</span>
                              <Pencil className="w-2.5 h-2.5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDirectCellPunch(day.date, 'p2_out', day.shift, day.shifts)}
                              disabled={punchingCell === `${day.date}_p2_out`}
                              className="group inline-flex items-center gap-1 text-slate-400 hover:text-blue-700 hover:bg-blue-50 px-1.5 py-0.5 rounded text-xs font-mono transition-colors border border-transparent hover:border-blue-200 disabled:opacity-50"
                              title={`انقر لتسجيل خروج م (2) مباشرة (${getSlotScheduledTime('p2_out', day.shift, day.shifts)})`}
                            >
                              <span>--:--</span>
                              <Plus className="w-2.5 h-2.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          )}
                        </td>

                        <td className="p-2.5 text-center font-mono font-bold">
                          {day.workedHours > 0 ? `${day.workedHours} س` : '-'}
                        </td>
                        <td className="p-2.5 text-center font-mono">
                          {((day.lateMinutes || 0) > 0 || (day.earlyMinutes || 0) > 0) ? (
                            <div className="flex flex-col items-center gap-0.5">
                              {(day.missingPunchPenaltyMinutes || 0) > 0 ? (
                                <span className="text-rose-800 font-bold bg-rose-100 px-1.5 py-0.5 rounded text-[11px]" title={`خصم عدم وجود البصمة (${(day.missingPunchPenaltyMinutes || 0) / 60} ساعة)`}>
                                  خصم بصمة: {(day.missingPunchPenaltyMinutes || 0) / 60}س
                                  {(day.lateMinutes - (day.missingPunchPenaltyMinutes || 0)) > 0 && ` (+${day.lateMinutes - (day.missingPunchPenaltyMinutes || 0)}د)`}
                                </span>
                              ) : (
                                (day.lateMinutes || 0) > 0 && (
                                  <span className="text-amber-800 font-bold bg-amber-100 px-1.5 py-0.5 rounded text-[11px]" title="تأخير صباحي">
                                    تأخير: {day.lateMinutes} د
                                  </span>
                                )
                              )}
                              {(day.earlyMinutes || 0) > 0 && (
                                <span className="text-orange-800 font-bold bg-orange-100 px-1.5 py-0.5 rounded text-[11px]" title="خروج مبكر">
                                  خروج: {day.earlyMinutes} د
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold">
                          {day.overtimeHours > 0 ? (
                            <span className="text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded">
                              +{day.overtimeHours} س
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {day.status === 'present' && <span className="text-emerald-700 font-bold">حاضر</span>}
                          {day.status === 'late' && <span className="text-amber-700 font-bold">متأخر</span>}
                          {day.status === 'single_punch' && (
                            <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded text-xs border border-amber-300">
                              بصمة ناقصة {(day.missingPunchPenaltyMinutes || 0) > 0 && `(-${(day.missingPunchPenaltyMinutes || 0) / 60}س)`}
                            </span>
                          )}
                          {day.status === 'leave' && <span className="text-purple-700 font-bold">إجازة</span>}
                          {day.status === 'weekend' && <span className="text-slate-400 font-bold">عطلة</span>}
                          {day.status === 'absent' && <span className="text-red-600 font-bold">غائب</span>}
                        </td>

                        {/* الإجراءات */}
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Open Day Punch Modal */}
                            <button
                              onClick={() => setEditingDayDate(day.date)}
                              className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                              title="تعديل وتعبئة بصمات هذا اليوم"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* Quick Fill Button if not weekend/leave and has missing punches or absent */}
                            {hasPermission('hr', 'create') && day.status !== 'weekend' && day.status !== 'leave' && (
                              day.workedHours === 0 ||
                              day.status === 'absent' ||
                              day.status === 'single_punch' ||
                              !day.morningIn ||
                              !day.morningOut ||
                              (Boolean(day.shift?.isSplitShift || (day.shifts && day.shifts.length > 1)) && (!day.eveningIn || !day.eveningOut))
                            ) && (
                              <button
                                onClick={() => handleFillAllMissingForDay(day.date)}
                                className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors border border-emerald-200"
                                title="تعبئة سريعة لكافة البصمات الناقصة لهذا اليوم وفق الوردية"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Quick Toggle Absence / Presence */}
                            {hasPermission('hr', 'create') && (
                              <>
                                {day.status === 'absent' ? (
                                  <button
                                    onClick={() => handleQuickToggleAttendanceForDay(day.date, 'absent')}
                                    className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors border border-emerald-200"
                                    title="تسجيل حضور اليوم (يدوي)"
                                  >
                                    <UserCheck className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleQuickToggleAttendanceForDay(day.date, 'present')}
                                    className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors border border-red-200"
                                    title="تسجيل غياب اليوم (يدوي)"
                                  >
                                    <UserX className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}

                            {/* Reset Button if manual action on this day */}
                            {isManualModified && (
                              <button
                                onClick={() => handleResetManualDay(day.date)}
                                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                                title="إعادة ضبط إلى الوضع الافتراضي لليوم (إلغاء التعديل اليدوي)"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Individual Day Punch & Attendance Editor Modal ───────────────────── */}
          {editingDayDate && selectedEmployee && editingDayAnalysis && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 border border-slate-200">
                {/* Modal Header with Day Switcher */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
                      <Clock className="w-5 h-5 text-blue-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Day Switcher Navigation: Right Arrow (Prev) + Date in Middle + Left Arrow (Next) */}
                        <div className="flex items-center bg-white/10 hover:bg-white/15 p-1 rounded-2xl border border-white/10 backdrop-blur-xs transition-colors shadow-xs">
                          <button
                            onClick={handlePrevDay}
                            disabled={currentDayIndex <= 0}
                            className="p-1 hover:bg-white/20 active:scale-95 text-slate-200 hover:text-white rounded-xl transition-all disabled:opacity-30 disabled:pointer-events-none"
                            title="اليوم السابق (السهم الأيمن)"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>

                          <div className="px-2.5 flex items-center gap-2">
                            <h3 className="font-black text-sm sm:text-base text-white tracking-wide select-none">
                              {new Date(editingDayDate + 'T00:00:00').toLocaleDateString('ar-LY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </h3>
                            {employeeTimecardData && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-white/20 text-slate-200" title="اليوم في الشهر">
                                {currentDayIndex + 1}/{employeeTimecardData.dailyDetails.length}
                              </span>
                            )}
                          </div>

                          <button
                            onClick={handleNextDay}
                            disabled={!employeeTimecardData || currentDayIndex >= employeeTimecardData.dailyDetails.length - 1}
                            className="p-1 hover:bg-white/20 active:scale-95 text-slate-200 hover:text-white rounded-xl transition-all disabled:opacity-30 disabled:pointer-events-none"
                            title="اليوم التالي (السهم الأيسر)"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Employee Name & Badge */}
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/30 text-blue-100 border border-blue-400/30">
                          {selectedEmployee.name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                        <span>{selectedEmployee.deptName || 'القسم العام'}</span>
                        <span>•</span>
                        <span>{selectedEmployee.jobTitle || 'موظف'}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-300">
                          {selectedEmployee.isZkLinked === false ? 'دوام غير مربوط' : (selectedEmployee.attendanceMode === 'overtime_only' ? `بصمة #${selectedEmployee.badgeNumber} (إضافي فقط)` : `بصمة #${selectedEmployee.badgeNumber}`)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => { setEditingDayDate(null); setInlineAddOpen(false); setEditingSlotId(null); setEditingRawLogId(null); }}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                    title="إغلاق النافذة"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body (Scrollable) */}
                <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                  
                  {/* Top KPI Summary Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="text-slate-500 font-medium text-[11px]">الوردية المقررة</div>
                      <div className="font-bold text-slate-900 mt-0.5 truncate">{editingDayAnalysis.shift.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{editingDayAnalysis.shift.startTime} - {editingDayAnalysis.shift.endTime}</div>
                    </div>
                    <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                      <div className="text-emerald-700 font-medium text-[11px]">ساعات العمل المحسوبة</div>
                      <div className="font-black text-emerald-800 text-sm mt-0.5 font-mono">
                        {editingDayAnalysis.workedHours} س <span className="text-emerald-600/70 text-[11px]">/ {editingDayAnalysis.scheduledHours || 8} س</span>
                      </div>
                    </div>
                    <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl">
                      <div className="text-amber-700 font-medium text-[11px]">التأخير المسجل</div>
                      <div className="font-black text-amber-800 text-sm mt-0.5 font-mono">
                        {editingDayAnalysis.lateMinutes > 0 ? `${editingDayAnalysis.lateMinutes} دقيقة` : 'لا يوجد'}
                      </div>
                    </div>
                    <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl">
                      <div className="text-blue-700 font-medium text-[11px]">حالة اليوم</div>
                      <div className="font-bold text-sm mt-0.5">
                        {editingDayAnalysis.status === 'present' && <span className="text-emerald-700">حاضر</span>}
                        {editingDayAnalysis.status === 'late' && <span className="text-amber-700">متأخر</span>}
                        {editingDayAnalysis.status === 'single_punch' && (
                          <span className="text-amber-800 font-bold">
                            بصمة ناقصة {(editingDayAnalysis.missingPunchPenaltyMinutes || 0) > 0 && `(-${(editingDayAnalysis.missingPunchPenaltyMinutes || 0) / 60}س)`}
                          </span>
                        )}
                        {editingDayAnalysis.status === 'leave' && <span className="text-purple-700">في إجازة</span>}
                        {editingDayAnalysis.status === 'weekend' && <span className="text-slate-600">عطلة</span>}
                        {editingDayAnalysis.status === 'absent' && <span className="text-red-700">غائب</span>}
                      </div>
                    </div>
                  </div>

                  {/* Missing Punch Penalty Warning Banner */}
                  {(editingDayAnalysis.missingPunchPenaltyMinutes || 0) > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-sm">
                            يوجد نقص في بصمات هذا اليوم (خصم تأخير {(editingDayAnalysis.missingPunchPenaltyMinutes || 0) / 60} ساعة)
                          </div>
                          <div className="text-[11px] text-amber-800/80 mt-0.5">
                            وفق قاعدة المنظومة، تم احتساب خصم تأخير بمقدار {(editingDayAnalysis.missingPunchPenaltyMinutes || 0) / 60} ساعة على الراتب. اضغط على زر <strong>"تعبئة سريعة"</strong> أمام البصمة الناقصة أدناه لإلغاء الخصم فوراً.
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleFillAllMissingForDay(editingDayDate)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors text-xs flex items-center gap-1 shadow-xs shrink-0"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>تعبئة وإلغاء الخصم</span>
                      </button>
                    </div>
                  )}

                  {/* Explicit Absence Warning Banner */}
                  {editingDayLogs.some(l => l.checkType === 'ABSENT' || (l.notes && l.notes === 'غياب يدوي معتمد')) && (
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
                          onClick={() => handleQuickToggleAttendanceForDay(editingDayDate, 'absent')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors text-xs flex items-center gap-1 shadow-xs"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>تسجيل حضور يدوي</span>
                        </button>
                        <button
                          onClick={() => handleResetManualDay(editingDayDate)}
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
                          حقول البصمات المطلوبة لليوم حسب جدول الموظف
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          يمكنك تعبئة أي حركة دخول أو خروج ناقصة، أو تعديل وتصحيح التوقيت المسجل بنقرة واحدة.
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 self-start sm:self-auto flex-wrap">
                        {/* Quick Manual Attendance / Absence Toggle */}
                        {hasPermission('hr', 'create') && (
                          <button
                            onClick={() => handleQuickToggleAttendanceForDay(editingDayDate, editingDayAnalysis.status)}
                            className={`px-2.5 py-1.5 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 ${
                              editingDayAnalysis.status === 'absent'
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                            }`}
                            title={editingDayAnalysis.status === 'absent' ? 'تسجيل حضور الموظف اليوم' : 'تسجيل الموظف كغائب لليوم'}
                          >
                            {editingDayAnalysis.status === 'absent' ? (
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

                        {/* Fill all missing slots for the day */}
                        {editingSlots.some(s => !s.matchedLog && !s.recordedTime) && (
                          <button
                            onClick={handleFillMissingSlotsInModal}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5"
                            title="تعبئة كافة البصمات غير المسجلة لهذا اليوم"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>تعبئة كل الناقص ({editingSlots.filter(s => !s.matchedLog && !s.recordedTime).length})</span>
                          </button>
                        )}

                        {/* Undo all manual for the day */}
                        {editingDayLogs.some(l => l.source === 'manual' || l.checkType === 'ABSENT' || (l.notes && l.notes.includes('يدو'))) && (
                          <button
                            onClick={() => handleResetManualDay(editingDayDate)}
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
                      {editingSlots.map(slot => {
                        const isRecorded = Boolean(slot.recordedTime);
                        const isManual = slot.isManual;
                        const isAuto = slot.isAutoApproved;
                        const isInlineEditing = editingSlotId === slot.id;

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
                                  {isInlineEditing ? (
                                    /* Inline Time Editing Mode */
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="time"
                                        value={editTimeValue}
                                        onChange={e => setEditTimeValue(e.target.value)}
                                        className="px-2 py-1 bg-white border border-blue-500 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none w-20 text-center shadow-xs"
                                        autoFocus
                                      />
                                      <button
                                        onClick={async () => {
                                          if (slot.matchedLog) {
                                            await handleEditExistingPunch(slot.matchedLog.id, editTimeValue, editingDayDate);
                                          } else {
                                            await handleQuickFillSlot(slot, editTimeValue, editingDayDate);
                                          }
                                          setEditingSlotId(null);
                                        }}
                                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-2xs"
                                        title="حفظ الوقت الجديد"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => setEditingSlotId(null)}
                                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                                        title="إلغاء التعديل"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    /* Normal Display Mode */
                                    <>
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

                                      {/* Edit Time Button */}
                                      {hasPermission('hr', 'create') && (
                                        <button
                                          onClick={() => {
                                            setEditingSlotId(slot.id);
                                            setEditTimeValue(slot.recordedTime || slot.scheduledTime);
                                          }}
                                          className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg border border-blue-200 transition-colors flex items-center gap-1 text-xs font-bold shadow-2xs"
                                          title="تعديل وقت هذه البصمة"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                          <span className="hidden sm:inline">تعديل</span>
                                        </button>
                                      )}

                                      {/* Undo / Delete Button */}
                                      {hasPermission('hr', 'create') && slot.matchedLog && (
                                        <button
                                          onClick={() => handleDeleteOrUndoPunch(slot.matchedLog!.id)}
                                          className="p-1.5 hover:bg-red-50 text-red-600 hover:text-red-700 rounded-lg border border-red-200 transition-colors flex items-center gap-1 text-xs font-bold shadow-2xs"
                                          title="حذف هذه البصمة"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </>
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
                        <span>جميع حركات البصمة المسجلة في هذا اليوم ({editingDayLogs.length})</span>
                      </div>
                      
                      <button
                        onClick={() => setInlineAddOpen(!inlineAddOpen)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{inlineAddOpen ? 'إلغاء الإضافة' : 'إضافة بصمة يدوية مخصصة'}</span>
                      </button>
                    </div>

                    {/* Inline Add Custom Punch Form */}
                    {inlineAddOpen && (
                      <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2.5 animate-in fade-in duration-200">
                        <div className="text-xs font-bold text-blue-900">إضافة حركة حضور أو انصراف جديدة:</div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">وقت البصمة:</label>
                            <input
                              type="time"
                              value={inlineAddTime}
                              onChange={e => setInlineAddTime(e.target.value)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">نوع الحركة:</label>
                            <select
                              value={inlineAddType}
                              onChange={e => setInlineAddType(e.target.value as 'I' | 'O')}
                              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none"
                            >
                              <option value="I">دخول (حضور)</option>
                              <option value="O">خروج (انصراف)</option>
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-slate-500 block mb-0.5">ملاحظات / سبب التعديل:</label>
                            <input
                              type="text"
                              value={inlineAddNotes}
                              onChange={e => setInlineAddNotes(e.target.value)}
                              placeholder="مثال: نسيان البصمة / إذن عمل خارجي..."
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => setInlineAddOpen(false)}
                            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                          >
                            إلغاء
                          </button>
                          <button
                            onClick={handleCustomAddPunch}
                            className="px-3.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs"
                          >
                            حفظ البصمة
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Logs list */}
                    {editingDayLogs.length > 0 ? (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {editingDayLogs.map((l, idx) => {
                          const isMan = l.source === 'manual' || Boolean(l.notes && l.notes.includes('يدو'));
                          const isRawEditing = editingRawLogId === l.id;

                          return (
                            <div
                              key={l.id || idx}
                              className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs hover:bg-slate-100/70 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                  l.checkType === 'I'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : l.checkType === 'O'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-red-100 text-red-800'
                                }`}>
                                  {l.checkType === 'I' ? 'دخول' : l.checkType === 'O' ? 'خروج' : 'غياب'}
                                </span>

                                {isRawEditing ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="time"
                                      value={editingRawLogTime}
                                      onChange={e => setEditingRawLogTime(e.target.value)}
                                      className="px-2 py-0.5 bg-white border border-blue-500 rounded text-xs font-mono font-bold"
                                    />
                                    <button
                                      onClick={async () => {
                                        await handleEditExistingPunch(l.id, editingRawLogTime, editingDayDate);
                                        setEditingRawLogId(null);
                                      }}
                                      className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                      title="حفظ"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => setEditingRawLogId(null)}
                                      className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                                      title="إلغاء"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="font-mono font-bold text-slate-800">
                                    {l.checkTime.slice(11, 16)}
                                  </span>
                                )}

                                <span className="text-slate-400 font-mono text-[10px]">
                                  {l.checkTime}
                                </span>
                                
                                {isMan && (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 font-medium">
                                    يدوي
                                  </span>
                                )}

                                {l.notes && (
                                  <span className="text-slate-500 text-[11px] truncate max-w-xs" title={l.notes}>
                                    ({l.notes})
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                {!isRawEditing && (
                                  <button
                                    onClick={() => {
                                      setEditingRawLogId(l.id);
                                      setEditingRawLogTime(l.checkTime.slice(11, 16));
                                    }}
                                    className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                    title="تعديل وقت البصمة"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteOrUndoPunch(l.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                                  title="حذف هذه البصمة"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-slate-400 text-xs">
                        لا توجد أي بصمات أو حركات مسجلة لهذا اليوم.
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
                  <div className="text-slate-500">
                    يتم احتساب ساعات العمل والغياب والتأخير فوراً وبشكل تلقائي بمجرد التعديل.
                  </div>
                  <button
                    onClick={() => { setEditingDayDate(null); setInlineAddOpen(false); setEditingSlotId(null); setEditingRawLogId(null); }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors shadow-xs"
                  >
                    تم / إغلاق
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
