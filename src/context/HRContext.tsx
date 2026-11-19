import React, { createContext, useContext, useState, useMemo, useEffect, useRef } from 'react';
import { useDatabaseCollection } from '../hooks/useDatabaseCollection';
import { useDatabaseObject } from '../hooks/useDatabaseObject';
import type {
  HREmployee,
  HRShift,
  HRAttendanceLog,
  HRTransaction,
  HRLeave,
  HRPayrollRecord,
  HRPayrollItem,
  HRDayAttendanceAnalysis,
  HRSalaryType,
  HROvertimeMode,
  HREndOfServiceSettlement,
  HROvertimeRecord,
  HROvertimePeriodType,
  HRDetectedOvertimePeriod
} from '../types';
import { zkTestConnection, zkSyncAttendance, zkGetStats } from '../api/client';

export interface HRSettings {
  zkConnectionMode?: 'direct' | 'file';
  zkDeviceIp?: string;
  zkDevicePort?: number;
  zktecoDbPath: string;
  defaultShiftId: string;
  generalOvertimeMode: 'percent' | 'fixed';
  generalOvertimePercent: number; // e.g. 125 (1.25x)
  generalOvertimeFixedRate: number; // e.g. 15 د.ل
  overtimeThresholdScope?: 'per_period' | 'daily_total'; // نطاق تطبيق الحد الأدنى: لكل وردية مستقلة أو إجمالي اليوم
  minOvertimeMinutes?: number; // الحد الأدنى لاحتساب الإضافي بالدقائق (أقل من ذلك يُهمل)
  maxDailyOvertimeHours?: number; // الحد الأقصى للإضافي اليومي بالساعات
  maxMonthlyOvertimeHours?: number; // الحد الأقصى للإضافي الشهري بالساعات (0 لعدم التحديد)
  missingPunchPenaltyEnabled?: boolean; // تفعيل خصم عدم وجود البصمة
  missingPunchPenaltyHours?: number; // عدد ساعات التأخير المحتسبة عند عدم وجود البصمة (الافتراضي: 3 ساعات)
  missingPunchApplyMode?: 'per_punch' | 'per_day'; // احتساب الخصم لكل بصمة مفقودة أو مرة واحدة لكل يوم به بصمة ناقصة
  missingPunchIncludeBreakPunches?: boolean; // شمول بصمات استراحة الغداء بالخصم في الورديات المنقسمة
  workDaysPerMonth: number; // e.g. 26
  standardHoursPerDay: number; // e.g. 8
  autoSyncEnabled: boolean;
  weekendDays: string[]; // e.g. ["Friday"]
}

const DEFAULT_HR_SETTINGS: HRSettings = {
  zkConnectionMode: 'direct',
  zkDeviceIp: '192.168.16.200',
  zkDevicePort: 4370,
  zktecoDbPath: 'K:\\shams\\55\\ZKTeco\\att2000.mdb',
  defaultShiftId: '5',
  generalOvertimeMode: 'percent',
  generalOvertimePercent: 125,
  generalOvertimeFixedRate: 15,
  overtimeThresholdScope: 'per_period',
  minOvertimeMinutes: 30,
  maxDailyOvertimeHours: 4,
  maxMonthlyOvertimeHours: 60,
  missingPunchPenaltyEnabled: true,
  missingPunchPenaltyHours: 3,
  missingPunchApplyMode: 'per_punch',
  missingPunchIncludeBreakPunches: false,
  workDaysPerMonth: 26,
  standardHoursPerDay: 8,
  autoSyncEnabled: true,
  weekendDays: ['Friday']
};

interface HRContextType {
  // Collections
  employees: HREmployee[];
  setEmployees: (val: HREmployee[] | ((prev: HREmployee[]) => HREmployee[])) => Promise<any>;
  shifts: HRShift[];
  setShifts: (val: HRShift[] | ((prev: HRShift[]) => HRShift[])) => Promise<any>;
  attendanceLogs: HRAttendanceLog[];
  setAttendanceLogs: (val: HRAttendanceLog[] | ((prev: HRAttendanceLog[]) => HRAttendanceLog[])) => Promise<any>;
  transactions: HRTransaction[];
  setTransactions: (val: HRTransaction[] | ((prev: HRTransaction[]) => HRTransaction[])) => Promise<any>;
  leaves: HRLeave[];
  setLeaves: (val: HRLeave[] | ((prev: HRLeave[]) => HRLeave[])) => Promise<any>;
  payrollRecords: HRPayrollRecord[];
  setPayrollRecords: (val: HRPayrollRecord[] | ((prev: HRPayrollRecord[]) => HRPayrollRecord[])) => Promise<any>;
  settlements: HREndOfServiceSettlement[];
  setSettlements: (val: HREndOfServiceSettlement[] | ((prev: HREndOfServiceSettlement[]) => HREndOfServiceSettlement[])) => Promise<any>;
  overtimeRecords: HROvertimeRecord[];
  setOvertimeRecords: (val: HROvertimeRecord[] | ((prev: HROvertimeRecord[]) => HROvertimeRecord[])) => Promise<any>;

  // Settings
  hrSettings: HRSettings;
  setHrSettings: (val: HRSettings | ((prev: HRSettings) => HRSettings)) => Promise<any>;

  // Sync state
  isSyncing: boolean;
  syncStats: {
    lastSyncAt?: string;
    insertedLogsCount?: number;
    usersCount?: number;
    path?: string;
    connectionMode?: string;
    ip?: string;
    serialNumber?: string;
    lastError?: string;
    lastErrorAt?: string;
  } | null;
  triggerSync: (options?: {
    fullSync?: boolean;
    matchActiveOnly?: boolean;
    purgeMissing?: boolean;
    logsOnly?: boolean;
    syncEmployees?: boolean;
  }) => Promise<{ success: boolean; error?: string; inProgress?: boolean; insertedLogsCount?: number; [key: string]: any }>;

  // Analysis & Calculation helpers
  getEmployeeShift: (emp: HREmployee) => HRShift;
  getEmployeeShifts: (emp: HREmployee) => HRShift[];
  analyzeDayAttendance: (dateStr: string, emp: HREmployee) => HRDayAttendanceAnalysis;
  analyzeMonthAttendance: (yearMonthStr: string, emp: HREmployee, customStartDate?: string, customEndDate?: string) => {
    expectedDays: number;
    actualWorkDays: number;
    absentDays: number;
    leaveDays: number;
    totalLateMinutes: number;
    totalEarlyMinutes: number;
    totalOvertimeHours: number;
    totalWorkedHours: number;
    dailyDetails: HRDayAttendanceAnalysis[];
  };
  calculatePayrollForMonth: (yearMonthStr: string, customStartDate?: string, customEndDate?: string) => HRPayrollItem[];
  detectDayOvertimePeriods: (dateStr: string) => HRDetectedOvertimePeriod[];

  // Mutators
  saveEmployee: (emp: HREmployee) => Promise<boolean>;
  deleteEmployee: (id: string) => Promise<boolean>;
  deleteEmployeesBulk: (ids: string[]) => Promise<boolean>;
  saveShift: (shift: HRShift) => Promise<boolean>;
  deleteShift: (id: string) => Promise<boolean>;
  saveTransaction: (trans: HRTransaction) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<boolean>;
  saveLeave: (leave: HRLeave) => Promise<boolean>;
  deleteLeave: (id: string) => Promise<boolean>;
  finalizePayroll: (record: HRPayrollRecord) => Promise<boolean>;
  deletePayrollRecord: (idOrMonth: string) => Promise<boolean>;
  createSettlement: (settlement: HREndOfServiceSettlement) => Promise<boolean>;
  deleteSettlement: (id: string) => Promise<boolean>;
  saveOvertimeRecord: (record: HROvertimeRecord) => Promise<boolean>;
  saveOvertimeRecordsBulk: (records: HROvertimeRecord[]) => Promise<boolean>;
  deleteOvertimeRecord: (id: string) => Promise<boolean>;
}

const HRContext = createContext<HRContextType | undefined>(undefined);

/**
 * Accurately determines whether an attendance log belongs to a given employee.
 * - Manual entries (source === 'manual' or id starting with 'MANUAL_'): matched strictly on employee database ID (emp.id).
 * - Biometric device entries (zkteco_direct / zkteco): matched strictly on biometric badge/PIN (emp.badgeNumber),
 *   and ONLY if the employee is linked to the biometric machine (isZkLinked !== false) and has a valid badgeNumber.
 * This eliminates collisions where an employee's database primary key equals another employee's biometric PIN.
 */
export function isLogMatchingEmployee(log: HRAttendanceLog | undefined | null, emp: HREmployee | undefined | null): boolean {
  if (!log || !emp) return false;
  const isManual = log.source === 'manual' || (typeof log.id === 'string' && log.id.startsWith('MANUAL_'));
  if (isManual) {
    return String(log.userId) === String(emp.id);
  }
  // Biometric device log: requires biometric link and valid badgeNumber
  if (emp.isZkLinked === false || !emp.badgeNumber || String(emp.badgeNumber).trim() === '') {
    return false;
  }
  const logBadge = String(log.badgeNumber || log.userId || '').trim();
  return logBadge === String(emp.badgeNumber).trim();
}

export const HRProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [employees, setEmployees] = useDatabaseCollection<HREmployee>('hr_employees', []);
  const [shifts, setShifts] = useDatabaseCollection<HRShift>('hr_shifts', []);
  const [attendanceLogs, setAttendanceLogs] = useDatabaseCollection<HRAttendanceLog>('hr_attendance_logs', []);
  const [transactions, setTransactions] = useDatabaseCollection<HRTransaction>('hr_transactions', []);
  const [leaves, setLeaves] = useDatabaseCollection<HRLeave>('hr_leaves', []);
  const [payrollRecords, setPayrollRecords] = useDatabaseCollection<HRPayrollRecord>('hr_payroll_records', []);
  const [settlements, setSettlements] = useDatabaseCollection<HREndOfServiceSettlement>('hr_settlements', []);
  const [overtimeRecords, setOvertimeRecords] = useDatabaseCollection<HROvertimeRecord>('hr_overtime_records', []);

  const [hrSettings, setHrSettings] = useDatabaseObject<HRSettings>('shams_hr_settings', DEFAULT_HR_SETTINGS);

  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  const [syncStats, setSyncStats] = useState<any>(null);

  // Load sync stats on mount
  useEffect(() => {
    zkGetStats().then(res => {
      if (res.success && res.data) {
        setSyncStats(res.data.stats || { lastSyncAt: res.data.lastSync });
      }
    }).catch(() => {});
  }, []);

  // ── Sync with ZKTeco ────────────────────────────────────────────────────────
  const triggerSync = async (options: {
    fullSync?: boolean;
    matchActiveOnly?: boolean;
    purgeMissing?: boolean;
    logsOnly?: boolean;
    syncEmployees?: boolean;
  } = {}) => {
    if (isSyncingRef.current) {
      return { success: false, inProgress: true, error: 'عملية سحب البصمات جارية بالفعل...' };
    }
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const mode = hrSettings.zkConnectionMode || 'direct';
      // في حال سحب البصمات (الافتراضي)، يتم سحب حركات الحضور فقط دون المساس بالموظفين
      const isEmployeesSync = Boolean(options.syncEmployees || options.matchActiveOnly || options.purgeMissing);
      const logsOnly = options.logsOnly ?? !isEmployeesSync;

      const res = await zkSyncAttendance({
        mode,
        ip: hrSettings.zkDeviceIp || DEFAULT_HR_SETTINGS.zkDeviceIp,
        port: hrSettings.zkDevicePort || DEFAULT_HR_SETTINGS.zkDevicePort,
        path: hrSettings.zktecoDbPath || DEFAULT_HR_SETTINGS.zktecoDbPath,
        fullSync: options.fullSync,
        matchActiveOnly: options.matchActiveOnly,
        purgeMissing: options.purgeMissing,
        logsOnly,
        syncEmployees: isEmployeesSync
      });
      if (res.success) {
        setSyncStats({
          lastSyncAt: new Date().toISOString(),
          insertedLogsCount: res.insertedLogsCount,
          usersCount: res.totalUsers || res.activeUsersCount,
          path: hrSettings.zktecoDbPath,
          connectionMode: res.connectionMode || mode,
          ip: hrSettings.zkDeviceIp || '192.168.16.200',
          serialNumber: res.device?.serialNumber,
          lastError: undefined
        });

        // إشعار فوري لجميع الخطافات لتحديث واجهة الحضور والغياب دون الحاجة لإعادة تحميل الصفحة
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'hr_attendance_logs' }));
          if (res.upsertedUsersCount > 0 || res.purgedUsersCount > 0 || res.deactivatedUsersCount > 0 || isEmployeesSync) {
            window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'hr_employees' }));
            window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'hr_shifts' }));
          }
        }
      } else {
        setSyncStats((prev: any) => ({
          ...prev,
          lastError: res.error,
          lastErrorAt: new Date().toISOString()
        }));
      }
      return res;
    } catch (e: any) {
      setSyncStats((prev: any) => ({
        ...prev,
        lastError: e.message,
        lastErrorAt: new Date().toISOString()
      }));
      return { success: false, error: e.message };
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const defaultShift = useMemo<HRShift>(() => {
    return shifts.find(s => s.isDefault || s.id === hrSettings.defaultShiftId || s.id === '5') || {
      id: 'default',
      name: 'دوام كامل',
      startTime: '08:00',
      endTime: '17:00',
      lateGraceMinutes: 10,
      earlyGraceMinutes: 10,
      workHours: 8,
      color: '#2563eb'
    };
  }, [shifts, hrSettings.defaultShiftId]);

  const getEmployeeShifts = (emp: HREmployee): HRShift[] => {
    const ids: string[] = Array.isArray(emp.shiftIds) && emp.shiftIds.length > 0
      ? emp.shiftIds
      : (emp.shiftId ? [emp.shiftId] : []);

    if (ids.length === 0) {
      return [defaultShift];
    }

    const foundShifts = ids
      .map(id => shifts.find(s => s.id === id))
      .filter((s): s is HRShift => !!s);

    if (foundShifts.length === 0) {
      return [defaultShift];
    }

    return [...foundShifts].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  };

  const getEmployeeShift = (emp: HREmployee): HRShift => {
    const empShifts = getEmployeeShifts(emp);
    if (empShifts.length === 1) return empShifts[0];
    
    const parseM = (t: string) => {
      const [h, m] = (t || '00:00').split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const totalWorkHours = empShifts.reduce((sum, s) => {
      const span = Math.max(0, (parseM(s.endTime) - parseM(s.startTime)) / 60);
      const wh = (s.workHours && s.workHours <= span) ? Number(s.workHours) : span;
      return sum + wh;
    }, 0);

    // Synthesize combined shift for display
    return {
      id: empShifts.map(s => s.id).join('+'),
      name: empShifts.map(s => s.name).join(' + '),
      startTime: empShifts[0].startTime,
      endTime: empShifts[empShifts.length - 1].endTime,
      lateGraceMinutes: empShifts[0].lateGraceMinutes ?? 10,
      earlyGraceMinutes: empShifts[empShifts.length - 1].earlyGraceMinutes ?? 10,
      workHours: totalWorkHours,
      color: empShifts[0].color || '#2563eb',
      isSplitShift: true,
      splitBreakStart: empShifts[0].endTime,
      splitBreakEnd: empShifts[1]?.startTime
    };
  };

  /**
   * Accurately determines whether an attendance log belongs to a given employee.
   * - Manual entries (source === 'manual' or id starting with 'MANUAL_'): matched strictly on employee database ID (emp.id).
   * - Biometric device entries (zkteco_direct / zkteco): matched strictly on biometric badge/PIN (emp.badgeNumber),
   *   and ONLY if the employee is linked to the biometric machine (isZkLinked !== false) and has a valid badgeNumber.
   * This eliminates collisions where an employee's database primary key equals another employee's biometric PIN.
   */
  // ── Indexed Map of Attendance Logs for Ultra-Fast O(1) Lookups ───────────────
  const attendanceLogsIndex = useMemo(() => {
    const map = new Map<string, HRAttendanceLog[]>();
    const len = attendanceLogs.length;
    for (let i = 0; i < len; i++) {
      const l = attendanceLogs[i];
      if (!l.checkTime) continue;
      const d = l.checkTime.slice(0, 10);
      const isManual = l.source === 'manual' || (typeof l.id === 'string' && l.id.startsWith('MANUAL_'));

      if (isManual) {
        // Manual logs are strictly keyed by employee database primary key (userId === emp.id)
        const k = `manual_${String(l.userId)}_${d}`;
        let arr = map.get(k);
        if (!arr) {
          arr = [];
          map.set(k, arr);
        }
        arr.push(l);
      } else {
        // Device logs are strictly keyed by device enroll PIN / badgeNumber
        const badge = String(l.badgeNumber || l.userId || '').trim();
        if (badge) {
          const k = `zk_${badge}_${d}`;
          let arr = map.get(k);
          if (!arr) {
            arr = [];
            map.set(k, arr);
          }
          arr.push(l);
        }
      }
    }
    return map;
  }, [attendanceLogs]);

  // ── Analyze Single Day Attendance ───────────────────────────────────────────
  const analyzeDayAttendance = (dateStr: string, emp: HREmployee): HRDayAttendanceAnalysis => {
    const empShifts = getEmployeeShifts(emp);
    const primaryShift = getEmployeeShift(emp);

    // 0. Check if date is after employee's termination date (مخالصة / إنهاء خدمة)
    if (emp.terminationDate && dateStr > emp.terminationDate) {
      return {
        employee: emp,
        date: dateStr,
        shift: primaryShift,
        shifts: empShifts,
        firstIn: null,
        lastOut: null,
        morningIn: null,
        morningOut: null,
        eveningIn: null,
        eveningOut: null,
        allPunches: [],
        workedHours: 0,
        scheduledHours: 0,
        lateMinutes: 0,
        earlyMinutes: 0,
        overtimeHours: 0,
        status: 'weekend', // لا يُحتسب كغياب ولا يُلزم بالدوام بعد تاريخ إنهاء الخدمة
        notes: 'نهاية خدمة / منقطع'
      };
    }

    // 1. Check if date is on approved leave (strictly matches emp.id)
    const onLeave = leaves.find(l => {
      if (String(l.employeeId) !== String(emp.id)) return false;
      if (l.status === 'rejected') return false;
      return dateStr >= l.startDate && dateStr <= l.endDate;
    });

    if (onLeave) {
      return {
        employee: emp,
        date: dateStr,
        shift: primaryShift,
        shifts: empShifts,
        firstIn: null,
        lastOut: null,
        morningIn: null,
        morningOut: null,
        eveningIn: null,
        eveningOut: null,
        allPunches: [],
        workedHours: 0,
        scheduledHours: primaryShift.workHours,
        lateMinutes: 0,
        earlyMinutes: 0,
        overtimeHours: 0,
        status: 'leave',
        notes: `إجازة: ${onLeave.reason || onLeave.type}`
      };
    }

    // 2. Check if date is a weekend (e.g. Friday)
    const dayOfWeekName = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    const isWeekend = (hrSettings.weekendDays || ['Friday']).includes(dayOfWeekName);

    // 3. Fast O(1) indexed lookup for this employee on dateStr (segregated without cross-employee collision)
    // A. Manual logs created explicitly for this employee
    const manualKey = `manual_${String(emp.id)}_${dateStr}`;
    const manualLogs = attendanceLogsIndex.get(manualKey) || [];

    // B. Biometric device logs (only if employee is linked to biometric device and has a badgeNumber)
    let zkLogs: HRAttendanceLog[] = [];
    if (emp.isZkLinked !== false && emp.badgeNumber && String(emp.badgeNumber).trim() !== '') {
      const zkKey = `zk_${String(emp.badgeNumber).trim()}_${dateStr}`;
      zkLogs = attendanceLogsIndex.get(zkKey) || [];
    }

    let dayLogs: HRAttendanceLog[];
    if (manualLogs.length === 0) {
      dayLogs = zkLogs;
    } else if (zkLogs.length === 0) {
      dayLogs = manualLogs;
    } else {
      const seen = new Set<string>();
      dayLogs = [];
      for (let i = 0; i < manualLogs.length; i++) {
        seen.add(manualLogs[i].id);
        dayLogs.push(manualLogs[i]);
      }
      for (let i = 0; i < zkLogs.length; i++) {
        if (!seen.has(zkLogs[i].id)) dayLogs.push(zkLogs[i]);
      }
    }

    if (dayLogs.length > 1) {
      dayLogs = [...dayLogs].sort((a, b) => a.checkTime.localeCompare(b.checkTime));
    }

    // فحص ما إذا كان مسجلاً كغياب يدوي صريح لهذا اليوم
    const isExplicitAbsent = dayLogs.some(l => l.checkType === 'ABSENT' || l.notes === 'غياب يدوي معتمد');
    if (isExplicitAbsent) {
      return {
        employee: emp,
        date: dateStr,
        shift: primaryShift,
        shifts: empShifts,
        firstIn: null,
        lastOut: null,
        morningIn: null,
        morningOut: null,
        eveningIn: null,
        eveningOut: null,
        allPunches: [],
        workedHours: 0,
        scheduledHours: primaryShift.workHours,
        lateMinutes: 0,
        earlyMinutes: 0,
        overtimeHours: 0,
        status: 'absent',
        notes: 'غياب يدوي معتمد'
      };
    }

    const punches = dayLogs.filter(l => l.checkType !== 'ABSENT').map(l => l.checkTime.slice(11, 16)); // "HH:mm"

    if (punches.length === 0) {
      // إذا كان الموظف غير مربوط بجهاز البصمة (دوام يدوي / معتمد)
      if (emp.isZkLinked === false) {
        const mode = emp.attendanceMode || (emp.salaryType === 'daily' ? 'manual' : 'auto_present');
        if (mode === 'auto_present') {
          if (isWeekend) {
            return {
              employee: emp,
              date: dateStr,
              shift: primaryShift,
              shifts: empShifts,
              firstIn: null,
              lastOut: null,
              morningIn: null,
              morningOut: null,
              eveningIn: null,
              eveningOut: null,
              allPunches: [],
              workedHours: 0,
              scheduledHours: primaryShift.workHours,
              lateMinutes: 0,
              earlyMinutes: 0,
              overtimeHours: 0,
              status: 'weekend',
              notes: 'عطلة أسبوعية'
            };
          }
          return {
            employee: emp,
            date: dateStr,
            shift: primaryShift,
            shifts: empShifts,
            firstIn: primaryShift.startTime,
            lastOut: primaryShift.endTime,
            morningIn: primaryShift.startTime,
            morningOut: primaryShift.isSplitShift ? primaryShift.splitBreakStart : null,
            eveningIn: primaryShift.isSplitShift ? primaryShift.splitBreakEnd : null,
            eveningOut: primaryShift.endTime,
            allPunches: [],
            workedHours: Number(primaryShift.workHours) || 8,
            scheduledHours: Number(primaryShift.workHours) || 8,
            lateMinutes: 0,
            earlyMinutes: 0,
            overtimeHours: 0,
            status: 'present',
            notes: 'دوام معتمد (بدون بصمة)'
          };
        } else {
          // نمط يدوي: يتطلب تسجيل حضور في كشف الحضور
          return {
            employee: emp,
            date: dateStr,
            shift: primaryShift,
            shifts: empShifts,
            firstIn: null,
            lastOut: null,
            morningIn: null,
            morningOut: null,
            eveningIn: null,
            eveningOut: null,
            allPunches: [],
            workedHours: 0,
            scheduledHours: primaryShift.workHours,
            lateMinutes: 0,
            earlyMinutes: 0,
            overtimeHours: 0,
            status: isWeekend ? 'weekend' : 'absent',
            notes: isWeekend ? 'عطلة أسبوعية' : 'غير مسجل حضور اليوم (يدوي)'
          };
        }
      }

      // موظف مسجل بالبصمة ولكن بنمط (بصمة للإضافي فقط - غير مطالب بالبصمة للدوام الرسمي)
      if (emp.attendanceMode === 'overtime_only') {
        if (isWeekend) {
          return {
            employee: emp,
            date: dateStr,
            shift: primaryShift,
            shifts: empShifts,
            firstIn: null,
            lastOut: null,
            morningIn: null,
            morningOut: null,
            eveningIn: null,
            eveningOut: null,
            allPunches: [],
            workedHours: 0,
            scheduledHours: primaryShift.workHours,
            lateMinutes: 0,
            earlyMinutes: 0,
            overtimeHours: 0,
            status: 'weekend',
            notes: 'عطلة أسبوعية'
          };
        }
        return {
          employee: emp,
          date: dateStr,
          shift: primaryShift,
          shifts: empShifts,
          firstIn: primaryShift.startTime,
          lastOut: primaryShift.endTime,
          morningIn: primaryShift.startTime,
          morningOut: primaryShift.isSplitShift ? primaryShift.splitBreakStart : null,
          eveningIn: primaryShift.isSplitShift ? primaryShift.splitBreakEnd : null,
          eveningOut: primaryShift.endTime,
          allPunches: [],
          workedHours: Number(primaryShift.workHours) || 8,
          scheduledHours: Number(primaryShift.workHours) || 8,
          lateMinutes: 0,
          earlyMinutes: 0,
          overtimeHours: 0,
          status: 'present',
          notes: 'دوام معتمد (بصمة للإضافي فقط)'
        };
      }

      // موظف مربوط بالبصمة ولم تسجل له أي بصمة
      return {
        employee: emp,
        date: dateStr,
        shift: primaryShift,
        shifts: empShifts,
        firstIn: null,
        lastOut: null,
        morningIn: null,
        morningOut: null,
        eveningIn: null,
        eveningOut: null,
        allPunches: [],
        workedHours: 0,
        scheduledHours: primaryShift.workHours,
        lateMinutes: 0,
        earlyMinutes: 0,
        overtimeHours: 0,
        status: isWeekend ? 'weekend' : 'absent'
      };
    }

    const parseMins = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    // Determine working periods for the day
    type PeriodDef = {
      startTime: string;
      endTime: string;
      startMins: number;
      endMins: number;
      workHours: number;
      lateGrace: number;
      earlyGrace: number;
      name: string;
    };

    const periods: PeriodDef[] = [];

    if (empShifts.length > 1) {
      // Multiple shifts assigned (e.g. Shift 1: 09:00-13:00, Shift 2: 14:00-18:00)
      for (const s of empShifts) {
        const sMins = parseMins(s.startTime || '08:00');
        const eMins = parseMins(s.endTime || '17:00');
        const periodSpanHours = Math.max(0, (eMins - sMins) / 60);
        const workHours = (s.workHours && s.workHours <= periodSpanHours) ? Number(s.workHours) : periodSpanHours;
        periods.push({
          startTime: s.startTime || '08:00',
          endTime: s.endTime || '17:00',
          startMins: sMins,
          endMins: eMins,
          workHours,
          lateGrace: s.lateGraceMinutes ?? 10,
          earlyGrace: s.earlyGraceMinutes ?? 10,
          name: s.name
        });
      }
    } else {
      const s = empShifts[0] || primaryShift;
      if (s.isSplitShift && s.splitBreakStart && s.splitBreakEnd) {
        // Single split shift (e.g. 09:00-18:00 with break 13:00-14:00)
        const p1Start = parseMins(s.startTime);
        const p1End = parseMins(s.splitBreakStart);
        const p2Start = parseMins(s.splitBreakEnd);
        const p2End = parseMins(s.endTime);

        periods.push({
          startTime: s.startTime,
          endTime: s.splitBreakStart,
          startMins: p1Start,
          endMins: p1End,
          workHours: Math.max(0, (p1End - p1Start) / 60),
          lateGrace: s.lateGraceMinutes ?? 10,
          earlyGrace: s.earlyGraceMinutes ?? 10,
          name: `${s.name} (الفترة 1)`
        });
        periods.push({
          startTime: s.splitBreakEnd,
          endTime: s.endTime,
          startMins: p2Start,
          endMins: p2End,
          workHours: Math.max(0, (p2End - p2Start) / 60),
          lateGrace: s.lateGraceMinutes ?? 10,
          earlyGrace: s.earlyGraceMinutes ?? 10,
          name: `${s.name} (الفترة 2)`
        });
      } else {
        // Single regular shift
        const sMins = parseMins(s.startTime || '08:00');
        const eMins = parseMins(s.endTime || '17:00');
        const periodSpanHours = Math.max(0, (eMins - sMins) / 60);
        const workHours = (s.workHours && s.workHours <= periodSpanHours) ? Number(s.workHours) : periodSpanHours;
        periods.push({
          startTime: s.startTime || '08:00',
          endTime: s.endTime || '17:00',
          startMins: sMins,
          endMins: eMins,
          workHours,
          lateGrace: s.lateGraceMinutes ?? 10,
          earlyGrace: s.earlyGraceMinutes ?? 10,
          name: s.name
        });
      }
    }

    const scheduledHours = periods.reduce((sum, p) => sum + p.workHours, 0);

    let morningIn: string | null = null;
    let morningOut: string | null = null;
    let eveningIn: string | null = null;
    let eveningOut: string | null = null;

    let totalWorkedMinutes = 0;
    let totalLateMinutes = 0;
    let totalEarlyMinutes = 0;
    let totalOvertimeMinutes = 0;
    let p1OvertimeMinutes = 0;
    let p2OvertimeMinutes = 0;
    let missingPunchesCount = 0;

    const firstIn = punches[0];
    const lastOut = punches.length > 1 ? punches[punches.length - 1] : null;

    // ── إذا كان الموظف بنمط (بصمة للإضافي فقط) ووجدت له بصمات ──
    if (emp.attendanceMode === 'overtime_only') {
      let rawOvertimeMins = 0;
      let p1OtMins = 0;
      let p2OtMins = 0;

      if (isWeekend) {
        if (punches.length > 1) {
          rawOvertimeMins = Math.max(0, parseMins(punches[punches.length - 1]) - parseMins(punches[0]));
        } else {
          rawOvertimeMins = Math.round(((scheduledHours || 8) * 60) / 2);
        }
      } else {
        if (periods.length === 1) {
          const p = periods[0];
          // إضافي مبكر قبل بداية الدوام الرسمي
          const earlyPunches = punches.filter(t => parseMins(t) < p.startMins);
          if (earlyPunches.length > 0) {
            rawOvertimeMins += (p.startMins - parseMins(earlyPunches[0]));
          }
          // إضافي متأخر بعد نهاية الدوام الرسمي
          const latePunches = punches.filter(t => parseMins(t) > p.endMins);
          if (latePunches.length > 0) {
            rawOvertimeMins += (parseMins(latePunches[latePunches.length - 1]) - p.endMins);
          }
        } else {
          // وردية منقسمة / أكثر من فترة
          const p1 = periods[0];
          const p2 = periods[1];

          const p1EarlyPunches = punches.filter(t => parseMins(t) < p1.startMins);
          if (p1EarlyPunches.length > 0) {
            p1OtMins += (p1.startMins - parseMins(p1EarlyPunches[0]));
          }

          const p2LatePunches = punches.filter(t => parseMins(t) > p2.endMins);
          if (p2LatePunches.length > 0) {
            p2OtMins += (parseMins(p2LatePunches[p2LatePunches.length - 1]) - p2.endMins);
          }

          const breakPunches = punches.filter(t => parseMins(t) > p1.endMins && parseMins(t) < p2.startMins);
          if (breakPunches.length > 1) {
            p1OtMins += Math.max(0, parseMins(breakPunches[breakPunches.length - 1]) - parseMins(breakPunches[0]));
          }

          rawOvertimeMins = p1OtMins + p2OtMins;
        }
      }

      // تطبيق الحد الأدنى للإضافي
      const minOtMins = (primaryShift?.minOvertimeMinutes !== undefined && primaryShift.minOvertimeMinutes !== null && primaryShift.minOvertimeMinutes >= 0)
        ? primaryShift.minOvertimeMinutes
        : (hrSettings.minOvertimeMinutes !== undefined && hrSettings.minOvertimeMinutes !== null ? Number(hrSettings.minOvertimeMinutes) : 30);

      const thresholdScope = hrSettings.overtimeThresholdScope || 'per_period';

      if (periods.length > 1 && thresholdScope === 'per_period') {
        if (minOtMins > 0) {
          if (p1OtMins < minOtMins) p1OtMins = 0;
          if (p2OtMins < minOtMins) p2OtMins = 0;
        }
        rawOvertimeMins = p1OtMins + p2OtMins;
      } else {
        if (minOtMins > 0 && rawOvertimeMins < minOtMins) {
          rawOvertimeMins = 0;
        }
      }

      // تطبيق الحد الأقصى للإضافي اليومي
      const maxDailyOtHours = (primaryShift?.maxDailyOvertimeHours !== undefined && primaryShift.maxDailyOvertimeHours !== null && primaryShift.maxDailyOvertimeHours >= 0)
        ? primaryShift.maxDailyOvertimeHours
        : (hrSettings.maxDailyOvertimeHours !== undefined && hrSettings.maxDailyOvertimeHours !== null ? Number(hrSettings.maxDailyOvertimeHours) : 4);

      if (maxDailyOtHours > 0) {
        const maxDailyOtMins = maxDailyOtHours * 60;
        if (rawOvertimeMins > maxDailyOtMins) {
          rawOvertimeMins = maxDailyOtMins;
        }
      }

      let totalOvertimeHours = Math.round((rawOvertimeMins / 60) * 10) / 10;
      const workedHours = isWeekend ? 0 : Number(primaryShift.workHours) || 8;

      // تطبيق قرارات المراجعة الصريحة للإضافي (قبول / رفض) إن وُجدت
      const empOtRecords = overtimeRecords.filter(r => String(r.employeeId) === String(emp.id) && r.date === dateStr);
      if (empOtRecords.length > 0) {
        const approvedHours = empOtRecords.filter(r => r.status === 'approved').reduce((s, r) => s + (Number(r.hours) || 0), 0);
        const hasRejected = empOtRecords.some(r => r.status === 'rejected');
        const hasApproved = empOtRecords.some(r => r.status === 'approved');
        if (hasApproved || hasRejected) {
          totalOvertimeHours = Math.round(approvedHours * 10) / 10;
        }
      }

      return {
        employee: emp,
        date: dateStr,
        shift: primaryShift,
        shifts: empShifts,
        firstIn,
        lastOut,
        morningIn: punches[0] || null,
        morningOut: null,
        eveningIn: null,
        eveningOut: punches.length > 1 ? punches[punches.length - 1] : null,
        allPunches: punches,
        workedHours,
        scheduledHours,
        lateMinutes: 0,
        earlyMinutes: 0,
        overtimeHours: totalOvertimeHours,
        missingPunchesCount: 0,
        missingPunchPenaltyMinutes: 0,
        status: isWeekend ? 'weekend' : 'present',
        notes: totalOvertimeHours > 0 ? 'دوام معتمد + عمل إضافي' : 'دوام معتمد (بصمة للإضافي فقط)'
      };
    }

    if (periods.length === 1) {
      // ── Single Period Calculation ──
      const p = periods[0];
      morningIn = firstIn;
      morningOut = lastOut;

      const firstInMins = parseMins(firstIn);
      if (firstInMins > p.startMins + p.lateGrace) {
        totalLateMinutes = firstInMins - p.startMins;
      }

      if (lastOut) {
        const lastOutMins = parseMins(lastOut);
        totalWorkedMinutes = Math.max(0, lastOutMins - firstInMins);
        if (lastOutMins < p.endMins - p.earlyGrace) {
          totalEarlyMinutes = p.endMins - lastOutMins;
        }

        // Overtime before shift start
        if (firstInMins < p.startMins) {
          totalOvertimeMinutes += (p.startMins - firstInMins);
        }

        // Overtime after shift end
        if (lastOutMins > p.endMins) {
          totalOvertimeMinutes += (lastOutMins - p.endMins);
        }
      } else {
        // Single punch (departure or arrival missing)
        missingPunchesCount = 1;
        totalWorkedMinutes = (p.workHours * 60) / 2;
      }
    } else {
      // ── Two (or more) Periods Calculation (e.g. Split Shift: 09:00-13:00 and 14:00-18:00) ──
      const p1 = periods[0];
      const p2 = periods[1];
      const midPointMins = Math.round((p1.endMins + p2.startMins) / 2);

      let mPunches: string[] = [];
      let ePunches: string[] = [];

      if (punches.length === 4) {
        // Unambiguous 4-punch sequence: Morning In, Morning Out, Evening In, Evening Out
        mPunches = [punches[0], punches[1]];
        ePunches = [punches[2], punches[3]];
      } else {
        mPunches = punches.filter(t => parseMins(t) <= midPointMins);
        ePunches = punches.filter(t => parseMins(t) > midPointMins);
      }

      if (punches.length === 1) {
        // Exactly 1 punch for the whole day
        missingPunchesCount = 1;
        const singleMins = parseMins(punches[0]);
        if (singleMins <= midPointMins) {
          morningIn = punches[0];
          if (singleMins > p1.startMins + p1.lateGrace) {
            totalLateMinutes = singleMins - p1.startMins;
          }
        } else {
          eveningIn = punches[0];
          if (singleMins > p2.startMins + p2.lateGrace) {
            totalLateMinutes = singleMins - p2.startMins;
          }
        }
        totalWorkedMinutes = (scheduledHours * 60) / 2;
      } else if (mPunches.length === 1 && ePunches.length === 1) {
        // Exactly 2 punches spanning morning and evening (e.g. 08:50 and 18:00)
        // Employee worked both periods without punching out for the lunch break!
        if (hrSettings.missingPunchIncludeBreakPunches) {
          missingPunchesCount = 2;
        }
        morningIn = mPunches[0];
        eveningOut = ePunches[0];

        const mInMins = parseMins(morningIn);
        const eOutMins = parseMins(eveningOut);

        // Deduct unpaid break between shifts
        const breakMins = Math.max(0, p2.startMins - p1.endMins);
        const rawSpan = Math.max(0, eOutMins - mInMins);
        totalWorkedMinutes = Math.max(0, rawSpan - breakMins);

        // Late or overtime before morning start
        if (mInMins > p1.startMins + p1.lateGrace) {
          totalLateMinutes += mInMins - p1.startMins;
        } else if (mInMins < p1.startMins) {
          p1OvertimeMinutes += (p1.startMins - mInMins);
        }

        // Early or overtime after evening end
        if (eOutMins < p2.endMins - p2.earlyGrace) {
          totalEarlyMinutes += p2.endMins - eOutMins;
        } else if (eOutMins > p2.endMins) {
          p2OvertimeMinutes += (eOutMins - p2.endMins);
        }
      } else {
        // Multi-punches (3, 4, or more punches):
        // Morning period
        if (mPunches.length > 0) {
          morningIn = mPunches[0];
          morningOut = mPunches.length > 1 ? mPunches[mPunches.length - 1] : null;

          const mInMins = parseMins(morningIn);
          if (mInMins > p1.startMins + p1.lateGrace) {
            totalLateMinutes += mInMins - p1.startMins;
          } else if (mInMins < p1.startMins) {
            p1OvertimeMinutes += (p1.startMins - mInMins);
          }

          if (morningOut) {
            const mOutMins = parseMins(morningOut);
            totalWorkedMinutes += Math.max(0, mOutMins - mInMins);
            if (mOutMins < p1.endMins - p1.earlyGrace) {
              totalEarlyMinutes += p1.endMins - mOutMins;
            } else if (mOutMins > p1.endMins) {
              p1OvertimeMinutes += (mOutMins - p1.endMins);
            }
          } else {
            // Only 1 morning punch, but evening punches exist
            missingPunchesCount += 1;
            totalWorkedMinutes += p1.workHours * 60;
          }
        }

        // Evening period
        if (ePunches.length > 0) {
          // If there's only 1 evening punch and morning punches existed:
          // it is typically departure (eveningOut)
          if (ePunches.length === 1 && mPunches.length > 0) {
            missingPunchesCount += 1;
            eveningIn = null; // not punched in
            eveningOut = ePunches[0];
            const eOutMins = parseMins(eveningOut);
            // Worked from p2.startMins to eOutMins
            totalWorkedMinutes += Math.max(0, eOutMins - p2.startMins);
            if (eOutMins < p2.endMins - p2.earlyGrace) {
              totalEarlyMinutes += p2.endMins - eOutMins;
            } else if (eOutMins > p2.endMins) {
              p2OvertimeMinutes += (eOutMins - p2.endMins);
            }
          } else {
            eveningIn = ePunches[0];
            eveningOut = ePunches.length > 1 ? ePunches[ePunches.length - 1] : ePunches[0];

            const eInMins = parseMins(eveningIn);
            if (eInMins > p2.startMins + p2.lateGrace) {
              totalLateMinutes += eInMins - p2.startMins;
            } else if (eInMins < p2.startMins) {
              p2OvertimeMinutes += (p2.startMins - eInMins);
            }

            if (eveningOut && eveningOut !== eveningIn) {
              const eOutMins = parseMins(eveningOut);
              totalWorkedMinutes += Math.max(0, eOutMins - eInMins);
              if (eOutMins < p2.endMins - p2.earlyGrace) {
                totalEarlyMinutes += p2.endMins - eOutMins;
              } else if (eOutMins > p2.endMins) {
                p2OvertimeMinutes += (eOutMins - p2.endMins);
              }
            } else {
              // Only eveningIn
              missingPunchesCount += 1;
              totalWorkedMinutes += (p2.workHours * 60) / 2;
            }
          }
        }
      }
    }

    // ── Apply Overtime General Rules (Minimum Threshold & Maximum Daily Ceiling) ──
    const minOtMins = (primaryShift?.minOvertimeMinutes !== undefined && primaryShift.minOvertimeMinutes !== null && primaryShift.minOvertimeMinutes >= 0)
      ? primaryShift.minOvertimeMinutes
      : (hrSettings.minOvertimeMinutes !== undefined && hrSettings.minOvertimeMinutes !== null ? Number(hrSettings.minOvertimeMinutes) : 30);

    const thresholdScope = hrSettings.overtimeThresholdScope || 'per_period';

    if (periods.length > 1) {
      if (thresholdScope === 'per_period') {
        // Apply minimum threshold to EACH period / shift independently
        // e.g. 20 mins morning (< 30) -> 0, and 20 mins evening (< 30) -> 0
        if (minOtMins > 0) {
          if (p1OvertimeMinutes < minOtMins) p1OvertimeMinutes = 0;
          if (p2OvertimeMinutes < minOtMins) p2OvertimeMinutes = 0;
        }
        totalOvertimeMinutes = p1OvertimeMinutes + p2OvertimeMinutes;
      } else {
        // Daily total scope: sum all periods first then check threshold
        totalOvertimeMinutes = p1OvertimeMinutes + p2OvertimeMinutes;
        if (minOtMins > 0 && totalOvertimeMinutes < minOtMins) {
          totalOvertimeMinutes = 0;
        }
      }
    } else {
      // Single period shift: check threshold
      if (minOtMins > 0 && totalOvertimeMinutes < minOtMins) {
        totalOvertimeMinutes = 0;
      }
    }

    const maxDailyOtHours = (primaryShift?.maxDailyOvertimeHours !== undefined && primaryShift.maxDailyOvertimeHours !== null && primaryShift.maxDailyOvertimeHours >= 0)
      ? primaryShift.maxDailyOvertimeHours
      : (hrSettings.maxDailyOvertimeHours !== undefined && hrSettings.maxDailyOvertimeHours !== null ? Number(hrSettings.maxDailyOvertimeHours) : 4);

    // Cap overtime at daily maximum ceiling
    if (maxDailyOtHours > 0) {
      const maxDailyOtMins = maxDailyOtHours * 60;
      if (totalOvertimeMinutes > maxDailyOtMins) {
        totalOvertimeMinutes = maxDailyOtMins;
      }
    }

    // ── Missing Punch Delay Penalty (خصم عدم وجود البصمة) ──
    let missingPunchPenaltyMinutes = 0;
    const isAutoNonZk = emp.isZkLinked === false && emp.attendanceMode === 'auto_present';

    if (!isAutoNonZk && missingPunchesCount > 0 && hrSettings.missingPunchPenaltyEnabled !== false) {
      const penaltyHours = (primaryShift?.missingPunchPenaltyHours !== undefined && primaryShift.missingPunchPenaltyHours !== null && primaryShift.missingPunchPenaltyHours >= 0)
        ? primaryShift.missingPunchPenaltyHours
        : (hrSettings.missingPunchPenaltyHours !== undefined && hrSettings.missingPunchPenaltyHours !== null ? Number(hrSettings.missingPunchPenaltyHours) : 3);

      const applyMode = hrSettings.missingPunchApplyMode || 'per_punch';
      const multiplier = applyMode === 'per_day' ? 1 : missingPunchesCount;
      missingPunchPenaltyMinutes = Math.round(penaltyHours * 60 * multiplier);

      const maxScheduledMins = Math.round((scheduledHours || 8) * 60);
      if (missingPunchPenaltyMinutes > maxScheduledMins) {
        missingPunchPenaltyMinutes = maxScheduledMins;
      }

      totalLateMinutes += missingPunchPenaltyMinutes;

      // When only 1 punch exists, ensure totalWorkedMinutes is based on scheduled hours minus total delay/penalty
      if (punches.length === 1 && totalWorkedMinutes === ((scheduledHours || 8) * 60) / 2) {
        const netWorked = Math.max(0, Math.round((scheduledHours || 8) * 60) - totalLateMinutes);
        if (netWorked > 0) {
          totalWorkedMinutes = netWorked;
        }
      }
    }

    const workedHours = Math.round((totalWorkedMinutes / 60) * 10) / 10;
    let totalOvertimeHours = Math.round((totalOvertimeMinutes / 60) * 10) / 10;

    // تطبيق قرارات المراجعة الصريحة للإضافي (قبول / رفض) إن وُجدت لهذا اليوم
    const empOtRecords = overtimeRecords.filter(r => String(r.employeeId) === String(emp.id) && r.date === dateStr);
    if (empOtRecords.length > 0) {
      const approvedHours = empOtRecords.filter(r => r.status === 'approved').reduce((s, r) => s + (Number(r.hours) || 0), 0);
      const hasRejected = empOtRecords.some(r => r.status === 'rejected');
      const hasApproved = empOtRecords.some(r => r.status === 'approved');
      if (hasApproved || hasRejected) {
        totalOvertimeHours = Math.round(approvedHours * 10) / 10;
      }
    }

    let status: HRDayAttendanceAnalysis['status'] = 'present';
    if (punches.length === 1 || missingPunchesCount > 0) {
      status = 'single_punch';
    } else if (totalLateMinutes > 0) {
      status = 'late';
    }

    return {
      employee: emp,
      date: dateStr,
      shift: primaryShift,
      shifts: empShifts,
      firstIn,
      lastOut,
      morningIn,
      morningOut,
      eveningIn,
      eveningOut,
      allPunches: punches,
      workedHours,
      scheduledHours,
      lateMinutes: totalLateMinutes,
      earlyMinutes: totalEarlyMinutes,
      overtimeHours: totalOvertimeHours,
      missingPunchesCount,
      missingPunchPenaltyMinutes,
      status
    };
  };

  // ── Analyze Entire Month / Custom Date Range ──────────────────────────────
  const analyzeMonthAttendance = (
    yearMonthStr: string,
    emp: HREmployee,
    customStartDate?: string,
    customEndDate?: string
  ) => {
    let startDate: string;
    let endDate: string;

    if (customStartDate && customEndDate) {
      startDate = customStartDate;
      endDate = customEndDate;
    } else {
      const [year, month] = yearMonthStr.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const pad = (n: number) => String(n).padStart(2, '0');
      startDate = `${year}-${pad(month)}-01`;
      endDate = `${year}-${pad(month)}-${pad(daysInMonth)}`;
    }

    let expectedDays = 0;
    let actualWorkDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    let totalLateMinutes = 0;
    let totalEarlyMinutes = 0;
    let totalOvertimeHours = 0;
    let totalWorkedHours = 0;
    const dailyDetails: HRDayAttendanceAnalysis[] = [];

    const pad = (n: number) => String(n).padStart(2, '0');
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const [ey, em, ed] = endDate.split('-').map(Number);
    const curr = new Date(sy, sm - 1, sd, 12, 0, 0);
    const end = new Date(ey, em - 1, ed, 12, 0, 0);

    while (curr <= end) {
      const dateStr = `${curr.getFullYear()}-${pad(curr.getMonth() + 1)}-${pad(curr.getDate())}`;
      const dayAnalysis = analyzeDayAttendance(dateStr, emp);
      dailyDetails.push(dayAnalysis);

      if (dayAnalysis.status !== 'weekend') {
        expectedDays++;
      }

      if (dayAnalysis.status === 'present' || dayAnalysis.status === 'late' || dayAnalysis.status === 'single_punch') {
        actualWorkDays++;
        totalLateMinutes += dayAnalysis.lateMinutes;
        totalEarlyMinutes += dayAnalysis.earlyMinutes;
        totalOvertimeHours += dayAnalysis.overtimeHours;
        totalWorkedHours += dayAnalysis.workedHours;
      } else if (dayAnalysis.status === 'weekend') {
        if (dayAnalysis.overtimeHours > 0) {
          totalOvertimeHours += dayAnalysis.overtimeHours;
        }
      } else if (dayAnalysis.status === 'leave') {
        leaveDays++;
      } else if (dayAnalysis.status === 'absent') {
        absentDays++;
      }

      curr.setDate(curr.getDate() + 1);
    }

    let finalOvertimeHours = Math.round(totalOvertimeHours * 10) / 10;
    const maxMonthlyOtHours = (hrSettings.maxMonthlyOvertimeHours !== undefined && hrSettings.maxMonthlyOvertimeHours !== null)
      ? Number(hrSettings.maxMonthlyOvertimeHours)
      : 0;

    if (maxMonthlyOtHours > 0 && finalOvertimeHours > maxMonthlyOtHours) {
      finalOvertimeHours = maxMonthlyOtHours;
    }

    return {
      expectedDays,
      actualWorkDays,
      absentDays,
      leaveDays,
      totalLateMinutes,
      totalEarlyMinutes,
      totalOvertimeHours: finalOvertimeHours,
      totalWorkedHours: Math.round(totalWorkedHours * 10) / 10,
      dailyDetails
    };
  };

  // ── Calculate Payroll for Month / Period ────────────────────────────────────
  const calculatePayrollForMonth = (
    yearMonthStr: string,
    customStartDate?: string,
    customEndDate?: string
  ): HRPayrollItem[] => {
    const workDaysInMonth = hrSettings.workDaysPerMonth || 26;
    const hoursPerDay = hrSettings.standardHoursPerDay || 8;

    const monthStart = customStartDate || `${yearMonthStr}-01`;
    const targetEmployees = employees.filter(e => {
      if (e.isActive !== false) return true;
      if (settlements.some(s => String(s.employeeId) === String(e.id) && s.month === yearMonthStr)) return true;
      if (e.terminationDate && e.terminationDate >= monthStart) return true;
      return false;
    });

    return targetEmployees.map(emp => {
      // فحص ما إذا كان الموظف قد صُفيت مستحقاته بمخالصة فردية لهذا الشهر
      const matchingSettlement = settlements.find(
        s => String(s.employeeId) === String(emp.id) && s.month === yearMonthStr
      );

      if (matchingSettlement) {
        return {
          employeeId: emp.id,
          employeeName: emp.name,
          badgeNumber: emp.isZkLinked === false ? '' : (emp.badgeNumber || emp.id),
          attendanceMode: emp.attendanceMode,
          jobTitle: matchingSettlement.jobTitle || emp.jobTitle || 'موظف',
          deptName: matchingSettlement.deptName || emp.deptName || 'القسم العام',
          salaryType: matchingSettlement.salaryType || emp.salaryType || 'monthly',
          baseSalaryOrRate: matchingSettlement.baseSalaryOrRate,
          expectedDays: matchingSettlement.actualWorkDays + matchingSettlement.absentDays,
          actualWorkDays: matchingSettlement.actualWorkDays,
          absentDays: matchingSettlement.absentDays,
          leaveDays: 0,
          lateMinutes: matchingSettlement.lateMinutes,
          lateDeduction: matchingSettlement.delayDeduction,
          earlyMinutes: matchingSettlement.earlyMinutes,
          earlyDeduction: 0,
          delayMinutes: (matchingSettlement.lateMinutes || 0) + (matchingSettlement.earlyMinutes || 0),
          delayDeduction: matchingSettlement.delayDeduction,
          overtimeHours: matchingSettlement.overtimeHours,
          overtimeRate: 0,
          overtimeAmount: matchingSettlement.overtimeAmount,
          bonuses: matchingSettlement.bonuses,
          allowances: matchingSettlement.allowances + (matchingSettlement.leaveBalancePayout || 0) + (matchingSettlement.endOfServiceGratuity || 0),
          advances: matchingSettlement.advances,
          deductions: matchingSettlement.deductions + (matchingSettlement.otherDeductions || 0),
          earnedSalary: matchingSettlement.earnedSalary,
          netSalary: matchingSettlement.netPayable,
          isSettledOffCycle: true,
          settlementId: matchingSettlement.id,
          settlementDate: matchingSettlement.settlementDate,
          settlementAmountPaid: matchingSettlement.netPayable,
          currentPayableNet: 0, // لا يُصرف له شيء في المسير الدوري لتجنب الازدواجية
          notes: `مُصفى بمخالصة رقم (${matchingSettlement.id}) بتاريخ ${matchingSettlement.settlementDate}`
        };
      }

      const monthData = analyzeMonthAttendance(yearMonthStr, emp, customStartDate, customEndDate);

      // Hourly wage calculation
      let hourlyRate = 0;
      let baseSalaryOrRate = 0;
      let earnedSalary = 0;

      if (emp.salaryType === 'daily') {
        baseSalaryOrRate = Number(emp.dailyRate) || 0;
        hourlyRate = hoursPerDay > 0 ? baseSalaryOrRate / hoursPerDay : 0;
        earnedSalary = monthData.actualWorkDays * baseSalaryOrRate;
      } else {
        // 'monthly' (Default)
        baseSalaryOrRate = Number(emp.basicSalary) || 0;
        const dailyEquivalent = workDaysInMonth > 0 ? baseSalaryOrRate / workDaysInMonth : 0;
        hourlyRate = hoursPerDay > 0 ? dailyEquivalent / hoursPerDay : 0;

        // Deduct full days absent
        const absenceDeduction = monthData.absentDays * dailyEquivalent;
        earnedSalary = Math.max(0, baseSalaryOrRate - absenceDeduction);
      }

      // Overtime rate
      let otRate = 0;
      const otMode = emp.overtimeMode || 'general';
      if (otMode === 'fixed') {
        otRate = Number(emp.overtimeFixedAmount) || 0;
      } else if (otMode === 'percent') {
        otRate = hourlyRate * ((Number(emp.overtimePercent) || 125) / 100);
      } else {
        // 'general' setting
        if (hrSettings.generalOvertimeMode === 'fixed') {
          otRate = Number(hrSettings.generalOvertimeFixedRate) || 0;
        } else {
          otRate = hourlyRate * ((Number(hrSettings.generalOvertimePercent) || 125) / 100);
        }
      }
      otRate = Math.round(otRate * 100) / 100;
      const overtimeAmount = Math.round(monthData.totalOvertimeHours * otRate * 100) / 100;

      // Late & Early departure deductions
      const lateHours = (monthData.totalLateMinutes || 0) / 60;
      const lateDeduction = Math.round(lateHours * hourlyRate * 100) / 100;

      const earlyHours = (monthData.totalEarlyMinutes || 0) / 60;
      const earlyDeduction = Math.round(earlyHours * hourlyRate * 100) / 100;

      const delayMinutes = (monthData.totalLateMinutes || 0) + (monthData.totalEarlyMinutes || 0);
      const delayDeduction = Math.round((lateDeduction + earlyDeduction) * 100) / 100;

      // Filter transactions for this employee and this month (strictly by emp.id)
      const empTrans = transactions.filter(t => {
        const matchEmp = String(t.employeeId) === String(emp.id);
        if (!matchEmp || t.status === 'cancelled') return false;

        // Exact due month matching: Every transaction strictly belongs to its due month in payroll
        const transMonth = t.month || (t.date ? t.date.slice(0, 7) : '');
        return transMonth === yearMonthStr;
      });

      const advances = empTrans.filter(t => t.type === 'advance').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const deductions = empTrans.filter(t => t.type === 'deduction').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const bonuses = empTrans.filter(t => t.type === 'bonus').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const allowances = empTrans.filter(t => t.type === 'allowance').reduce((s, t) => s + (Number(t.amount) || 0), 0);

      // Final net salary (deducting both late arrival and early departure)
      const netSalary = Math.round(
        (earnedSalary + overtimeAmount + bonuses + allowances - lateDeduction - earlyDeduction - advances - deductions) * 100
      ) / 100;

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        badgeNumber: emp.isZkLinked === false ? '' : (emp.badgeNumber || emp.id),
        attendanceMode: emp.attendanceMode,
        jobTitle: emp.jobTitle || 'موظف',
        deptName: emp.deptName || 'القسم العام',
        salaryType: emp.salaryType || 'monthly',
        baseSalaryOrRate,
        expectedDays: monthData.expectedDays,
        actualWorkDays: monthData.actualWorkDays,
        absentDays: monthData.absentDays,
        leaveDays: monthData.leaveDays,
        lateMinutes: monthData.totalLateMinutes,
        lateDeduction,
        earlyMinutes: monthData.totalEarlyMinutes,
        earlyDeduction,
        delayMinutes,
        delayDeduction,
        overtimeHours: monthData.totalOvertimeHours,
        overtimeRate: otRate,
        overtimeAmount,
        bonuses,
        allowances,
        advances,
        deductions,
        earnedSalary: Math.round(earnedSalary * 100) / 100,
        netSalary,
        isSettledOffCycle: false,
        settlementAmountPaid: 0,
        currentPayableNet: netSalary
      };
    });
  };

  // ── Mutators ────────────────────────────────────────────────────────────────
  const saveEmployee = async (emp: HREmployee) => {
    const shiftIdsArr = Array.isArray(emp.shiftIds) && emp.shiftIds.length > 0 ? emp.shiftIds : (emp.shiftId ? [emp.shiftId] : []);
    const isZk = emp.isZkLinked !== false;
    const defaultAttMode = isZk ? 'biometric' : (emp.salaryType === 'daily' ? 'manual' : 'auto_present');
    const normalizedEmp: HREmployee = {
      ...emp,
      badgeNumber: emp.badgeNumber ? String(emp.badgeNumber).trim() : '',
      isZkLinked: isZk,
      attendanceMode: emp.attendanceMode || defaultAttMode,
      shiftId: shiftIdsArr[0] || emp.shiftId || '',
      shiftIds: shiftIdsArr
    };
    const existingIdx = employees.findIndex(e => e.id === emp.id);
    if (existingIdx >= 0) {
      await setEmployees(employees.map(e => e.id === emp.id ? normalizedEmp : e));
    } else {
      await setEmployees([normalizedEmp, ...employees]);
    }
    return true;
  };

  const deleteEmployee = async (id: string) => {
    await setEmployees(employees.filter(e => e.id !== id));
    return true;
  };

  const deleteEmployeesBulk = async (ids: string[]) => {
    const idSet = new Set(ids);
    await setEmployees(employees.filter(e => !idSet.has(e.id)));
    return true;
  };

  const saveShift = async (shift: HRShift) => {
    const existingIdx = shifts.findIndex(s => s.id === shift.id);
    if (existingIdx >= 0) {
      await setShifts(shifts.map(s => s.id === shift.id ? shift : s));
    } else {
      await setShifts([...shifts, shift]);
    }
    return true;
  };

  const deleteShift = async (id: string) => {
    await setShifts(shifts.filter(s => s.id !== id));
    return true;
  };

  const saveTransaction = async (trans: HRTransaction) => {
    const existingIdx = transactions.findIndex(t => t.id === trans.id);
    if (existingIdx >= 0) {
      await setTransactions(transactions.map(t => t.id === trans.id ? trans : t));
    } else {
      await setTransactions([trans, ...transactions]);
    }
    return true;
  };

  const deleteTransaction = async (id: string) => {
    await setTransactions(transactions.filter(t => t.id !== id));
    return true;
  };

  const saveLeave = async (leave: HRLeave) => {
    const existingIdx = leaves.findIndex(l => l.id === leave.id);
    if (existingIdx >= 0) {
      await setLeaves(leaves.map(l => l.id === leave.id ? leave : l));
    } else {
      await setLeaves([leave, ...leaves]);
    }
    return true;
  };

  const deleteLeave = async (id: string) => {
    await setLeaves(leaves.filter(l => l.id !== id));
    return true;
  };

  const finalizePayroll = async (record: HRPayrollRecord) => {
    const existingIdx = payrollRecords.findIndex(p => p.id === record.id || p.month === record.month);
    if (existingIdx >= 0) {
      await setPayrollRecords(payrollRecords.map(p => (p.id === record.id || p.month === record.month) ? record : p));
    } else {
      await setPayrollRecords([record, ...payrollRecords]);
    }

    // Mark transactions belonging to this month as settled
    const updatedTrans = transactions.map(t => {
      const transMonth = t.month || (t.date ? t.date.slice(0, 7) : '');
      if (transMonth === record.month && t.status !== 'cancelled') {
        return { ...t, status: 'settled' as const };
      }
      return t;
    });
    await setTransactions(updatedTrans);

    return true;
  };

  const deletePayrollRecord = async (idOrMonth: string) => {
    const record = payrollRecords.find(p => p.id === idOrMonth || p.month === idOrMonth);
    const targetMonth = record?.month || idOrMonth;

    await setPayrollRecords(payrollRecords.filter(p => p.id !== idOrMonth && p.month !== idOrMonth));

    // Revert settled transactions for this month back to pending
    const updatedTrans = transactions.map(t => {
      const transMonth = t.month || (t.date ? t.date.slice(0, 7) : '');
      if (transMonth === targetMonth && t.status === 'settled') {
        return { ...t, status: 'pending' as const };
      }
      return t;
    });
    await setTransactions(updatedTrans);

    return true;
  };

  const createSettlement = async (settlement: HREndOfServiceSettlement) => {
    const existingIdx = settlements.findIndex(s => s.id === settlement.id);
    if (existingIdx >= 0) {
      await setSettlements(settlements.map(s => s.id === settlement.id ? settlement : s));
    } else {
      await setSettlements([settlement, ...settlements]);
    }

    // تحديث حالة الموظف إلى غير نشط وتثبيت تاريخ وسبب إنهاء الخدمة
    const emp = employees.find(e => String(e.id) === String(settlement.employeeId));
    if (emp) {
      const updatedEmp: HREmployee = {
        ...emp,
        isActive: false,
        terminationDate: settlement.settlementDate,
        terminationReason: settlement.reason
      };
      await saveEmployee(updatedEmp);
    }

    // إغلاق وتسوية جميع سلفيات وحركات الموظف لهذا الشهر حتى لا تتكرر أو تُخصم ثانية
    const updatedTrans = transactions.map(t => {
      if (String(t.employeeId) === String(settlement.employeeId)) {
        const transMonth = t.month || (t.date ? t.date.slice(0, 7) : '');
        if (transMonth === settlement.month && t.status !== 'cancelled') {
          return { ...t, status: 'settled' as const };
        }
      }
      return t;
    });
    await setTransactions(updatedTrans);

    return true;
  };

  const deleteSettlement = async (id: string) => {
    const target = settlements.find(s => s.id === id);
    if (!target) return false;

    await setSettlements(settlements.filter(s => s.id !== id));

    // إذا كان الموظف قد أُنهيت خدمته بهذه المخالصة، إعادة تنشيطه
    const emp = employees.find(e => String(e.id) === String(target.employeeId));
    if (emp && emp.terminationDate === target.settlementDate) {
      const updatedEmp: HREmployee = {
        ...emp,
        isActive: true,
        terminationDate: undefined,
        terminationReason: undefined
      };
      await saveEmployee(updatedEmp);
    }

    // إعادة فتح حركات هذا الشهر إن كانت مسواة
    const updatedTrans = transactions.map(t => {
      if (String(t.employeeId) === String(target.employeeId)) {
        const transMonth = t.month || (t.date ? t.date.slice(0, 7) : '');
        if (transMonth === target.month && t.status === 'settled') {
          return { ...t, status: 'pending' as const };
        }
      }
      return t;
    });
    await setTransactions(updatedTrans);

    return true;
  };

  // ── Overtime Records Detection & Mutators ──────────────────────────────────
  const detectDayOvertimePeriods = (dateStr: string): HRDetectedOvertimePeriod[] => {
    const results: HRDetectedOvertimePeriod[] = [];
    const parseMins = (hhmm: string) => {
      const [h, m] = (hhmm || '00:00').split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const workDaysInMonth = hrSettings.workDaysPerMonth || 26;
    const hoursPerDay = hrSettings.standardHoursPerDay || 8;
    const minOtMins = (hrSettings.minOvertimeMinutes !== undefined && hrSettings.minOvertimeMinutes !== null)
      ? Number(hrSettings.minOvertimeMinutes)
      : 30;

    const dayOfWeekName = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    const isWeekend = (hrSettings.weekendDays || ['Friday']).includes(dayOfWeekName);

    // Active employees on dateStr
    const activeEmployees = employees.filter(e => {
      if (e.isActive !== false) return true;
      if (e.terminationDate && e.terminationDate >= dateStr) return true;
      return false;
    });

    for (const emp of activeEmployees) {
      if (emp.terminationDate && dateStr > emp.terminationDate) continue;

      // Hourly wage & Overtime rate
      let baseSalaryOrRate = 0;
      let hourlyRate = 0;
      if (emp.salaryType === 'daily') {
        baseSalaryOrRate = Number(emp.dailyRate) || 0;
        hourlyRate = hoursPerDay > 0 ? baseSalaryOrRate / hoursPerDay : 0;
      } else {
        baseSalaryOrRate = Number(emp.basicSalary) || 0;
        const dailyEquiv = workDaysInMonth > 0 ? baseSalaryOrRate / workDaysInMonth : 0;
        hourlyRate = hoursPerDay > 0 ? dailyEquiv / hoursPerDay : 0;
      }

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
      hourlyRate = Math.round(hourlyRate * 100) / 100;
      otRate = Math.round(otRate * 100) / 100;

      // Logs for dateStr
      const manualKey = `manual_${String(emp.id)}_${dateStr}`;
      const manualLogs = attendanceLogsIndex.get(manualKey) || [];

      let zkLogs: HRAttendanceLog[] = [];
      if (emp.isZkLinked !== false && emp.badgeNumber && String(emp.badgeNumber).trim() !== '') {
        const zkKey = `zk_${String(emp.badgeNumber).trim()}_${dateStr}`;
        zkLogs = attendanceLogsIndex.get(zkKey) || [];
      }

      let dayLogs: HRAttendanceLog[];
      if (manualLogs.length === 0) dayLogs = zkLogs;
      else if (zkLogs.length === 0) dayLogs = manualLogs;
      else {
        const seen = new Set<string>();
        dayLogs = [];
        for (const l of manualLogs) { seen.add(l.id); dayLogs.push(l); }
        for (const l of zkLogs) { if (!seen.has(l.id)) dayLogs.push(l); }
      }
      dayLogs.sort((a, b) => a.checkTime.localeCompare(b.checkTime));

      const punches = dayLogs.filter(l => l.checkType !== 'ABSENT').map(l => l.checkTime.slice(11, 16));
      if (punches.length === 0) continue;

      const primaryShift = getEmployeeShift(emp);
      const empShifts = getEmployeeShifts(emp);

      const addPeriod = (
        type: HROvertimePeriodType,
        label: string,
        range: string,
        rawMins: number
      ) => {
        if (rawMins <= 0) return;
        // In daily overtime processing screen, do not suppress periods under threshold
        // so that the manager sees all overtime and has full control to review/accept/reject.

        const hours = Math.round((rawMins / 60) * 10) / 10;
        const amount = Math.round(hours * otRate * 100) / 100;
        const periodId = `OT_${emp.id}_${dateStr}_${type}`;

        const existing = overtimeRecords.find(
          r => r.id === periodId || (String(r.employeeId) === String(emp.id) && r.date === dateStr && r.periodType === type)
        );

        results.push({
          id: periodId,
          employee: emp,
          date: dateStr,
          periodType: type,
          periodLabel: label,
          punchRange: range,
          actualMinutes: rawMins,
          hours,
          hourlyRate,
          overtimeRate: otRate,
          amount,
          existingRecord: existing,
          status: existing?.status || 'pending',
          reason: existing?.reason,
          rejectionReason: existing?.rejectionReason,
          notes: existing?.notes
        });
      };

      // Case 1: Weekend Overtime
      if (isWeekend) {
        const first = punches[0];
        const last = punches.length > 1 ? punches[punches.length - 1] : punches[0];
        const spanMins = punches.length > 1 ? (parseMins(last) - parseMins(first)) : ((primaryShift.workHours || 8) * 60 / 2);
        addPeriod('weekend', 'إضافي يوم عطلة أسبوعية', `${first} - ${last}`, spanMins);
        continue;
      }

      // Case 2: Mode = overtime_only
      if (emp.attendanceMode === 'overtime_only') {
        const sStart = parseMins(primaryShift.startTime || '08:00');
        const sEnd = parseMins(primaryShift.endTime || '17:00');

        const earlyPunches = punches.filter(t => parseMins(t) < sStart);
        const latePunches = punches.filter(t => parseMins(t) > sEnd);

        if (earlyPunches.length > 0) {
          const earlyMins = sStart - parseMins(earlyPunches[0]);
          addPeriod('before_shift', 'إضافي قبل الدوام (دخول مبكر)', `البصمة: ${earlyPunches[0]} | الدوام: ${primaryShift.startTime}`, earlyMins);
        }
        if (latePunches.length > 0) {
          const lateMins = parseMins(latePunches[latePunches.length - 1]) - sEnd;
          addPeriod('after_shift', 'إضافي بعد الدوام (خروج متأخر)', `الدوام: ${primaryShift.endTime} | البصمة: ${latePunches[latePunches.length - 1]}`, lateMins);
        }
        continue;
      }

      // Case 3: Regular Shift
      const periods: { startMins: number; endMins: number; startTime: string; endTime: string }[] = [];
      if (empShifts.length > 1) {
        for (const s of empShifts) {
          periods.push({
            startMins: parseMins(s.startTime || '08:00'),
            endMins: parseMins(s.endTime || '17:00'),
            startTime: s.startTime || '08:00',
            endTime: s.endTime || '17:00'
          });
        }
      } else {
        const s = empShifts[0] || primaryShift;
        if (s.isSplitShift && s.splitBreakStart && s.splitBreakEnd) {
          periods.push({
            startMins: parseMins(s.startTime),
            endMins: parseMins(s.splitBreakStart),
            startTime: s.startTime,
            endTime: s.splitBreakStart
          });
          periods.push({
            startMins: parseMins(s.splitBreakEnd),
            endMins: parseMins(s.endTime),
            startTime: s.splitBreakEnd,
            endTime: s.endTime
          });
        } else {
          periods.push({
            startMins: parseMins(s.startTime || '08:00'),
            endMins: parseMins(s.endTime || '17:00'),
            startTime: s.startTime || '08:00',
            endTime: s.endTime || '17:00'
          });
        }
      }

      if (periods.length === 1) {
        const p = periods[0];
        const firstIn = punches[0];
        const lastOut = punches.length > 1 ? punches[punches.length - 1] : null;

        if (parseMins(firstIn) < p.startMins) {
          const earlyMins = p.startMins - parseMins(firstIn);
          addPeriod('before_shift', 'إضافي قبل الدوام (دخول مبكر)', `البصمة: ${firstIn} | بداية الوردية: ${p.startTime}`, earlyMins);
        }
        if (lastOut && parseMins(lastOut) > p.endMins) {
          const lateMins = parseMins(lastOut) - p.endMins;
          addPeriod('after_shift', 'إضافي بعد الدوام (خروج متأخر)', `نهاية الوردية: ${p.endTime} | البصمة: ${lastOut}`, lateMins);
        }
      } else {
        const p1 = periods[0];
        const p2 = periods[1];
        const midPointMins = Math.round((p1.endMins + p2.startMins) / 2);

        let mPunches: string[] = [];
        let ePunches: string[] = [];

        if (punches.length === 4) {
          // Unambiguous 4-punch sequence: Morning In, Morning Out, Evening In, Evening Out
          mPunches = [punches[0], punches[1]];
          ePunches = [punches[2], punches[3]];
        } else {
          mPunches = punches.filter(t => parseMins(t) <= midPointMins);
          ePunches = punches.filter(t => parseMins(t) > midPointMins);
        }

        if (mPunches.length > 0 && parseMins(mPunches[0]) < p1.startMins) {
          const earlyMins = p1.startMins - parseMins(mPunches[0]);
          addPeriod('before_shift', 'إضافي قبل الدوام (صباحي)', `البصمة: ${mPunches[0]} | بداية الوردية الأولى: ${p1.startTime}`, earlyMins);
        }
        if (mPunches.length > 1 && parseMins(mPunches[mPunches.length - 1]) > p1.endMins) {
          const extraMins = parseMins(mPunches[mPunches.length - 1]) - p1.endMins;
          addPeriod('mid_break', 'إضافي استراحة الغداء (تمديد صباحي)', `نهاية الوردية: ${p1.endTime} | البصمة: ${mPunches[mPunches.length - 1]}`, extraMins);
        }
        if (ePunches.length > 0 && parseMins(ePunches[0]) < p2.startMins) {
          const extraMins = p2.startMins - parseMins(ePunches[0]);
          addPeriod('mid_break', 'إضافي استراحة الغداء (حضور مسائي مبكر)', `البصمة: ${ePunches[0]} | بداية الوردية الثانية: ${p2.startTime}`, extraMins);
        }
        if (ePunches.length > 0 && parseMins(ePunches[ePunches.length - 1]) > p2.endMins) {
          const lateMins = parseMins(ePunches[ePunches.length - 1]) - p2.endMins;
          addPeriod('after_shift', 'إضافي بعد الدوام (مسائي)', `نهاية الوردية: ${p2.endTime} | البصمة: ${ePunches[ePunches.length - 1]}`, lateMins);
        }
      }
    }

    return results;
  };

  const saveOvertimeRecord = async (record: HROvertimeRecord) => {
    const existingIdx = overtimeRecords.findIndex(r => r.id === record.id);
    if (existingIdx >= 0) {
      await setOvertimeRecords(overtimeRecords.map(r => r.id === record.id ? record : r));
    } else {
      await setOvertimeRecords([record, ...overtimeRecords]);
    }
    return true;
  };

  const saveOvertimeRecordsBulk = async (records: HROvertimeRecord[]) => {
    const map = new Map(overtimeRecords.map(r => [r.id, r]));
    for (const rec of records) {
      map.set(rec.id, rec);
    }
    await setOvertimeRecords(Array.from(map.values()));
    return true;
  };

  const deleteOvertimeRecord = async (id: string) => {
    await setOvertimeRecords(overtimeRecords.filter(r => r.id !== id));
    return true;
  };

  return (
    <HRContext.Provider
      value={{
        employees,
        setEmployees,
        shifts,
        setShifts,
        attendanceLogs,
        setAttendanceLogs,
        transactions,
        setTransactions,
        leaves,
        setLeaves,
        payrollRecords,
        setPayrollRecords,
        settlements,
        setSettlements,
        overtimeRecords,
        setOvertimeRecords,
        hrSettings,
        setHrSettings,
        isSyncing,
        syncStats,
        triggerSync,
        getEmployeeShift,
        getEmployeeShifts,
        analyzeDayAttendance,
        analyzeMonthAttendance,
        calculatePayrollForMonth,
        detectDayOvertimePeriods,
        saveEmployee,
        deleteEmployee,
        deleteEmployeesBulk,
        saveShift,
        deleteShift,
        saveTransaction,
        deleteTransaction,
        saveLeave,
        deleteLeave,
        finalizePayroll,
        deletePayrollRecord,
        createSettlement,
        deleteSettlement,
        saveOvertimeRecord,
        saveOvertimeRecordsBulk,
        deleteOvertimeRecord
      }}
    >
      {children}
    </HRContext.Provider>
  );
};

export const useHR = () => {
  const context = useContext(HRContext);
  if (!context) {
    throw new Error('useHR must be used within an HRProvider');
  }
  return context;
};
